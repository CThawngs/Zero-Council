import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zero Council — AI decision council',
  description:
    'Convene multiple AI advisors — each with a distinct model and perspective — to think through your decision before you commit.',
  // Chrome's translate bar reads this. The app ships its own English/Vietnamese (see i18n.ts), and
  // machine translation rewrites text nodes that React is still holding, which crashes it with
  // "Failed to execute 'removeChild' on 'Node'" the next time that text changes.
  other: { google: 'notranslate' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning on <html> as well as <body>: browser extensions
    // (Grammarly, read-aloud helpers) inject attributes before React hydrates,
    // and this script now writes `data-theme` onto <html> too.
    // No font classNames here: the families are declared with @font-face in globals.css.
    // next/font's `variable` class was the only reason app/fonts.ts existed, and next/font is
    // what made the build depend on a network call.
    // `dark` is deliberately absent: the theme is driven by [data-theme='dark']
    // in globals.css, and pinning the class here would make it un-switchable.
 feature/council-complete-sync
    <html lang="en" translate="no" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
 main
        {/*
          Runs synchronously before first paint so a dark-theme visitor never sees a white flash.
          dangerouslySetInnerHTML in <head> guarantees execution prior to rendering <body>.
        */}
        <script
          id="zc-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}