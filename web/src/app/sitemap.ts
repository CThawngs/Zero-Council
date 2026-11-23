import type { MetadataRoute } from 'next';
import { LEGAL_DOCUMENTS } from '../prototype/types.ts';
import { getSiteUrl } from '../lib/seo.ts';

const SITEMAP_LAST_MODIFIED = new Date('2026-11-23T00:00:00.000Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const buildEntry = (
    path: string,
    priority: number,
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  ): MetadataRoute.Sitemap[number] => {
    const canonicalUrl = path === '/' ? siteUrl : `${siteUrl}${path}`;
    const queryBase = path === '/' ? `${siteUrl}/` : canonicalUrl;
    return {
      url: canonicalUrl,
      lastModified: SITEMAP_LAST_MODIFIED,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          en: `${queryBase}?lang=en`,
          vi: `${queryBase}?lang=vi`,
          'x-default': canonicalUrl,
        },
      },
    };
  };

  return [
    buildEntry('/', 1.0, 'weekly'),
    buildEntry('/guide', 0.8, 'monthly'),
    ...LEGAL_DOCUMENTS.map((slug) => buildEntry(`/legal/${slug}`, 0.5, 'monthly')),
  ];
}
