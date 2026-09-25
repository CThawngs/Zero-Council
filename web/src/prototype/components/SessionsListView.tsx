import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

export const SessionsListView: React.FC = () => {
  const { sessions, setCurrentSessionId, setCurrentView, purgeSessions, t } = useApp();
  const [search, setSearch] = useState('');
  const [isClearOpen, setIsClearOpen] = useState(false);

  const normalizedSearch = search.trim().toLowerCase();
  const frameworkLabel = (framework: (typeof sessions)[number]['framework']) =>
    ({
      'Good / Normal / Bad Scenarios': t.scenarioTitle,
      'Six Thinking Hats': t.hatsTitle,
      'Decision Matrix': t.matrixTitle,
    })[framework];

  const filteredSessions = sessions.filter((session) =>
    [session.title, session.summary, frameworkLabel(session.framework)].some((value) =>
      value.toLowerCase().includes(normalizedSearch)
    )
  );

  const handleOpenSession = (id: string) => {
    setCurrentSessionId(id);
    setCurrentView('session-concluded');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 py-4 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {t.sessionsEyebrow}
          </p>
          <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{t.sessionsTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t.sessionsBody}</p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('empty-chamber')}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.new}
        </button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <label htmlFor="session-search" className="sr-only">
            {t.sessionsTitle}
          </label>
          <input
            id="session-search"
            name="session-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
        </div>
        {sessions.length > 0 && (
          <button
            type="button"
            onClick={() => setIsClearOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-terracotta transition hover:bg-terracotta/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t.clear}
          </button>
        )}
      </div>

      {filteredSessions.length === 0 ? (
        <section
          className="rounded-2xl border border-border bg-surface px-5 py-12 text-center"
          aria-live="polite"
        >
          <FileText className="mx-auto h-9 w-9 text-ink-muted" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-2xl text-ink">{t.emptySessionsTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            {t.emptySessionsBody}
          </p>
          <button
            type="button"
            onClick={() => setCurrentView('empty-chamber')}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brass px-5 py-3 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.create}
          </button>
        </section>
      ) : (
        <ul className="grid gap-4" aria-label={t.sessionsTitle}>
          {filteredSessions.map((session) => {
            const titleId = `sample-session-${session.id}`;
            return (
              <li key={session.id}>
                <article
                  className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 transition hover:border-brass/45 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                  aria-labelledby={titleId}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-brass">
                        {t.fixture}
                      </span>
                      <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-ink-muted">
                        {frameworkLabel(session.framework)}
                      </span>
                    </div>
                    <h2 id={titleId} className="mt-3 break-words font-serif text-xl text-ink">
                      {session.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                      {session.summary}
                    </p>
                    {session.advisors.length > 0 && (
                      <div className="mt-4 flex -space-x-1.5" aria-hidden="true">
                        {session.advisors.slice(0, 4).map((advisor) => (
                          <span
                            key={advisor.id}
                            className="h-6 w-6 rounded-full border-2 border-surface"
                            style={{ backgroundColor: advisor.colorHex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenSession(session.id)}
                    className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brass/50 hover:bg-brass hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
                  >
                    {t.preview}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      <Modal
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title={t.clear}
        description={t.clearConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button type="button" onClick={() => setIsClearOpen(false)} className="button-secondary min-h-11 justify-center">{t.cancel}</button>
            <button type="button" onClick={() => { setIsClearOpen(false); purgeSessions(); }} className="button-danger min-h-11 justify-center">{t.clear}</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearConfirm}</p>
      </Modal>
    </div>
  );
};
