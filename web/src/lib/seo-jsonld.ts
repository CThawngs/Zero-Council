import { copy } from '../prototype/i18n.ts';
import { PLANS } from '../prototype/data/plans.ts';
import type { Language } from '../prototype/types.ts';
import { SITE_NAME, getSiteUrl, normalizeCanonicalPath } from './seo.ts';

export interface FaqItem {
  question: string;
  answer: string;
}

export function getFaqItems(lang: Language): FaqItem[] {
  const dict = copy[lang];
  return [
    { question: dict.faq1Q, answer: dict.faq1A },
    { question: dict.faq2Q, answer: dict.faq2A },
    { question: dict.faq3Q, answer: dict.faq3A },
    { question: dict.faq4Q, answer: dict.faq4A },
    { question: dict.faq5Q, answer: dict.faq5A },
    { question: dict.faq6Q, answer: dict.faq6A },
  ];
}

/**
 * Escapes '<' so serialized JSON-LD is safe inside <script type="application/ld+json">.
 */
export function serializeJsonLd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export function buildHomeJsonLd(lang: Language): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  const dict = copy[lang];
  const faqItems = getFaqItems(lang);

  const prices = PLANS.map((plan) => plan.priceVnd);
  const lowPrice = String(Math.min(...prices));
  const highPrice = String(Math.max(...prices));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/icon.svg`,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: SITE_NAME,
        inLanguage: ['en', 'vi'],
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#software`,
        name: SITE_NAME,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: siteUrl,
        inLanguage: lang,
        description: dict.documentDescription,
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'VND',
          lowPrice,
          highPrice,
          offerCount: PLANS.length,
          offers: PLANS.map((plan) => ({
            '@type': 'Offer',
            name: plan.name,
            price: String(plan.priceVnd),
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
            url: `${siteUrl}/#pricing`,
          })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/#faq`,
        inLanguage: lang,
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const normalized = normalizeCanonicalPath(item.path);
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: normalized === '/' ? siteUrl : `${siteUrl}${normalized}`,
      };
    }),
  };
}
