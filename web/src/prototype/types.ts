import type { CommunicationMode, FrameworkId, Round } from '@/lib/deliberation/engine';

export type ViewType =
  | 'overview'
  | 'empty-chamber'
  | 'session-active'
  | 'session-concluded'
  | 'sessions'
  | 'personas'
  | 'new-advisor'
  | 'api-keys'
  | 'settings'
  | 'billing'
  | 'pricing'
  | 'privacy';

export type Language = 'en' | 'vi';

export type DecisionFramework =
  | 'Good / Normal / Bad Scenarios'
  | 'Six Thinking Hats'
  | 'Decision Matrix';

/** Maps a framework onto the id the deliberation engine speaks. */
export const frameworkIdOf = (framework: DecisionFramework): FrameworkId => {
  if (framework === 'Six Thinking Hats') return 'hats';
  if (framework === 'Decision Matrix') return 'matrix';
  return 'scenarios';
};

export const decisionFrameworkOf = (id: FrameworkId): DecisionFramework => {
  if (id === 'hats') return 'Six Thinking Hats';
  if (id === 'matrix') return 'Decision Matrix';
  return 'Good / Normal / Bad Scenarios';
};

export type SupportedModel = 'Model label A' | 'Model label B' | 'Model label C';
export type ModelProvider = 'Provider label A' | 'Provider label B' | 'Provider label C';

export interface AdvisorPersona {
  id: string;
  name: string;
  archetype: string;
  model: SupportedModel;
  provider: ModelProvider;
  generatedName?: boolean;
  colorToken: 'persona-rose' | 'persona-sage' | 'persona-slate' | 'persona-ochre';
  colorHex: string;
  stance: string;
  instructions: string;
  sampleQuote: string;
}

export interface ScenarioBranch {
  title: string;
  subtitle: string;
  description: string;
  actions: string[];
}

export interface DeliberationSession {
  id: string;
  title: string;
  summary: string;
  framework: DecisionFramework;
  /** How advisors talk to each other. Applies to rounds started from now on. */
  mode: CommunicationMode;
  timestamp: string;
  relativeTime: string;
  status: 'Concluded' | 'Deliberating' | 'Active';
  advisors: AdvisorPersona[];
  /** Ordered, 1-based. Never empty: the first question is round 1. */
  rounds: Round[];
  scenarios: {
    good: ScenarioBranch;
    normal: ScenarioBranch;
    bad: ScenarioBranch;
  };
}

export interface ApiKeyConfig {
  provider: ModelProvider;
  modelName: SupportedModel;
  connected: boolean;
}
