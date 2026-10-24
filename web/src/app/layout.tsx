import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zero Council — AI decision council',
  description:
    'Convene multiple AI advisors — each with a distinct model and perspective — to think through your decision before you commit.',
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
    <html lang="en" translate="no" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        {/*
          Runs before first paint so a dark-theme visitor never sees a white flash.

          This must be `next/script`, NOT a bare `<script>` element. React does not execute a
          script tag it renders, on the client or during hydration — it logs "Encountered a script
          tag while rendering React component" and the theme is never applied before paint. That
          is the whole purpose of this line, so the warning is not cosmetic: a bare tag silently
          breaks the thing it was written for.

          `beforeInteractive` is the strategy that does run before hydration, and Next requires
          this exact placement — the root layout — and injects it into <head> itself. Writing our
          own <head> here instead is not an option: the App Router renders it into the document,
          the HTML parser relocates the node, and hydration then fails for the entire tree, which
          shows up as a page that looks alive and is completely inert.
        */}
        <Script id="zc-theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}