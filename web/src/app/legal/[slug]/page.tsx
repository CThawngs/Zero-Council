import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { LegalView } from '@/prototype/components/LegalView';
import { buildPublicMetadata, resolveRequestLanguage } from '@/lib/seo';
import { buildBreadcrumbJsonLd, serializeJsonLd } from '@/lib/seo-jsonld';
import { copy } from '@/prototype/i18n';
import {
  LEGAL_DOCUMENTS,
  cookieLanguage,
  type LegalDocument,
} from '@/prototype/types';

export const dynamicParams = false;

function isLegalDocument(slug: string): slug is LegalDocument {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(slug);
}

export function generateStaticParams(): { slug: LegalDocument }[] {
  return LEGAL_DOCUMENTS.map((slug) => ({ slug }));
}

type LegalPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalDocument(slug)) {
    notFound();
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveRequestLanguage(
    resolvedParams?.lang,
    cookieStore.get(cookieLanguage)?.value
  );
  const doc = copy[lang].legal[slug];

  return buildPublicMetadata({
    lang,
    path: `/legal/${slug}`,
    title: `${doc.title} — Zero Council`,
    description: doc.intro.slice(0, 160),
  });
}

export default async function LegalDocumentPage({ params, searchParams }: LegalPageProps) {
  const { slug } = await params;
  if (!isLegalDocument(slug)) {
    notFound();
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveRequestLanguage(
    resolvedParams?.lang,
    cookieStore.get(cookieLanguage)?.value
  );
  const doc = copy[lang].legal[slug];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Zero Council', path: '/' },
    { name: doc.title, path: `/legal/${slug}` },
  ]);

  return (
    <>
      <script
        id="zc-legal-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <LegalView documentSlug={slug} standalone />
    </>
  );
}
