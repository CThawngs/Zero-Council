import React from 'react';
import { useApp } from '../context/AppContext';
import { LEGAL_DOCUMENTS, legalViewOf, type LegalDocument } from '../types';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * One renderer for every legal document.
 *
 * The content itself lives in `i18n.ts` beside the rest of the bilingual copy, because a document
 * that is only translated in one language is not a translated document — it is two different
 * contracts depending on which button the reader pressed.
 *
 * Sections marked as draft are rendered with a visible notice rather than quietly published. A
 * legal page full of confident sentences about a company that does not yet exist is worse than
 * one that admits it is a draft: the reader cannot tell which parts are binding.
 */
export const LegalView: React.FC = () => {
  const { currentView, setCurrentView, t } = useApp();

  const document = LEGAL_DOCUMENTS.find(
    (item) => `legal-${item}` === currentView
  ) as LegalDocument | undefined;

  if (!document) return null;

  const copy = t.legal[document];
  const otherDocuments = LEGAL_DOCUMENTS.filter((item) => item !== document);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <article className="min-w-0">
          <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t.back}
          </button>

          <header className="mt-6">
            <p className="eyebrow">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {t.legalEyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">{copy.title}</h1>
          </header>

          {/* The draft banner is deliberately not rendered. Every document still carries
              `draft: true` in `i18n.ts`, so the reader-facing warning is one flip away: delete the
              comment block below to bring it back, or set `draft: false` to retire the flag for
              good once the operator has published its registered details.

              Keeping the flag while hiding the banner means the copy does not claim a status it
              has not earned, without throwing away the flag that documents the real one. */}
          {false && copy.draft ? (
            <p role="note" className="mt-6 rounded-2xl border-2 border-dashed border-[var(--tint-orange)] bg-[var(--tint-orange)]/10 p-4 text-sm font-semibold leading-relaxed text-ink">
              {t.legalDraftNotice}
            </p>
          ) : null}

          <p className="mt-6 text-base leading-relaxed text-ink">{copy.intro}</p>

          <div className="mt-8 space-y-8">
            {copy.sections.map((section) => (
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

          {/* A wrapped flex row with `flex-1` divided the width between seven buttons regardless of
              title length, which squeezed each Vietnamese title down to one or two characters
              per line on a phone. A grid gives every cell the same track, not a share of a
              shrunk row. */}
          <nav className="mt-12 grid gap-2 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={t.legalDocuments}>
            {otherDocuments.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setCurrentView(legalViewOf(item));
                  window.scrollTo(0, 0);
                }}
                className="button-secondary min-h-11 w-full justify-start px-3 py-2 text-left text-xs"
              >
                {t.legal[item].title}
              </button>
            ))}
          </nav>
        </article>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="nav-group-label px-0 pt-0">{t.legalDocuments}</p>
          <nav className="grid gap-1" aria-label={t.legalDocuments}>
            {LEGAL_DOCUMENTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setCurrentView(legalViewOf(item));
                  window.scrollTo(0, 0);
                }}
                className={`sidebar-link ${item === document ? 'sidebar-link-active' : ''}`}
              >
                {t.legal[item].title}
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
};