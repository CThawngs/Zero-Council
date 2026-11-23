import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import PrototypeApp from '@/prototype/App';
import { buildPublicMetadata, resolveRequestLanguage } from '@/lib/seo';
import { buildHomeJsonLd, serializeJsonLd } from '@/lib/seo-jsonld';
import { copy } from '@/prototype/i18n';
import { cookieLanguage } from '@/prototype/types';

type HomePageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveRequestLanguage(
    resolvedParams?.lang,
    cookieStore.get(cookieLanguage)?.value
  );

  return buildPublicMetadata({
    lang,
    path: '/',
    title: copy[lang].documentTitle,
    description: copy[lang].documentDescription,
  });
}

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveRequestLanguage(
    resolvedParams?.lang,
    cookieStore.get(cookieLanguage)?.value
  );
  const jsonLd = buildHomeJsonLd(lang);

  return (
    <>
      <script
        id="zc-home-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PrototypeApp />
    </>
  );
}
