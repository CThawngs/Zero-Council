import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zero Council — AI decision council',
  description:
    'Convene multiple AI advisors — each with a distinct model and perspective — to think through your decision before you commit.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning on <body> as well: browser extensions (Grammarly,
    // read-aloud helpers) inject attributes into <body> before React hydrates,
    // which React reports as a mismatch it cannot patch.
    // No font classNames here: the families are declared with @font-face in globals.css.
    // next/font's `variable` class was the only reason app/fonts.ts existed, and next/font is
    // what made the build depend on a network call.
    <html lang="en" className="h-full dark antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
