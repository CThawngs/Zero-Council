/**
 * The canned answers. This is the only file in the seam that needs the copy
 * tables, which is why it is not ./engine — keeping the contract free of i18n
 * is what makes it testable with plain `node --test`.
 *
 * FIXME(fixture): replace `buildFixtureRound` with a real producer. Keep the
 * `Round` shape; `pacedProducer` shows what streaming is expected to look like.
 */

import { copy } from '@/prototype/i18n';
import type { Language } from '@/prototype/types';
import {
  clampScale,
  MAX_SCORE,
  MAX_WEIGHT,
  MATRIX_CRITERION_IDS,
  MATRIX_OPTION_IDS,
  planContributions,
  type CommunicationMode,
  type MatrixCriterion,
  type MatrixCriterionId,
  type MatrixOption,
} from './plan';
import {
  createDeliberationEngine,
  pacedProducer,
  type Contribution,
  type DeliberationRequest,
  type FrameworkOutput,
  type MatrixData,
  type Round,
} from './engine';

const STEP_MS = 420;

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

/**
 * Fixture matrix. Deterministic and round-sensitive: a follow-up question
 * rotates the scores, so a round 2 can legitimately produce a different winner
 * than round 1. That is the behaviour a real engine has to reproduce.
 */
const fixtureMatrix = (roundIndex: number): MatrixData => {
  const shift = Math.max(0, roundIndex - 1);
  const criteria: MatrixCriterion[] = MATRIX_CRITERION_IDS.map((id, index) => ({
    id,
    weight: clampScale(((index + 2) % MAX_WEIGHT) + 1, MAX_WEIGHT),
  }));
  const options: MatrixOption[] = MATRIX_OPTION_IDS.map((id, optionIndex) => ({
    id,
    scores: MATRIX_CRITERION_IDS.reduce((scores, criterionId, criterionIndex) => {
      scores[criterionId as MatrixCriterionId] = clampScale(
        ((optionIndex * 2 + criterionIndex + shift) % MAX_SCORE) + 1,
        MAX_SCORE
      );
      return scores;
    }, {} as Record<MatrixCriterionId, number>),
  }));
  return { criteria, options };
};

const voiceFor = (
  mode: CommunicationMode,
  roundIndex: number,
  language: Language,
  stance: string,
  targetName: string
): string => {
  const t = copy[language];
  if (roundIndex > 1) {
    return fill(t.voiceFollowUp, { round: roundIndex, stance, target: targetName });
  }
  if (mode === 'debate') return fill(t.voiceDebate, { stance, target: targetName });
  if (mode === 'chain') return fill(t.voiceChain, { stance, target: targetName });
  return fill(t.voiceIndependent, { stance });
};

/**
 * The fixture, without the wait. Exported because seeded sample sessions need
 * it synchronously at module load — a real engine has no such need.
 */
export const buildFixtureRound = (
  request: Omit<DeliberationRequest, 'signal' | 'onContribution'>
): Round => {
  const { mode, framework, prompt, language, advisorIds, advisorStances, roundIndex } = request;
  const t = copy[language];

  const shapes = planContributions(mode, advisorIds);
  const nameOf = (advisorId: string | null) =>
    advisorId ? (advisorStances[advisorId] ?? advisorId) : '';

  const contributions: Contribution[] = shapes.map((shape) => {
    const targetName = nameOf(shape.rebuts ?? shape.buildsOn);
    return {
      advisorId: shape.advisorId,
      text: voiceFor(mode, roundIndex, language, nameOf(shape.advisorId), targetName),
      rebuts: shape.rebuts,
      buildsOn: shape.buildsOn,
    };
  });

  const frameworkOutput: FrameworkOutput = {
    kind: framework,
    matrix: framework === 'matrix' ? fixtureMatrix(roundIndex) : null,
  };

  return {
    index: roundIndex,
    mode,
    framework,
    prompt,
    language,
    contributions,
    chair: {
      summary: t.chairSummary,
      dissent: t.chairDissent,
      recommendation: t.chairRecommendation,
    },
    frameworkOutput,
  };
};

/** What the app calls today. Same signature a real engine would export. */
export const runDeliberation = createDeliberationEngine(pacedProducer(buildFixtureRound, STEP_MS));