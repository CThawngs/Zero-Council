import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, Eye, Layers3, ShieldCheck, UsersRound } from 'lucide-react';
import { modelLabel, providerLabel } from '../data/mockData';

export const SessionActiveView: React.FC = () => {
  const { currentSession, setCurrentView, openFrameworkModal, t, language } = useApp();
  const frameworkLabel = {
    'Good / Normal / Bad Scenarios': t.scenarioTitle,
    'Six Thinking Hats': t.hatsTitle,
    'Decision Matrix': t.matrixTitle,
  }[currentSession.framework];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-4 sm:py-8">
      <header className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brass">
              <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
              {t.activeEyebrow}
              <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-ink-muted">
                {t.fixtureOutput}
              </span>
            </p>
            <h1 className="mt-3 break-words font-serif text-2xl leading-snug text-ink sm:text-3xl">
              {currentSession.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t.activeBody}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:shrink-0">
            <button
              type="button"
              onClick={openFrameworkModal}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brass/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass lg:flex-none"
            >
              <Layers3 className="h-4 w-4 text-brass" aria-hidden="true" />
              <span className="truncate">{frameworkLabel}</span>
              <span className="text-xs text-ink-muted">{t.change}</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('session-concluded')}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass lg:flex-none"
            >
              {t.conclude}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-4" aria-labelledby="composition-title">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-brass" aria-hidden="true" />
          <h2 id="composition-title" className="font-serif text-2xl text-ink">
            {t.composition}
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentSession.advisors.map((advisor) => (
            <li key={advisor.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: advisor.colorHex }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h3 className="font-medium text-ink">{advisor.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{advisor.stance}</p>
                  <p className="mt-2 text-[11px] text-ink-muted">
                    {advisor ? `${modelLabel(advisor.model, language)} · ${providerLabel(advisor.provider, language)}` : t.modelLabel}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="perspectives-title">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-brass" aria-hidden="true" />
          <h2 id="perspectives-title" className="font-serif text-2xl text-ink">
            {t.perspectives}
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {currentSession.testimonies.map((testimony) => {
            const advisor = currentSession.advisors.find((item) => item.id === testimony.advisorId);
            return (
              <article key={testimony.advisorId} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-ink">{testimony.heading}</h3>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {advisor ? `${modelLabel(advisor.model, language)} · ${providerLabel(advisor.provider, language)}` : t.modelLabel}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-brass">
                    {t.fixture}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink">{testimony.primaryText}</p>
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">{testimony.secondaryText}</p>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-xl border border-sage/35 bg-sage/10 p-4 text-sm leading-relaxed text-ink-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
        {t.synthetic}
      </aside>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCurrentView('session-concluded')}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass px-5 py-3 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
        >
          {t.conclude}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
