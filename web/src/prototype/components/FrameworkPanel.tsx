import React, { useState } from 'react';
import type { Copy } from '../i18n';
import type { DeliberationSession } from '../types';
import {
  clampScale,
  HAT_ORDER,
  MATRIX_CRITERION_IDS,
  MATRIX_OPTION_IDS,
  MAX_WEIGHT,
  scoreMatrix,
  type HatId,
  type MatrixCriterion,
  type MatrixCriterionId,
  type MatrixOptionId,
} from '@/lib/deliberation/plan';
import type { Round } from '@/lib/deliberation/engine';

interface Props {
  round: Round;
  session: DeliberationSession;
  t: Copy;
}

const HAT_LABEL: Record<HatId, keyof Copy> = {
  white: 'hatWhite',
  red: 'hatRed',
  black: 'hatBlack',
  yellow: 'hatYellow',
  green: 'hatGreen',
  blue: 'hatBlue',
};

const HAT_BODY: Record<HatId, keyof Copy> = {
  white: 'hatWhiteBody',
  red: 'hatRedBody',
  black: 'hatBlackBody',
  yellow: 'hatYellowBody',
  green: 'hatGreenBody',
  blue: 'hatBlueBody',
};

const CRITERION_LABEL: Record<MatrixCriterionId, keyof Copy> = {
  cost: 'matrixCriterionCost',
  speed: 'matrixCriterionSpeed',
  risk: 'matrixCriterionRisk',
  reversibility: 'matrixCriterionReversibility',
};

const OPTION_LABEL: Record<MatrixOptionId, keyof Copy> = {
  optionA: 'matrixOptionA',
  optionB: 'matrixOptionB',
  optionC: 'matrixOptionC',
};

const ScenariosPanel: React.FC<Props> = ({ session }) => {
  const branches = [session.scenarios.good, session.scenarios.normal, session.scenarios.bad];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {branches.map((branch) => (
        <div key={branch.title} className="rounded-2xl border border-border bg-surface p-5">
          <h4 className="font-serif text-lg text-ink">{branch.title}</h4>
          <p className="mt-1 text-xs text-ink-muted">{branch.subtitle}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink">{branch.description}</p>
          <ul className="mt-4 space-y-2">
            {branch.actions.map((action) => (
              <li key={action} className="border-l-2 border-brass/40 pl-3 text-sm text-ink-muted">
                {action}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const HatsPanel: React.FC<Props> = ({ t }) => (
  <>
    <p className="mb-4 text-sm text-ink-muted">{t.hatsIntro}</p>
    <ol className="grid gap-3 sm:grid-cols-2">
      {HAT_ORDER.map((hat, index) => (
        <li key={hat} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-brass">{String(index + 1).padStart(2, '0')}</span>
            <h4 className="font-serif text-base text-ink">{t[HAT_LABEL[hat]]}</h4>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t[HAT_BODY[hat]]}</p>
        </li>
      ))}
    </ol>
  </>
);

/**
 * The weights are view state, not session state: moving a slider re-scores what
 * the user is looking at without rewriting a round that already happened.
 * Leaving and re-opening the round resets them to the round's own weights.
 */
const MatrixPanel: React.FC<Props> = ({ round, t }) => {
  const seeded = round.frameworkOutput.matrix;
  const [weights, setWeights] = useState<Record<MatrixCriterionId, number>>(() =>
    Object.fromEntries((seeded?.criteria ?? []).map((criterion) => [criterion.id, criterion.weight])) as Record<
      MatrixCriterionId,
      number
    >
  );

  if (!seeded) return null;

  const criteria: MatrixCriterion[] = MATRIX_CRITERION_IDS.map((id) => ({ id, weight: weights[id] ?? 1 }));
  const options = MATRIX_OPTION_IDS.map((id) => ({
    id,
    scores:
      seeded.options.find((option) => option.id === id)?.scores ??
      (MATRIX_CRITERION_IDS.reduce((acc, criterionId) => ({ ...acc, [criterionId]: 0 }), {}) as never),
  }));
  const { rows, maxTotal, winnerId } = scoreMatrix(criteria, options);
  const label = (key: keyof Copy) => t[key];

  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">{t.matrixIntro}</p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <caption className="sr-only">{t.matrixLabel}</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                {t.matrixCriteriaHeader}
              </th>
              {MATRIX_OPTION_IDS.map((id) => (
                <th key={id} scope="col" className="px-4 py-3 font-medium">
                  {label(OPTION_LABEL[id])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion.id} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-4 py-3 font-normal text-ink">
                  {label(CRITERION_LABEL[criterion.id])}
                  <span className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                    <span className="whitespace-nowrap">{t.matrixWeightHeader}</span>
                    <input
                      type="range"
                      min={1}
                      max={MAX_WEIGHT}
                      value={criterion.weight}
                      onChange={(event) =>
                        setWeights((value) => ({
                          ...value,
                          [criterion.id]: clampScale(Number(event.target.value), MAX_WEIGHT),
                        }))
                      }
                      aria-label={`${label(CRITERION_LABEL[criterion.id])} — ${t.matrixWeightHeader}`}
                      className="h-11 w-32 accent-[var(--color-brass)]"
                    />
                    <span>{criterion.weight}</span>
                  </span>
                </th>
                {options.map((option) => (
                  <td key={option.id} className="px-4 py-3 text-ink-muted">
                    {option.scores[criterion.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th scope="row" className="px-4 py-3 font-medium text-ink">
                {t.matrixTotalHeader}
              </th>
              {rows.map((row) => (
                <td
                  key={row.id}
                  className={`px-4 py-3 font-medium ${
                    row.id === winnerId ? 'text-brass' : 'text-ink-muted'
                  }`}
                >
                  {row.total}
                  <span className="ml-1 text-xs font-normal text-ink-muted">
                    {t.matrixMaxOf.replace('{max}', String(maxTotal))}
                  </span>
                  {row.id === winnerId && (
                    <span className="mt-1 block text-xs font-normal text-brass">{t.matrixLeading}</span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {winnerId === null && <p className="mt-3 text-sm text-ink-muted">{t.matrixLeadingNone}</p>}
    </>
  );
};

const PANEL_LABEL: Record<Round['framework'], keyof Copy> = {
  scenarios: 'scenariosLabel',
  hats: 'hatsLabel',
  matrix: 'matrixLabel',
};

const FrameworkPanel: React.FC<Props> = (props) => {
  const { round, t } = props;
  return (
    <section aria-labelledby="framework-panel-heading" className="rounded-2xl border border-border p-6">
      <h3 id="framework-panel-heading" className="font-serif text-xl text-ink">
        {t[PANEL_LABEL[round.framework]]}
      </h3>
      <div className="mt-4">
        {round.framework === 'matrix' ? (
          <MatrixPanel {...props} />
        ) : round.framework === 'hats' ? (
          <HatsPanel {...props} />
        ) : (
          <ScenariosPanel {...props} />
        )}
      </div>
    </section>
  );
};

export default FrameworkPanel;
