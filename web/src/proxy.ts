import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * `woff2`/`woff` are here because `updateSession` sends every anonymous
     * visitor to /auth — a redirect the browser follows while loading a font,
     * so the request comes back as HTML, the font is rejected, and every
     * Vietnamese glyph silently falls back to a system font. The list also
     * loses half its value the moment it is copied: any asset type added
     * later (a font, a manifest, a .txt) is swallowed by default. Prefer
     * excluding by directory — `static|fonts|assets` — over growing this list.
     */
    '/((?!_next/static|_next/image|favicon.ico|_next/data|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff)$).*)',
  ],
}