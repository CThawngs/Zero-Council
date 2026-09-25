import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { DecisionFramework } from '../types';
import { modelLabel, providerLabel } from '../data/mockData';
import { Check, Compass, GitBranch, Layers3, ShieldCheck, SlidersHorizontal, UsersRound } from 'lucide-react';

export const EmptyChamberView: React.FC = () => {
  const { startNewSession, personas, setCurrentView, t, language } = useApp();
  const [question, setQuestion] = useState('');
  const [selectedFramework, setSelectedFramework] =
    useState<DecisionFramework>('Good / Normal / Bad Scenarios');

  const frameworks = [
    {
      id: 'Good / Normal / Bad Scenarios' as const,
      title: t.scenarioTitle,
      body: t.scenarioBody,
      icon: GitBranch,
    },
    {
      id: 'Six Thinking Hats' as const,
      title: t.hatsTitle,
      body: t.hatsBody,
      icon: Layers3,
    },
    {
      id: 'Decision Matrix' as const,
      title: t.matrixTitle,
      body: t.matrixBody,
      icon: SlidersHorizontal,
    },
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) return;
    startNewSession(normalizedQuestion, selectedFramework);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 py-4 sm:py-8">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
          <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
          {t.emptyEyebrow}
        </p>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{t.emptyTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">{t.emptyBody}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7"
      >
        <div>
          <label htmlFor="decision-question" className="text-sm font-semibold text-ink">
            {t.questionLabel}
          </label>
          <p id="question-hint" className="mt-1 text-xs leading-relaxed text-ink-muted">
            {t.questionHint}
          </p>
          <textarea
            id="decision-question"
            name="decision-question"
            rows={5}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t.questionPlaceholder}
            aria-describedby="question-hint"
            autoComplete="off"
            required
            className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t.frameworkLabel}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {frameworks.map(({ id, title, body, icon: Icon }) => {
              const isSelected = selectedFramework === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedFramework(id)}
                  className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
                    isSelected
                      ? 'border-brass bg-background shadow-sm'
                      : 'border-border bg-background/50 hover:border-brass/50 hover:bg-background'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-brass" aria-hidden="true" />
                    {isSelected && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass text-background">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="mt-4 block min-w-0 break-words text-sm font-semibold text-ink">{title}</span>
                  <span className="mt-2 block min-w-0 break-words text-xs leading-relaxed text-ink-muted">{body}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <section className="space-y-3 border-t border-border pt-6" aria-labelledby="persona-slots-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="persona-slots-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
              <UsersRound className="h-4 w-4 text-brass" aria-hidden="true" />
              {t.personasLabel}
            </h2>
            <button
              type="button"
              onClick={() => setCurrentView('personas')}
              className="min-h-11 self-start rounded-lg px-2 text-left text-xs font-medium text-brass underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:self-auto"
            >
              {t.editPersonas}
            </button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {personas.map((persona) => (
              <li
                key={persona.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background/70 p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: persona.colorHex }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="min-w-0 truncate text-sm font-medium text-ink">{persona.name}</p>
                    <p className="min-w-0 truncate text-[11px] text-ink-muted">
                      {modelLabel(persona.model, language)} · {providerLabel(persona.provider, language)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-ink-muted">
                  {t.fixture}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-relaxed text-ink-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
            {t.noAi}
          </p>
          <button
            type="submit"
            disabled={!question.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass px-5 py-3 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            {t.preview}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-border bg-background/60 p-5" aria-labelledby="examples-title">
        <h2 id="examples-title" className="text-sm font-semibold text-ink">
          {t.examples}
        </h2>
        <button
          type="button"
          onClick={() => setQuestion(t.questionPlaceholder)}
          className="mt-3 flex min-h-11 w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm leading-relaxed text-ink-muted transition hover:border-brass/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <span>{t.questionPlaceholder}</span>
          <span className="shrink-0 text-xs font-semibold text-brass">{t.useExample}</span>
        </button>
      </section>
    </div>
  );
};
