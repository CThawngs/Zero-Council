import React from 'react';
import type { Copy } from '../i18n';
import type { AdvisorPersona, Language } from '../types';
import type { Round } from '@/lib/deliberation/engine';

interface Props {
  rounds: Round[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  advisors: AdvisorPersona[];
  language: Language;
  t: Copy;
}

const LANGUAGE_NAME: Record<Language, string> = { en: 'English', vi: 'Tiếng Việt' };

/**
 * One round, drawn according to how it was run. The mode is not decoration: a
 * debate answer names the advisor it answers, a chain answer names the one it
 * builds on, and an independent answer names nobody.
 */
const RoundThread: React.FC<Props> = ({ rounds, selectedIndex, onSelect, advisors, language, t }) => {
  const nameOf = (advisorId: string) =>
    advisors.find((advisor) => advisor.id === advisorId)?.name ?? advisorId;

  return (
    <div className="space-y-6">
      {rounds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t.roundLabel}
          </span>
          <div role="group" aria-label={t.roundLabel} className="flex flex-wrap gap-2">
            {rounds.map((round) => {
              const isSelected = round.index === selectedIndex;
              return (
                <button
                  key={round.index}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(round.index)}
                  className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                    isSelected
                      ? 'border-brass bg-brass/10 text-ink'
                      : 'border-border text-ink-muted hover:border-brass/50 hover:text-ink'
                  }`}
                >
                  {t.roundOf.replace('{n}', String(round.index))}
                </button>
              );
            })}
          </div>
          {selectedIndex === rounds[rounds.length - 1].index && (
            <span className="text-xs text-ink-muted">{t.latestRound}</span>
          )}
        </div>
      )}

      {rounds.map((round) =>
        round.index === selectedIndex ? (
          <article key={round.index} className="space-y-5">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {t.roundPromptLabel}
              </p>
              <p className="mt-2 font-serif text-lg text-ink">{round.prompt}</p>
              {round.language !== language && (
                <p className="mt-3 text-xs text-ink-muted">
                  {t.answerLanguageNote.replace('{language}', LANGUAGE_NAME[round.language])}
                </p>
              )}
            </div>

            {round.mode === 'independent' && (
              <p className="text-sm text-ink-muted">{t.independentNote}</p>
            )}

            <ol className="space-y-3">
              {round.contributions.map((contribution, position) => {
                const crossReference = contribution.rebuts ?? contribution.buildsOn;
                return (
                  <li
                    key={`${round.index}-${contribution.advisorId}`}
                    className={`rounded-2xl border border-border p-5 ${
                      crossReference ? 'bg-surface' : 'bg-background'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-brass">
                        {String(position + 1).padStart(2, '0')}
                      </span>
                      <h4 className="font-medium text-ink">{nameOf(contribution.advisorId)}</h4>
                      {contribution.rebuts && (
                        <span className="rounded-full bg-brass/10 px-2.5 py-0.5 text-xs text-brass">
                          {t.rebutsLabel.replace('{name}', nameOf(contribution.rebuts))}
                        </span>
                      )}
                      {contribution.buildsOn && (
                        <span className="rounded-full bg-brass/10 px-2.5 py-0.5 text-xs text-brass">
                          {t.buildsOnLabel.replace('{name}', nameOf(contribution.buildsOn))}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{contribution.text}</p>
                  </li>
                );
              })}
            </ol>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h4 className="font-serif text-lg text-ink">{t.chairLabel}</h4>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {t.chairSummaryLabel}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink">{round.chair.summary}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {t.chairDissentLabel}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink">{round.chair.dissent}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {t.chairRecommendationLabel}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink">{round.chair.recommendation}</dd>
                </div>
              </dl>
            </section>
          </article>
        ) : null
      )}
    </div>
  );
};

export default RoundThread;