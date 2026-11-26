/**
 * Minimal shared deliberation types for session conclusions and group room modes.
 */

export type CommunicationMode = 'independent' | 'debate' | 'chain';

export type FrameworkId = 'scenarios' | 'hats' | 'matrix';

export type MatrixCriterionId = 'cost' | 'speed' | 'risk' | 'reversibility';

export type MatrixOptionId = 'optionA' | 'optionB' | 'optionC';

export interface Contribution {
  advisorId: string;
  text: string;
  /** debate only — the advisor whose argument this one answers. */
  rebuts: string | null;
  /** chain only — the advisor whose output this one builds on. */
  buildsOn: string | null;
}

export interface ChairSynthesis {
  summary: string;
  dissent: string;
  recommendation: string;
}

export interface MatrixCriterion {
  id: MatrixCriterionId;
  weight: number;
}

export interface MatrixOption {
  id: MatrixOptionId;
  scores: Record<MatrixCriterionId, number>;
}

export interface DecisionMatrix {
  criteria: MatrixCriterion[];
  options: MatrixOption[];
}

export interface DecisionScenario {
  title: string;
  subtitle: string;
  description: string;
  actions: string[];
}

export interface FrameworkOutput {
  kind: FrameworkId;
  matrix: DecisionMatrix | null;
}

export interface Round {
  index: number;
  mode: CommunicationMode;
  framework: FrameworkId;
  prompt: string;
  /** The language this round's answers were produced in. May differ from the UI language. */
  language: 'en' | 'vi';
  contributions: Contribution[];
  chair: ChairSynthesis;
  frameworkOutput: FrameworkOutput;
}
