import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';
import './globals.css';

import { cookies } from 'next/headers';
import { AppProvider } from '@/prototype/context/AppContext';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  const language = cookieStore.get('zc-lang')?.value === 'vi' ? 'vi' : 'en';

  return (
    <html lang={language}>
      <body>
        <AppProvider initialLanguage={language}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: 'Zero Council — AI decision council',
  description:
    'Convene multiple AI advisors — each with a distinct model and perspective — to think through your decision before you commit.',
  // Chrome's translate bar reads this. The app ships its own English/Vietnamese (see i18n.ts), and
  // machine translation rewrites text nodes that React is still holding, which crashes it with
  // "Failed to execute 'removeChild' on 'Node'" the next time that text changes.
  other: { google: 'notranslate' },
};