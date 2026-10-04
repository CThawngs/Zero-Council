import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import {
  Copy,
  FilePenLine,
  Layers3,
  ListChecks,
  Quote,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import FrameworkPanel from './FrameworkPanel';

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

  // A concluded session always has at least one round — the first question is
  // round 1. The last round is what "concluded" means: later follow-ups supersede.
  const round = currentSession.rounds[currentSession.rounds.length - 1];
  const nameOf = (advisorId: string) =>
    currentSession.advisors.find((advisor) => advisor.id === advisorId)?.name ?? advisorId;

  const frameworkLabel = {
    'Good / Normal / Bad Scenarios': t.scenarioTitle,
    'Six Thinking Hats': t.hatsTitle,
    'Decision Matrix': t.matrixTitle,
  }[currentSession.framework];

  const handleCopySummary = async () => {
    const text = [
      `${t.concludedTitle}: ${currentSession.title}`,
      `${t.roundOf.replace('{n}', String(round.index))} — ${t.concludedTitle}`,
      `${t.chairSummaryLabel}: ${round.chair.summary}`,
      `${t.chairDissentLabel}: ${round.chair.dissent}`,
      `${t.nextStep}: ${round.chair.recommendation}`,
      ...round.contributions.map(
        (item) => `- ${nameOf(item.advisorId)}: ${item.text}`
      ),
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
              {t.fixtureNotConsensus}
            </span>
          </div>

          {round.language !== language && (
            <p className="mt-5 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm leading-relaxed text-ink-muted">
              {t.answerLanguageNote.replace(
                '{language}',
                round.language === 'en' ? 'English' : 'Tiếng Việt'
              )}
            </p>
          )}

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.chairSummaryLabel}</h3>
              <p className="mt-2 font-serif text-xl leading-relaxed text-ink">{round.chair.summary}</p>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ListChecks className="h-4 w-4 text-brass" aria-hidden="true" />
                {t.chairDissentLabel}
              </h3>
              <ul className="mt-3 space-y-2">
                {[round.chair.dissent].map((item) => (
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
              <h3 className="text-sm font-semibold text-ink">{t.chairRecommendationLabel}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{round.chair.recommendation}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <p className="text-sm italic leading-relaxed text-ink-muted">{round.prompt}</p>
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

      <FrameworkPanel
        key={`${round.index}-${round.framework}`}
        round={round}
        session={currentSession}
        t={t}
      />

      <section className="space-y-4" aria-labelledby="testimonies-title">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-brass" aria-hidden="true" />
          <h2 id="testimonies-title" className="font-serif text-2xl text-ink">
            {t.testimonies}
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {round.contributions.map((contribution) => {
            const advisor = currentSession.advisors.find(
              (item) => item.id === contribution.advisorId
            );
            const crossReference = contribution.rebuts ?? contribution.buildsOn;
            return (
              <article
                key={contribution.advisorId}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="border-b border-border pb-3">
                  <h3 className="font-medium text-ink">{nameOf(contribution.advisorId)}</h3>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {t.modelLabel}:{' '}
                    {advisor
                      ? `${modelLabel(advisor.model, language)} · ${providerLabel(advisor.provider, language)}`
                      : t.notImplemented}
                  </p>
                  {crossReference && (
                    <p className="mt-2 inline-block rounded-full bg-brass/10 px-2.5 py-0.5 text-xs text-brass">
                      {contribution.rebuts
                        ? t.rebutsLabel.replace('{name}', nameOf(contribution.rebuts))
                        : t.buildsOnLabel.replace('{name}', nameOf(contribution.buildsOn as string))}
                    </p>
                  )}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink">{contribution.text}</p>
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  {advisor?.instructions ?? ''}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
