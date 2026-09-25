import { Fraunces, Inter } from 'next/font/google';

// Vietnamese diacritics need the `vietnamese` subset; without it the browser
// falls back per-glyph and headings render in Georgia, which handles them poorly.
export const sans = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

export const serif = Fraunces({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-fraunces',
});
