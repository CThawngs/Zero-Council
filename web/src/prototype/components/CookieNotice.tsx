import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { legalViewOf } from '../types';
import { Cookie } from 'lucide-react';

/**
 * Consent state, shared by the dialog and the analytics loader.
 *
 * `'granted'` is the only value that loads the tracking script. Anything else — `null` (never
 * asked), `'denied'`, `'settled'` (dismissed for good) — means the site behaves as if analytics
 * did not exist. That default is the whole point: a visitor who closes the dialog without
 * choosing must not be measured, so the loader treats "no answer" and "no" identically.
 */
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

export const writeAnalyticsConsent = (value: AnalyticsConsent): void => {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    /* blocked storage: the choice simply does not persist, and we ask again next visit */
  }
};

/**
 * Loads the analytics script, and only after consent.
 *
 * The script URL is a public build-time variable rather than a hard-coded domain, so pointing the
 * site at a different provider, or at a self-hosted instance, is a change to one environment
 * value instead of an edit to this file.
 *
 * With nothing configured the component renders nothing: a site with no analytics set up must not
 * fail, and must not ship a tracking request to a default third party nobody chose.
 */
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
    script.setAttribute('data-host-url', process.env.NEXT_PUBLIC_ANALYTICS_HOST_URL ?? 'https://cloud.umami.is');
    document.head.appendChild(script);
  }, [consent]);

  return null;
};

/**
 * Consent dialog for non-essential cookies.
 *
 * This replaced a one-way notice that had nothing to consent to. It exists because analytics is
 * now real, and the two choices are real: rejecting leaves the site fully working with no
 * measurement at all. Dismissing without choosing is stored as `'settled'` so the reader is not
 * nagged, and that also means no analytics — silence is treated as a no.
 */
export const CookieNotice: React.FC = () => {
  const { consent, setAnalyticsConsent, setCurrentView, t } = useApp();

  /**
   * Visibility is derived, not stored. `consent === null` means "never answered", which is the
   * only state where the dialog belongs on screen. Deriving it means a decision made anywhere in
   * the tree hides the dialog on the next render with no effect and no second source of truth.
   */
  const visible = consent === null;

  if (!visible) return null;

  const decide = (value: AnalyticsConsent) => {
    writeAnalyticsConsent(value);
    setAnalyticsConsent(value);
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
            <button
              type="button"
              onClick={() => {
                decide('settled');
                setCurrentView(legalViewOf('cookies'));
                window.scrollTo(0, 0);
              }}
              className="font-semibold text-ink underline underline-offset-2 hover:text-brass"
            >
              {t.cookieNoticeLink}
            </button>
          </p>
        </div>

        {/* Two real choices. "Only necessary" is the default-looking one and actually blocks
            measurement, so the two buttons have comparable weight rather than a buried reject. */}
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