'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext';
import { Cookie } from 'lucide-react';

export const ANALYTICS_CONSENT_KEY = 'zc-analytics-consent';

export type AnalyticsConsent = 'granted' | 'denied' | 'settled';

export const readAnalyticsConsent = (): AnalyticsConsent | null => {
  try {
    const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return stored === 'granted' || stored === 'denied' || stored === 'settled' ? stored : null;
  } catch {
    return null;
  }
};

export const getServerAnalyticsConsent = (): AnalyticsConsent | null => null;

const analyticsConsentListeners = new Set<() => void>();

const emitAnalyticsConsentChange = () => {
  for (const listener of analyticsConsentListeners) listener();
};

export const subscribeAnalyticsConsent = (onStoreChange: () => void): (() => void) => {
  analyticsConsentListeners.add(onStoreChange);
  const onExternalChange = (event: StorageEvent) => {
    if (event.key === ANALYTICS_CONSENT_KEY) onStoreChange();
  };
  window.addEventListener('storage', onExternalChange);
  return () => {
    analyticsConsentListeners.delete(onStoreChange);
    window.removeEventListener('storage', onExternalChange);
  };
};

export const writeAnalyticsConsent = (value: AnalyticsConsent): void => {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    /* blocked storage: the choice simply does not persist, and we ask again next visit */
  }
  emitAnalyticsConsentChange();
};

export const AnalyticsLoader: React.FC = () => {
  const { consent } = useApp();

  useEffect(() => {
    if (consent !== 'granted') return;
    const scriptUrl = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL;
    const websiteId = process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID;
    if (!scriptUrl || !websiteId) return;
    if (document.querySelector('script[data-zc-analytics]')) return;

    const script = document.createElement('script');
    script.defer = true;
    script.dataset.zcAnalytics = 'true';
    script.src = scriptUrl;
    script.setAttribute('data-website-id', websiteId);
    script.setAttribute(
      'data-host-url',
      process.env.NEXT_PUBLIC_ANALYTICS_HOST_URL ?? 'https://cloud.umami.is'
    );
    document.head.appendChild(script);
  }, [consent]);

  return null;
};

export const CookieNotice: React.FC = () => {
  const { consent, t } = useApp();

  const visible = consent === null;

  if (!visible) return null;

  const decide = (value: AnalyticsConsent) => {
    writeAnalyticsConsent(value);
  };

  return (
    <div
      role="region"
      aria-label={t.cookieNoticeTitle}
      className="fixed inset-x-0 bottom-0 z-[55] px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="flex gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-brass" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
            {t.cookieNoticeBody}{' '}
            <Link
              href="/legal/cookies"
              onClick={() => decide('settled')}
              className="font-semibold text-ink underline underline-offset-2 hover:text-brass"
            >
              {t.cookieNoticeLink}
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => decide('denied')}
            className="button-secondary min-h-10 px-4 text-xs"
          >
            {t.cookieNoticeNecessaryOnly}
          </button>
          <button
            type="button"
            onClick={() => decide('granted')}
            className="button-primary min-h-10 px-4 text-xs"
          >
            {t.cookieNoticeAccept}
          </button>
        </div>
      </div>
    </div>
  );
};
