'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';

const ERROR_COPY = {
  en: {
    badge: 'Session Interrupted',
    title: 'Something interrupted this view.',
    description:
      'Your saved API keys, council bots, and conversations remain safe. Try loading this screen again or return to the home page.',
    retryCta: 'Try again',
    homeCta: 'Back to Home',
    digestLabel: 'Reference',
  },
  vi: {
    badge: 'Gi\u00e1n \u0111o\u1ea1n hi\u1ec3n th\u1ecb',
    title: 'Phi\u00ean hi\u1ec3n th\u1ecb g\u1eb7p s\u1ef1 c\u1ed1 ngo\u00e0i \u00fd mu\u1ed1n.',
    description:
      'Kh\u00f3a API, bot h\u1ed9i \u0111\u1ed3ng v\u00e0 l\u1ecbch s\u1eed h\u1ed9i tho\u1ea1i c\u1ee7a b\u1ea1n v\u1eabn an to\u00e0n. H\u00e3y th\u1eed t\u1ea3i l\u1ea1i ho\u1eb7c quay v\u1ec1 trang ch\u1ee7.',
    retryCta: 'Th\u1eed l\u1ea1i',
    homeCta: 'V\u1ec1 trang ch\u1ee7',
    digestLabel: 'M\u00e3 tham chi\u1ebfu',
  },
} as const;

const subscribeHtmlLang = (onStoreChange: () => void) => {
  if (typeof document === 'undefined') return () => undefined;
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  });
  return () => observer.disconnect();
};

const getClientLang = (): 'en' | 'vi' =>
  typeof document !== 'undefined' && document.documentElement.lang === 'vi' ? 'vi' : 'en';

const getServerLang = (): 'en' | 'vi' => 'en';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = useSyncExternalStore(subscribeHtmlLang, getClientLang, getServerLang);
  const text = ERROR_COPY[lang];

  useEffect(() => {
    console.error('[app/error] Caught runtime error:', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-12 text-ink">
      <section
        role="alert"
        aria-labelledby="zc-error-title"
        className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          <span>Zero Council</span>
          <span aria-hidden="true">&middot;</span>
          <span>{text.badge}</span>
        </div>

        <h1
          id="zc-error-title"
          className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
        >
          {text.title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
          {text.description}
        </p>

        {error.digest ? (
          <p className="mt-4 break-all rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-ink-muted">
            {text.digestLabel}: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-center text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
          >
            {text.retryCta}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-2 px-5 py-2.5 text-center text-sm font-semibold text-ink transition-colors hover:bg-background"
          >
            {text.homeCta}
          </Link>
        </div>
      </section>
    </main>
  );
}