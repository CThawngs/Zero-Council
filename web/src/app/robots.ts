import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/seo.ts';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/guide', '/legal/'],
        disallow: ['/dashboard', '/admin', '/api/', '/auth/callback', '/checkout/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
