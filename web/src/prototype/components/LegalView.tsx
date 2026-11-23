'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LEGAL_DOCUMENTS, type LegalDocument } from '../types';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toast } from './Toast';
import { AnalyticsLoader, CookieNotice } from './CookieNotice';

interface LegalViewProps {
  documentSlug?: LegalDocument;
  standalone?: boolean;
}

export const LegalView: React.FC<LegalViewProps> = ({ documentSlug, standalone = false }) => {
  const { currentView, setCurrentView, language, t } = useApp();

  const activeDoc =
    documentSlug ??
    (LEGAL_DOCUMENTS.find((item) => `legal-${item}` === currentView) as LegalDocument | undefined);

  useEffect(() => {
    if (!standalone || !activeDoc) return;
    const docCopy = t.legal[activeDoc];
    const applyMeta = () => {
      window.document.title = `${docCopy.title} — Zero Council`;
      window.document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', docCopy.intro.slice(0, 160));
    };
    applyMeta();
    const timer = window.setTimeout(applyMeta, 0);
    return () => window.clearTimeout(timer);
  }, [standalone, activeDoc, language, t]);

  if (!activeDoc) return null;

  const docCopy = t.legal[activeDoc];
  const otherDocuments = LEGAL_DOCUMENTS.filter((item) => item !== activeDoc);

  const content = (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <article className="min-w-0">
          {standalone ? (
            <Link
              href="/"
              onClick={() => {
                try {
                  sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
                } catch {}
              }}
              className="button-quiet -ml-3"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t.back}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentView('overview')}
              className="button-quiet -ml-3"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t.back}
            </button>
          )}

          <header className="mt-6">
            <p className="eyebrow">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {t.legalEyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">{docCopy.title}</h1>
          </header>

          {false && docCopy.draft ? (
            <p
              role="note"
              className="mt-6 rounded-2xl border-2 border-dashed border-[var(--tint-orange)] bg-[var(--tint-orange)]/10 p-4 text-sm font-semibold leading-relaxed text-ink"
            >
              {t.legalDraftNotice}
            </p>
          ) : null}

          <p className="mt-6 text-base leading-relaxed text-ink">{docCopy.intro}</p>

          <div className="mt-8 space-y-8">
            {docCopy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-extrabold text-ink">{section.heading}</h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((paragraph, index) => (
                    <p key={index} className="text-sm leading-relaxed text-ink-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <nav
            className="mt-12 grid gap-2 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={t.legalDocuments}
          >
            {otherDocuments.map((item) => (
              <Link
                key={item}
                href={`/legal/${item}`}
                className="button-secondary min-h-11 w-full justify-start px-3 py-2 text-left text-xs"
              >
                {t.legal[item].title}
              </Link>
            ))}
          </nav>
        </article>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="nav-group-label px-0 pt-0">{t.legalDocuments}</p>
          <nav className="grid gap-1" aria-label={t.legalDocuments}>
            {LEGAL_DOCUMENTS.map((item) => (
              <Link
                key={item}
                href={`/legal/${item}`}
                aria-current={item === activeDoc ? 'page' : undefined}
                className={`sidebar-link ${item === activeDoc ? 'sidebar-link-active' : ''}`}
              >
                {t.legal[item].title}
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );

  if (!standalone) {
    return content;
  }

  return (
    <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>
      <Header isWorkspace={false} />
      <div className="flex min-h-screen flex-1 pt-[76px]">
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9"
        >
          {content}
        </main>
      </div>
      <Footer />
      <Toast />
      <CookieNotice />
      <AnalyticsLoader />
      <span className="sr-only" aria-live="polite">
        {t.localBadge}
      </span>
    </div>
  );
};
