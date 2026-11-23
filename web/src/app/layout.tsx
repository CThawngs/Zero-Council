import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';
import './globals.css';
import { AppProvider } from '@/prototype/context/AppContext';
import { createClient } from '@/lib/supabase/server';
import { hasPasswordClaim } from '@/lib/auth-password';
import { devLoginEmail, isSupabaseServerConfigured } from '@/lib/devAuth';
import { canAccessWithoutPasswordClaim } from '@/lib/supabase/proxy';
import { SITE_NAME, getSiteUrl, resolveRequestLanguage } from '@/lib/seo';
import { cookieLanguage } from '@/prototype/types';
import { copy } from '@/prototype/i18n';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c12' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const pathname = headerStore.get('x-zc-pathname') ?? '';
  const language = resolveRequestLanguage(null, cookieStore.get(cookieLanguage)?.value);

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
        if (!hasPasswordClaim(user) && !canAccessWithoutPasswordClaim(pathname)) {
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

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = resolveRequestLanguage(null, cookieStore.get(cookieLanguage)?.value);
  const title = copy[language].documentTitle;
  const description = copy[language].documentDescription;
  const locale = language === 'vi' ? 'vi_VN' : 'en_US';

  return {
    metadataBase: new URL(getSiteUrl()),
    applicationName: SITE_NAME,
    title,
    description,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale,
      title,
      description,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — Multi-Agent BYOK AI Workspace`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-image'],
    },
    other: { google: 'notranslate' },
  };
}
