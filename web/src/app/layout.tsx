import type { Metadata } from 'next';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';
import './globals.css';

import { cookies } from 'next/headers';
import { AppProvider } from '@/prototype/context/AppContext';
import { createClient } from '@/lib/supabase/server';
import { hasPasswordClaim } from '@/lib/auth-password';
import { devLoginEmail, isSupabaseServerConfigured } from '@/lib/devAuth';
import { redirect } from 'next/navigation';
import { cookieLanguage } from '@/prototype/types';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const language = cookieStore.get(cookieLanguage)?.value === 'vi' ? 'vi' : 'en';

  let initialAuthUser: { id: string; email: string } | undefined;
  const devEmail = devLoginEmail();

  if (devEmail) {
    initialAuthUser = { id: devEmail, email: devEmail };
  } else if (isSupabaseServerConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        if (!hasPasswordClaim(user)) {
          redirect('/auth');
        }
        initialAuthUser = { id: user.id, email: user.email.trim().toLowerCase() };
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'digest' in error &&
        typeof (error as { digest?: unknown }).digest === 'string' &&
        (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
      ) {
        throw error;
      }
    }
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
        {initialAuthUser?.email && (
          <script
            id="zc-tab-guard"
            dangerouslySetInnerHTML={{
              __html: `try{var p=window.location.pathname;if(p==='/'||p===''){var k='zc:initial-dashboard-redirect';if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'true');document.documentElement.style.visibility='hidden';window.location.replace('/dashboard');window.addEventListener('pageshow',function(){document.documentElement.style.visibility=''});setTimeout(function(){document.documentElement.style.visibility=''},2000)}}}catch(e){}`,
            }}
          />
        )}
      </head>
      <body suppressHydrationWarning>
        <AppProvider initialLanguage={language} initialAuthUser={initialAuthUser}>
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
  other: { google: 'notranslate' },
};
