import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import {
  ArrowRight,
  Copy,
  FilePenLine,
  Layers3,
  ListChecks,
  Quote,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';

export const SessionConcludedView: React.FC = () => {
  const {
    currentSession,
    openFrameworkModal,
    openCounterDraftModal,
    showToast,
    t,
    language,
  } = useApp();
  const [isCopying, setIsCopying] = useState(false);

  const frameworkLabel = {
    'Good / Normal / Bad Scenarios': t.scenarioTitle,
    'Six Thinking Hats': t.hatsTitle,
    'Decision Matrix': t.matrixTitle,
  }[currentSession.framework];

  const handleCopySummary = async () => {
    const text = [
      `${t.concludedTitle}: ${currentSession.title}`,
      `${t.sampleOutputLabel}: ${currentSession.synthesis.coreOutput}`,
      `${t.conditions}:`,
      ...currentSession.synthesis.stipulations.map((item) => `- ${item}`),
      `${t.nextStep}: ${currentSession.synthesis.nextAction}`,
      t.adviceWarning,
    ].join('\n');

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      showToast('toastCopied');
    } catch {
      showToast('toastCopyFailed');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-4 sm:py-8">
      <header className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
              {t.concludedEyebrow}
            </p>
            <h1 className="mt-3 break-words font-serif text-2xl leading-snug text-ink sm:text-3xl">
              {currentSession.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t.concludedBody}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:shrink-0">
            <button
              type="button"
              onClick={openFrameworkModal}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brass/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass lg:flex-none"
            >
              <Layers3 className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <span className="min-w-0 truncate">{frameworkLabel}</span>
            </button>
            <button
              type="button"
              onClick={openCounterDraftModal}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brass/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass lg:flex-none"
            >
              <FilePenLine className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              {t.sampleDraft}
            </button>
          </div>
        </div>
      </header>

      <aside
        className="flex items-start gap-3 rounded-xl border border-terracotta/40 bg-terracotta/10 p-4 text-sm leading-relaxed text-ink"
        role="note"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden="true" />
        {t.adviceWarning}
      </aside>

      <section className="overflow-hidden rounded-2xl border-2 border-brass/45 bg-surface shadow-sm">
        <div className="h-1 bg-brass" aria-hidden="true" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
                {t.framing}
              </p>
              <h2 className="mt-2 font-serif text-2xl text-ink">{t.concludedTitle}</h2>
            </div>
            <span className="self-start rounded-md border border-brass/35 bg-background px-2.5 py-1 text-xs text-brass">
              {t.fixtureOutput}
            </span>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.sampleOutputLabel}</h3>
              <p className="mt-2 font-serif text-xl leading-relaxed text-ink">
                {currentSession.synthesis.coreOutput}
              </p>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ListChecks className="h-4 w-4 text-brass" aria-hidden="true" />
                {t.conditions}
              </h3>
              <ul className="mt-3 space-y-2">
                {currentSession.synthesis.stipulations.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 rounded-lg border border-border bg-background/70 px-3 py-2.5 text-sm leading-relaxed text-ink-muted"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-sage/35 bg-sage/10 p-4">
              <h3 className="text-sm font-semibold text-ink">{t.nextStep}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {currentSession.synthesis.nextAction}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <p className="text-sm italic leading-relaxed text-ink-muted">
                {currentSession.synthesis.quote}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              disabled={isCopying}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-wait disabled:opacity-60"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {t.copySummary}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="scenario-title">
        <div>
          <h2 id="scenario-title" className="font-serif text-2xl text-ink">
            {t.scenarios}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t.scenarioWarning}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { scenario: currentSession.scenarios.good, accent: 'text-sage' },
            { scenario: currentSession.scenarios.normal, accent: 'text-brass' },
            { scenario: currentSession.scenarios.bad, accent: 'text-terracotta' },
          ].map(({ scenario, accent }) => (
            <article key={scenario.title} className="rounded-2xl border border-border bg-surface p-5">
              <span className={`text-xs font-semibold ${accent}`}>{t.fixture}</span>
              <h3 className="mt-3 font-serif text-xl text-ink">{scenario.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{scenario.description}</p>
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {scenario.actions.map((action) => (
                  <li key={action} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                    {action}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="testimonies-title">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-brass" aria-hidden="true" />
          <h2 id="testimonies-title" className="font-serif text-2xl text-ink">
            {t.testimonies}
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {currentSession.testimonies.map((testimony) => {
            const advisor = currentSession.advisors.find((item) => item.id === testimony.advisorId);
            return (
              <article key={testimony.advisorId} className="rounded-2xl border border-border bg-surface p-5">
                <div className="border-b border-border pb-3">
                  <h3 className="font-medium text-ink">{testimony.heading}</h3>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {t.modelLabel}: {advisor ? `${modelLabel(advisor.model, language)} · ${providerLabel(advisor.provider, language)}` : t.fixture}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink">{testimony.primaryText}</p>
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">{testimony.secondaryText}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
