import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, Eye, Layers3, Send, ShieldCheck, UsersRound, X } from 'lucide-react';
import { modelLabel, providerLabel } from '../data/mockData';
import { frameworkIdOf } from '../types';
import { modeLabel } from '../i18n';
import type { CommunicationMode } from '@/lib/deliberation/engine';
import RoundThread from './RoundThread';
import FrameworkPanel from './FrameworkPanel';

const MODES: CommunicationMode[] = ['independent', 'debate', 'chain'];

const MODE_DESCRIPTION: Record<CommunicationMode, 'modeIndependentBody' | 'modeDebateBody' | 'modeChainBody'> = {
  independent: 'modeIndependentBody',
  debate: 'modeDebateBody',
  chain: 'modeChainBody',
};

export const SessionActiveView: React.FC = () => {
  const {
    currentSession,
    setCurrentView,
    openFrameworkModal,
    setCurrentMode,
    runRound,
    cancelRound,
    isDeliberating,
    selectedRoundIndex,
    selectRound,
    t,
    language,
  } = useApp();
  const [draft, setDraft] = useState('');

  const frameworkLabel = {
    'Good / Normal / Bad Scenarios': t.scenarioTitle,
    'Six Thinking Hats': t.hatsTitle,
    'Decision Matrix': t.matrixTitle,
  }[currentSession.framework];

  const round = currentSession.rounds.find((item) => item.index === selectedRoundIndex) ?? currentSession.rounds[0];
  const nextRoundNumber = currentSession.rounds.length + 1;
  // A finished round keeps the framework it ran with. The session may already be
  // on another one, so say which panel the user will get next instead of
  // silently leaving the old shape on screen.
  const pendingFramework = frameworkIdOf(currentSession.framework) !== round.framework;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || isDeliberating) return;
    void runRound(draft);
    setDraft('');
  };

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
              <Layers3 className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <span className="min-w-0 truncate">{frameworkLabel}</span>
              <span className="shrink-0 text-xs text-ink-muted">{t.change}</span>
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

      <section className="space-y-4" aria-labelledby="mode-title">
        <div>
          <h2 id="mode-title" className="font-serif text-2xl text-ink">
            {t.modeLabel}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t.modeHint}</p>
        </div>
        <div role="group" aria-labelledby="mode-title" className="grid gap-3 sm:grid-cols-3">
          {MODES.map((mode) => {
            const isActive = currentSession.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={isActive}
                disabled={isDeliberating}
                onClick={() => setCurrentMode(mode)}
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-50 ${
                  isActive ? 'border-brass bg-brass/10' : 'border-border bg-surface hover:border-brass/50'
                }`}
              >
                <span className={`text-sm font-medium ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
                  {modeLabel(mode, language)}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                  {t[MODE_DESCRIPTION[mode]]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="composer-title">
        <h2 id="composer-title" className="font-serif text-2xl text-ink">
          {t.followUpLabel}
        </h2>
        {isDeliberating ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-brass/40 bg-surface p-5"
          >
            <p className="flex items-center gap-2 font-serif text-lg text-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brass" aria-hidden="true" />
              {t.thinkingTitle}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {t.thinkingBody
                .replace('{count}', String(currentSession.advisors.length))
                .replace('{mode}', modeLabel(currentSession.mode, language))}
            </p>
            <button
              type="button"
              onClick={cancelRound}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-ink transition hover:border-brass/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t.cancelRound}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5">
            <label htmlFor="follow-up-question" className="field-label">
              {t.followUpLabel}
            </label>
            <textarea
              id="follow-up-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t.followUpPlaceholder}
              rows={3}
              className="field"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-muted">
                {t.followUpHint.replace('{n}', String(nextRoundNumber))}
              </p>
              <button
                type="submit"
                disabled={!draft.trim()}
                className="button-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {t.runRound}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="perspectives-title">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-brass" aria-hidden="true" />
          <h2 id="perspectives-title" className="font-serif text-2xl text-ink">
            {t.perspectives}
          </h2>
        </div>
        <RoundThread
          rounds={currentSession.rounds}
          selectedIndex={round.index}
          onSelect={selectRound}
          advisors={currentSession.advisors}
          language={language}
          t={t}
        />
      </section>

      <FrameworkPanel
        key={`${round.index}-${round.framework}`}
        round={round}
        session={currentSession}
        t={t}
      />

      {pendingFramework && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink-muted">
          {t.frameworkAppliesNext.replace('{name}', frameworkLabel)}
        </p>
      )}

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
                    {`${modelLabel(advisor.model)} · ${providerLabel(advisor.provider)}`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
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