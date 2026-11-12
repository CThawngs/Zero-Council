import type { Metadata } from 'next';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';
import './globals.css';

import { cookies } from 'next/headers';
import { AppProvider } from '@/prototype/context/AppContext';
import { createClient } from '@/lib/supabase/server';
import { hasPasswordClaim } from '@/lib/auth-password';
import { redirect } from 'next/navigation';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  const language = cookieStore.get('zc-lang')?.value === 'vi' ? 'vi' : 'en';

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  // A returning signed-in user (session cookie survived the browser close) is
  // mounted straight into the dashboard, never shown the marketing landing.
  // Google-only accounts without a password must create one first.
  if (user?.email) {
    if (!hasPasswordClaim(user)) {
      redirect("/auth");
    }

    return (
      <html lang={language} suppressHydrationWarning>
        <head>
        {/*
          Runs synchronously before first paint so a dark-theme visitor never sees a white flash.
          dangerouslySetInnerHTML in <head> guarantees execution prior to rendering <body>.
        */}
        <script
          id="zc-theme-bootstrap"
          dangerouslySetInnerHTML={{
            __html: THEME_BOOTSTRAP_SCRIPT,
          }}
        />
      </head>
        <body suppressHydrationWarning>
          <AppProvider
          initialLanguage={language}
          initialAuthUser={{ id: user.id, email: user.email?.trim().toLowerCase() }}>
            {children}
          </AppProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <script
          id="zc-theme-bootstrap"
          dangerouslySetInnerHTML={{
            __html: THEME_BOOTSTRAP_SCRIPT,
          }}
        />
      </head>
      <body suppressHydrationWarning>
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