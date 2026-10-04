import { Inter, Literata } from 'next/font/google';

// next/font downloads Literata/Inter at build time and self-hosts them, so the
// runtime makes no request to fonts.googleapis.com — same fonts as the
// Google Fonts CSS import, without the external dependency. The `vietnamese`
// subset is required: without it the browser falls back per-glyph.
export const sans = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
});

// Fraunces was replaced by Literata: Fraunces is a wonky display serif whose
// strokes collide on Vietnamese stacked diacritics (ậ / ễ / ở). Literata is
// designed for multilingual reading and covers the Vietnamese subset cleanly.
export const serif = Literata({
  subsets: ['latin', 'vietnamese'],
  weight: ['400','500', '600'],
  display: 'swap',
  variable: '--font-literata',
});
