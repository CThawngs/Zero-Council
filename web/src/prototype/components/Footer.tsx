import React from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import { CouncilOrb } from './CouncilOrb';
import { LEGAL_DOCUMENTS, legalViewOf } from '../types';

export const Footer: React.FC = () => {
  const { setCurrentView, language, t } = useApp();
  const labels = translations[language];

  const go = (view: Parameters<typeof setCurrentView>[0]) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  return (
    <footer className="border-t border-border/70 bg-surface/25">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-10 text-[11px] text-ink-muted sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="brand-mark">
                <CouncilOrb />
              </span>
              <span className="text-base font-extrabold tracking-tight text-ink">{labels.brand}</span>
            </div>
            <p className="mt-2.5 leading-relaxed">{labels.tagline}</p>
          </div>

          {/* Grouped so the reader can tell a product destination from a legal one. A flat row of
              seven identical links reads as noise and hides the terms that matter. */}
          <nav className="grid gap-6 sm:grid-cols-2 md:gap-10" aria-label={t.footerNavigation}>
            <div>
              <p className="nav-group-label px-0 pt-0">{t.footerProduct}</p>
              <ul className="grid gap-0.5">
                <li>
                  <button type="button" onClick={() => go('overview')} className="footer-link">
                    {t.footerOverview}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => go('empty-chamber')} className="footer-link">
                    {labels.nav.newDeliberation}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => go('sessions')} className="footer-link">
                    {labels.nav.sessions}
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="nav-group-label px-0 pt-0">{t.legalDocuments}</p>
              <ul className="grid gap-0.5">
                {LEGAL_DOCUMENTS.map((document) => (
                  <li key={document}>
                    <button
                      type="button"
                      onClick={() => go(legalViewOf(document))}
                      className="footer-link"
                    >
                      {t.legal[document].title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        {/* The disclaimer is not decoration: it is the one sentence that tells a reader the
            output is not professional advice, and burying it makes the whole site misleading. */}
        <p className="max-w-3xl leading-relaxed">{t.footerDisclaimer}</p>

        <p className="border-t border-border/70 pt-4">© 2026 {labels.brand}.</p>
      </div>
    </footer>
  );
};