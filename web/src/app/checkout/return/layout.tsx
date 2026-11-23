import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { buildNoIndexMetadata, resolveRequestLanguage } from '@/lib/seo';
import { copy } from '@/prototype/i18n';
import { cookieLanguage } from '@/prototype/types';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = resolveRequestLanguage(null, cookieStore.get(cookieLanguage)?.value);
  return buildNoIndexMetadata({
    title: copy[language].paymentReturnTitle,
  });
}

export default function CheckoutReturnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
