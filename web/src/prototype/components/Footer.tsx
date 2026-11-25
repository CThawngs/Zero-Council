'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import { CouncilOrb } from './CouncilOrb';
import { LEGAL_DOCUMENTS } from '../types';

export const Footer: React.FC = () => {
  const { setCurrentView, openFirstBotOrWizard, language, t } = useApp();
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

          <nav className="grid gap-6 sm:grid-cols-2 md:gap-10" aria-label={t.footerNavigation}>
            <div>
              <p className="nav-group-label px-0 pt-0">{t.footerProduct}</p>
              <ul className="grid gap-0.5">
                <li>
                  <Link
                    href="/"
                    onClick={() => {
                      try {
                        sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
                      } catch {}
                      setCurrentView('overview');
                    }}
                    className="footer-link inline-flex items-center"
                  >
                    {t.footerOverview}
                  </Link>
                </li>
                <li>
                  <Link href="/guide" className="footer-link inline-flex items-center">
                    {t.navGuide}
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      openFirstBotOrWizard();
                      window.scrollTo(0, 0);
                    }}
                    className="footer-link"
                  >
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
                    <Link
                      href={`/legal/${document}`}
                      className="footer-link inline-flex items-center"
                    >
                      {t.legal[document].title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <p className="max-w-3xl leading-relaxed">{t.footerDisclaimer}</p>

        <p className="border-t border-border/70 pt-4">© 2026 {labels.brand}.</p>
      </div>
    </footer>
  );
};
