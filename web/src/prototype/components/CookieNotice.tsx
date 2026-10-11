import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { legalViewOf } from '../types';
import { Cookie } from 'lucide-react';

const ACKNOWLEDGED_KEY = 'zc-cookie-notice';

/**
 * One-way cookie notice.
 *
 * No accept / reject buttons, on purpose. Every cookie this site sets is strictly necessary —
 * the session cookie from the auth provider, `zc-lang` and `zc-theme`. There is nothing to
 * consent to, and a dialog offering a choice it cannot honour ("accept all") teaches readers that
 * the prompt was theatre.
 *
 * The notice disappears once, permanently, in this browser. When analytics or advertising are
 * ever added, this component has to become a real consent dialog with per-category choices, and
 * non-essential cookies must stay switched off until the visitor actually accepts them.
 */
export const CookieNotice: React.FC = () => {
  const { setCurrentView, t } = useApp();

  // Read the acknowledgement during the first render rather than in an effect. An effect that
  // flips state on mount makes the notice appear a frame late, and React's compiler rule rejects
  // the pattern outright. A blocked store throws `false`, which just means the notice shows.
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(ACKNOWLEDGED_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const acknowledge = () => {
    try {
      localStorage.setItem(ACKNOWLEDGED_KEY, '1');
    } catch {
      /* the notice will show again next time; not worth breaking the page over */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t.cookieNoticeTitle}
      className="fixed inset-x-0 bottom-0 z-[55] px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <Cookie className="h-5 w-5 shrink-0 text-brass" aria-hidden="true" />

        <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
          {/* The claim has to match the code: no analytics, no advertising, nothing to opt out of. */}
          {t.cookieNoticeBody}{' '}
          <button
            type="button"
            onClick={() => {
              acknowledge();
              setCurrentView(legalViewOf('cookies'));
              window.scrollTo(0, 0);
            }}
            className="font-semibold text-ink underline underline-offset-2 hover:text-brass"
          >
            {t.cookieNoticeLink}
          </button>
        </p>

        <button type="button" onClick={acknowledge} className="button-secondary min-h-10 shrink-0 px-4">
          {t.cookieNoticeDismiss}
        </button>
      </div>
    </div>
  );
};