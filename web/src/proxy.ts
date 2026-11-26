import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /**
   * Exclude Next.js internals, static fonts/assets, and public crawler/social
   * discovery endpoints (robots.txt, sitemap.xml, manifest.webmanifest, llms.txt,
   * opengraph-image, twitter-image, icon, apple-icon) from auth session redirects.
   */
  matcher: [
    '/((?!_next|fixture(?:/|$)|council-fixture(?:/|$)|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|llms\\.txt|opengraph-image|twitter-image|icon|apple-icon|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff|txt|xml|webmanifest)$).*)',
  ],
};
