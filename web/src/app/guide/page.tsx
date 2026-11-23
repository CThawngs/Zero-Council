import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { GuideView } from '@/prototype/components/GuideView';
import { buildPublicMetadata, resolveRequestLanguage } from '@/lib/seo';
import { buildBreadcrumbJsonLd, serializeJsonLd } from '@/lib/seo-jsonld';
import { copy } from '@/prototype/i18n';
import { cookieLanguage } from '@/prototype/types';

type GuidePageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: GuidePageProps): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveRequestLanguage(
    resolvedParams?.lang,
    cookieStore.get(cookieLanguage)?.value
  );

  return buildPublicMetadata({
    lang,
    path: '/guide',
    title: `${copy[lang].guideTitle} — Zero Council`,
    description: copy[lang].guideIntro,
  });
}

export default async function GuidePage({ searchParams }: GuidePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveRequestLanguage(
    resolvedParams?.lang,
    cookieStore.get(cookieLanguage)?.value
  );

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Zero Council', path: '/' },
    { name: copy[lang].guideTitle, path: '/guide' },
  ]);

  return (
    <>
      <script
        id="zc-guide-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <GuideView standalone />
    </>
  );
}
