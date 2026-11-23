'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { THEME_BOOTSTRAP_SCRIPT } from '@/prototype/theme';

const GLOBAL_ERROR_COPY = {
  en: {
    badge: 'System Recovery',
    title: 'Zero Council encountered an unexpected error.',
    description:
      'A critical layout error interrupted the page. Try reloading the application or return directly to the home page.',
    retryCta: 'Try again',
    homeCta: 'Back to Home',
    digestLabel: 'Reference',
  },
  vi: {
    badge: 'Kh\u00f4i ph\u1ee5c h\u1ec7 th\u1ed1ng',
    title: 'Zero Council g\u1eb7p s\u1ef1 c\u1ed1 ngo\u00e0i \u00fd mu\u1ed1n.',
    description:
      'M\u1ed9t l\u1ed7i nghi\u00eam tr\u1ecdng \u0111\u00e3 l\u00e0m gi\u00e1n \u0111o\u1ea1n giao di\u1ec7n. H\u00e3y th\u1eed t\u1ea3i l\u1ea1i \u1ee9ng d\u1ee5ng ho\u1eb7c quay v\u1ec1 trang ch\u1ee7.',
    retryCta: 'Th\u1eed l\u1ea1i',
    homeCta: 'V\u1ec1 trang ch\u1ee7',
    digestLabel: 'M\u00e3 tham chi\u1ebfu',
  },
} as const;

const FALLBACK_STYLES = `
:root {
  color-scheme: light;
  --zc-bg: #ffffff;
  --zc-surface: #ffffff;
  --zc-surface-2: #f5f5f8;
  --zc-border: #e7e7ef;
  --zc-ink: #101018;
  --zc-muted: #5c5c6e;
  --zc-accent: #5b4bf0;
  --zc-accent-ink: #ffffff;
}
[data-theme='dark'] {
  color-scheme: dark;
  --zc-bg: #0c0c12;
  --zc-surface: #15151d;
  --zc-surface-2: #1d1d27;
  --zc-border: #2a2a36;
  --zc-ink: #f4f4f7;
  --zc-muted: #a0a0b2;
  --zc-accent: #988cff;
  --zc-accent-ink: #0c0c12;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  min-height: 100dvh;
  background: var(--zc-bg);
  color: var(--zc-ink);
  font-family: ui-rounded, "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.zc-ge-shell {
  min-height: 100dvh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}
.zc-ge-card {
  width: 100%;
  max-width: 32rem;
  border-radius: 1.5rem;
  border: 1px solid var(--zc-border);
  background: var(--zc-surface);
  padding: 2rem 1.5rem;
}
.zc-ge-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--zc-border);
  background: var(--zc-surface-2);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--zc-accent);
  margin-bottom: 1rem;
}
.zc-ge-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--zc-accent);
}
.zc-ge-title {
  margin: 0;
  font-size: 1.625rem;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--zc-ink);
}
.zc-ge-desc {
  margin: 0.75rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--zc-muted);
}
.zc-ge-digest {
  margin: 1rem 0 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--zc-border);
  background: var(--zc-surface-2);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.75rem;
  color: var(--zc-muted);
  word-break: break-all;
}
.zc-ge-actions {
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.zc-ge-btn-primary, .zc-ge-btn-secondary {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  text-decoration: none;
  cursor: pointer;
  flex: 1 1 auto;
  text-align: center;
}
.zc-ge-btn-primary {
  border: 0;
  background: var(--zc-accent);
  color: var(--zc-accent-ink);
  font-weight: 700;
}
.zc-ge-btn-secondary {
  border: 1px solid var(--zc-border);
  background: var(--zc-surface-2);
  color: var(--zc-ink);
  font-weight: 600;
}
`;

const subscribePreferredLang = () => () => undefined;

const getClientPreferredLang = (): 'en' | 'vi' => {
  if (typeof document !== 'undefined') {
    if (document.documentElement.lang === 'vi') return 'vi';
    try {
      const stored = window.localStorage.getItem('zc-lang');
      if (stored === 'vi') return 'vi';
    } catch {
      // Ignore storage access errors in restricted browsing contexts.
    }
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('vi')) {
      return 'vi';
    }
  }
  return 'en';
};

const getServerPreferredLang = (): 'en' | 'vi' => 'en';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = useSyncExternalStore(
    subscribePreferredLang,
    getClientPreferredLang,
    getServerPreferredLang
  );
  const text = GLOBAL_ERROR_COPY[lang];

  useEffect(() => {
    console.error('[app/global-error] Caught fatal error:', error.digest ?? error.message);
  }, [error]);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Zero Council</title>
        <script
          id="zc-global-error-theme"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <style dangerouslySetInnerHTML={{ __html: FALLBACK_STYLES }} />
      </head>
      <body>
        <main className="zc-ge-shell">
          <section role="alert" aria-labelledby="zc-global-error-title" className="zc-ge-card">
            <div className="zc-ge-badge">
              <span aria-hidden="true" className="zc-ge-dot" />
              <span>Zero Council</span>
              <span aria-hidden="true">&middot;</span>
              <span>{text.badge}</span>
            </div>

            <h1 id="zc-global-error-title" className="zc-ge-title">
              {text.title}
            </h1>

            <p className="zc-ge-desc">{text.description}</p>

            {error.digest ? (
              <p className="zc-ge-digest">
                {text.digestLabel}: {error.digest}
              </p>
            ) : null}

            <div className="zc-ge-actions">
              <button type="button" onClick={() => reset()} className="zc-ge-btn-primary">
                {text.retryCta}
              </button>
              <Link href="/" className="zc-ge-btn-secondary">
                {text.homeCta}
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}