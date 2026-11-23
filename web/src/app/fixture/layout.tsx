import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { copy } from '@/prototype/i18n';
import { cookieLanguage } from '@/prototype/types';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = cookieStore.get(cookieLanguage)?.value === 'vi' ? 'vi' : 'en';
  return {
    title: copy[language].fixturePageTitle,
    description: copy[language].fixtureDescription,
  };
}

export default function FixtureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
