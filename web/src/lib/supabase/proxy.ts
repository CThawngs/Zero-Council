import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasPasswordClaim } from '@/lib/auth-password';
import { devLoginEmail, isSupabaseServerConfigured } from '@/lib/devAuth';
import {
  canAccessWithoutPasswordClaim,
  isPublicPath,
  isValidLegalPath,
  resolveRequestLanguage,
} from '@/lib/seo';

export { canAccessWithoutPasswordClaim, isPublicPath };

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/legal' || (pathname.startsWith('/legal/') && !isValidLegalPath(pathname))) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
  const isPageRequest = !pathname.startsWith('/api/');
  const publicRoute = isPublicPath(pathname);

  const rawLang = request.nextUrl.searchParams.get('lang');
  const hasExplicitLang =
    typeof rawLang === 'string' &&
    (rawLang.trim().toLowerCase() === 'vi' || rawLang.trim().toLowerCase() === 'en');
  const queryLang = hasExplicitLang ? resolveRequestLanguage(rawLang, null) : null;

  if (queryLang) {
    request.cookies.set('zc-lang', queryLang);
  }
  request.headers.set('x-zc-pathname', pathname);

  const attachLangCookie = (res: NextResponse) => {
    if (queryLang) {
      res.cookies.set('zc-lang', queryLang, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
    return res;
  };

  if (devLoginEmail()) {
    return attachLangCookie(NextResponse.next({ request }));
  }

  if (!isSupabaseServerConfigured()) {
    if (isPageRequest && !publicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      return NextResponse.redirect(url);
    }
    return attachLangCookie(NextResponse.next({ request }));
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

  if (isPageRequest && !user && !publicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  if (user) {
    const hasPassword = hasPasswordClaim(user as { user_metadata?: Record<string, unknown> });
    if (!hasPassword && !canAccessWithoutPasswordClaim(pathname)) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return attachLangCookie(supabaseResponse);
}
