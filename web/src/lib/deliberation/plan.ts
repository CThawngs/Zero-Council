/**
 * Pure deliberation logic — no i18n, no React, no data store.
 *
 * Split from engine.ts on purpose: engine.ts needs `copy` from prototype/i18n for
 * fixture prose, and a value import of an `@/` alias breaks `node --test`
 * (type-only imports are erased, value imports are not). Everything testable
 * without driving the app lives here.
 */

export type CommunicationMode = 'independent' | 'debate' | 'chain';

export type FrameworkId = 'scenarios' | 'hats' | 'matrix';

export type HatId = 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue';

export type MatrixCriterionId = 'cost' | 'speed' | 'risk' | 'reversibility';

export type MatrixOptionId = 'optionA' | 'optionB' | 'optionC';

export const HAT_ORDER: readonly HatId[] = ['white', 'red', 'black', 'yellow', 'green', 'blue'];

export const MATRIX_CRITERION_IDS: readonly MatrixCriterionId[] = ['cost', 'speed', 'risk', 'reversibility'];

export const MATRIX_OPTION_IDS: readonly MatrixOptionId[] = ['optionA', 'optionB', 'optionC'];

/** Highest score a single cell may hold, and highest weight a criterion may carry. */
export const MAX_SCORE = 5;
export const MAX_WEIGHT = 5;

export interface ContributionShape {
  advisorId: string;
  /** debate only — the advisor whose argument this one answers. */
  rebuts: string | null;
  /** chain only — the advisor whose output this one builds on. */
  buildsOn: string | null;
}

/**
 * Decide the order and the cross-references of one round.
 *
 * The three modes differ in *shape*, not in wording, so a round stays
 * recognisable after the real engine replaces the fixture: `rebuts` is only ever
 * set in a debate, `buildsOn` only ever in a chain, and independent advisors
 * reference nobody.
 */
export const planContributions = (
  mode: CommunicationMode,
  advisorIds: readonly string[]
): ContributionShape[] =>
  advisorIds.map((advisorId, index) => {
    if (index === 0) return { advisorId, rebuts: null, buildsOn: null };
    const previous = advisorIds[index - 1];
    if (mode === 'debate') return { advisorId, rebuts: previous, buildsOn: null };
    if (mode === 'chain') return { advisorId, rebuts: null, buildsOn: previous };
    return { advisorId, rebuts: null, buildsOn: null };
  });

export interface MatrixCriterion {
  id: MatrixCriterionId;
  weight: number;
}

export interface MatrixOption {
  id: MatrixOptionId;
  scores: Record<MatrixCriterionId, number>;
}

export interface ScoredOption {
  id: MatrixOptionId;
  total: number;
}

export interface MatrixResult {
  rows: ScoredOption[];
  /** Best achievable total — every cell at MAX_SCORE with current weights. */
  maxTotal: number;
  /** First option on the highest total, or null when every option scores zero. */
  winnerId: MatrixOptionId | null;
}

/**
 * Weighted total per option. A criterion with weight 0 is ignored rather than
 * treated as a divisor, so changing one weight never rescales the others.
 */
export const scoreMatrix = (
  criteria: readonly MatrixCriterion[],
  options: readonly MatrixOption[]
): MatrixResult => {
  const rows = options.map((option) => ({
    id: option.id,
    total: criteria.reduce((sum, criterion) => sum + criterion.weight * (option.scores[criterion.id] ?? 0), 0),
  }));
  const best = rows.reduce((max, row) => (row.total > max ? row.total : max), 0);
  return {
    rows,
    maxTotal: criteria.reduce((sum, criterion) => sum + criterion.weight, 0) * MAX_SCORE,
    winnerId: best === 0 ? null : (rows.find((row) => row.total === best)?.id ?? null),
  };
};

/** Clamp a weight/score into 1..MAX so a slider or a bad fixture value cannot break the table. */
export const clampScale = (value: number, max: number = MAX_SCORE): number => {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.round(value)));
};
