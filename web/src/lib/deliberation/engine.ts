/**
 * ============================================================================
 * DELEGATED — the one seam where a real deliberation engine drops in.
 * ============================================================================
 *
 * `runDeliberation` is the only place in the app that produces an advisor
 * answer. Everything upstream (mode picker, round rail, composer, framework
 * panels) is written against the `Round` it returns and never against how the
 * answer was made. Swapping the fixture below for a call to a real model
 * provider should not require touching a single component.
 *
 * Same contract style as `authenticateFromSession` in lib/currentUser.ts.
 *
 * Today it returns canned text so the interaction can be designed and tested
 * before any engine exists. What is NOT fixture: the *shape* of a round. Which
 * advisor answers, in what order, and who answers whom is decided by
 * `planContributions` in ./plan and is what the UI actually renders.
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
  type FrameworkId,
  type MatrixCriterion,
  type MatrixCriterionId,
  type MatrixOption,
  type MatrixOptionId,
} from './plan';

export type { CommunicationMode, FrameworkId, HatId, MatrixCriterionId, MatrixOptionId } from './plan';

export interface Contribution {
  advisorId: string;
  text: string;
  /** debate only — the advisor whose argument this one answers. */
  rebuts: string | null;
  /** chain only — the advisor whose output this one builds on. */
  buildsOn: string | null;
}

export interface MatrixData {
  criteria: MatrixCriterion[];
  options: MatrixOption[];
}

export interface FrameworkOutput {
  kind: FrameworkId;
  /** Only a matrix carries data. Scenarios and hats are pure presentation. */
  matrix: MatrixData | null;
}

export interface Round {
  index: number;
  mode: CommunicationMode;
  framework: FrameworkId;
  prompt: string;
  /** The language this round's answers were produced in. May differ from the UI language. */
  language: Language;
  contributions: Contribution[];
  chair: {
    summary: string;
    dissent: string;
    recommendation: string;
  };
  frameworkOutput: FrameworkOutput;
}

/**
 * Optional real AI generate function passed in from AppContext.
 * When provided, `runDeliberation` calls this for each advisor and the chair.
 * When absent, falls back to the fixture (canned text).
 *
 * @param advisorId - ID of the advisor speaking
 * @param stance    - Advisor's stance/perspective (used as system prompt hint)
 * @param prompt    - The question/prompt for this round
 * @param signal    - Optional AbortSignal to cancel in-flight requests
 */
export type GenerateFn = (
  advisorId: string,
  stance: string,
  prompt: string,
  signal?: AbortSignal
) => Promise<string>;

export interface DeliberationRequest {
  mode: CommunicationMode;
  framework: FrameworkId;
  prompt: string;
  language: Language;
  advisorIds: readonly string[];
  /** advisorId → stance, used to give each fixture voice its own colour. */
  advisorStances: Readonly<Record<string, string>>;
  /** 1-based. A follow-up question becomes round 2, 3, … */
  roundIndex: number;
  signal?: AbortSignal;
  /**
   * Optional real AI generate function. When provided, the engine calls the
   * real model for each advisor and the chair. When absent, falls back to
   * fixture (canned) text so the UI works without any API key.
   */
  generate?: GenerateFn;
}

export class DeliberationCancelled extends Error {
  constructor() {
    super('DELIBERATION_CANCELLED');
    this.name = 'DeliberationCancelled';
  }
}

const FIXTURE_DELAY_MS = 900;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DeliberationCancelled());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DeliberationCancelled());
      },
      { once: true }
    );
  });

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
    id: id as MatrixOptionId,
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
 * The fixture, without the wait. Split out so seeded sample sessions can be
 * built synchronously at module load — a real engine has no such need.
 */
export const buildFixtureRound = (request: Omit<DeliberationRequest, 'signal' | 'generate'>): Round => {
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
    frameworkOutput: {
      kind: framework,
      matrix: framework === 'matrix' ? fixtureMatrix(roundIndex) : null,
    },
  };
};

/**
 * Run a real deliberation round using the provided `generate` function.
 * Calls generate for each advisor (per planContributions order), then
 * calls generate once more for the chair to summarize all contributions.
 */
const runRealRound = async (request: DeliberationRequest & { generate: GenerateFn }): Promise<Round> => {
  const { mode, framework, prompt, language, advisorIds, advisorStances, roundIndex, signal, generate } = request;
  const t = copy[language];

  const shapes = planContributions(mode, advisorIds);

  // Build contributions by calling generate for each advisor in order.
  const contributions: Contribution[] = [];
  for (const shape of shapes) {
    if (signal?.aborted) throw new DeliberationCancelled();
    const stance = advisorStances[shape.advisorId] ?? shape.advisorId;
    const text = await generate(shape.advisorId, stance, prompt, signal);
    contributions.push({
      advisorId: shape.advisorId,
      text,
      rebuts: shape.rebuts,
      buildsOn: shape.buildsOn,
    });
  }

  // Chair summarizes all contributions.
  if (signal?.aborted) throw new DeliberationCancelled();
  const contributionsSummary = contributions
    .map((c) => `${advisorStances[c.advisorId] ?? c.advisorId}: ${c.text}`)
    .join('\n\n');
  const chairPrompt = `The council has deliberated on: "${prompt}"\n\nContributions:\n${contributionsSummary}\n\nProvide a brief synthesis.`;
  const chairSummary = await generate('chair', 'neutral synthesizer', chairPrompt, signal);

  return {
    index: roundIndex,
    mode,
    framework,
    prompt,
    language,
    contributions,
    chair: {
      summary: chairSummary,
      dissent: t.chairDissent,
      recommendation: t.chairRecommendation,
    },
    frameworkOutput: {
      kind: framework,
      matrix: framework === 'matrix' ? fixtureMatrix(roundIndex) : null,
    },
  };
};

/**
 * Run one deliberation round.
 *
 * - If `request.generate` is provided → calls the real AI for each advisor
 *   and the chair, returning live responses.
 * - If not → returns canned fixture text after a fake delay.
 *
 * The `Round` shape is identical in both paths so all UI components work
 * unchanged regardless of which path ran.
 *
 * ponytail: no streaming. The real engine will want to emit each contribution
 * as it lands, which means adding an `onContribution` callback here. The UI
 * already renders a pending state and a Cancel button, so adding it should not
 * change any component.
 */
export const runDeliberation = async (request: DeliberationRequest): Promise<Round> => {
  if (request.generate) {
    return runRealRound(request as DeliberationRequest & { generate: GenerateFn });
  }
  // Fixture path: fake delay so the UI shows the loading state.
  await sleep(FIXTURE_DELAY_MS, request.signal);
  return buildFixtureRound(request);
};
