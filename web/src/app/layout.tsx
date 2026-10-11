import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        {/* Runs before first paint so a dark-theme visitor never sees a white
            flash. Kept inline and dependency-free on purpose.

            This MUST stay the first child of <body> and must NOT be wrapped in
            a <head> element. The App Router forbids <head> here: React renders
            it into the document, the HTML parser relocates the node, and the
            hydration pass then fails for the ENTIRE tree. When that happens
            every button on the page keeps its server HTML but loses its React
            handler, so nothing is clickable and no error is printed — the
            symptom is a page that looks alive and is completely inert. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}