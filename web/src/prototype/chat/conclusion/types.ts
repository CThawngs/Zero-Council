/**
 * Types and error contracts for live AI Chair conclusion & scenario synthesis.
 */

import type { TurnFailureReason } from '../engine.ts';
import type { AdvisorPersona, ScenarioBranch } from '../../types.ts';

/** Structured error thrown when live AI conclusion synthesis cannot complete. */
export class ConclusionAnalysisError extends Error {
  readonly reason: TurnFailureReason;
  readonly provider?: string;
  readonly model?: string;

  constructor(
    reason: TurnFailureReason,
    message: string,
    meta?: { provider?: string; model?: string }
  ) {
    super(message);
    this.name = 'ConclusionAnalysisError';
    this.reason = reason;
    this.provider = meta?.provider;
    this.model = meta?.model;
  }
}

export interface ConclusionAnalysis {
  analyst: AdvisorPersona;
  chair: {
    summary: string;
    dissent: string;
    recommendation: string;
  };
  scenarios: {
    good: ScenarioBranch;
    normal: ScenarioBranch;
    bad: ScenarioBranch;
  };
}
