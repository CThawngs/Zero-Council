import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { sans, serif } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zero Council — Deliberation workspace',
  description: 'A bilingual deliberation workspace that structures hard decisions and keeps judgment with the people making them.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full dark antialiased`} suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
