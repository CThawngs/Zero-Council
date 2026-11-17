import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasPasswordClaim } from '@/lib/auth-password';
import { devLoginEmail, isSupabaseServerConfigured } from '@/lib/devAuth';

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPageRequest = !pathname.startsWith('/api/');
  const isPublicPath =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/checkout');

  if (devLoginEmail()) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseServerConfigured()) {
    if (isPageRequest && !isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (isPageRequest && !user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  if (user) {
    const hasPassword = hasPasswordClaim(user as { user_metadata?: Record<string, unknown> });
    if (!hasPassword && pathname !== '/auth') {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return supabaseResponse;
}
