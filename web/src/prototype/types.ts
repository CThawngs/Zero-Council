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
  | LegalView
  | 'sign-up'
  | 'sign-in'
  | 'set-password'
  | 'chat-room';

/**
 * Legal documents, one view each.
 *
 * `'pricing'` used to be a view of its own. It is gone: the pricing table is a section of the
 * landing page, and buying opens the checkout drawer from there. A separate pricing screen meant
 * the visitor left the page to find out what things cost, then had to find their way back.
 */
export const LEGAL_DOCUMENTS = [
  'terms',
  'privacy',
  'refund',
  'cookies',
  'acceptable-use',
  'disclaimer',
  'contact',
] as const;

export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export type LegalView = `legal-${LegalDocument}`;

export const legalViewOf = (document: LegalDocument): LegalView => `legal-${document}`;

/** The document a view renders, or null when the view is not a legal page. */
export const legalDocumentOf = (view: ViewType): LegalDocument | null =>
  view.startsWith('legal-') ? (view.slice('legal-'.length) as LegalDocument) : null;

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

/** Real providers. Model ids are the wire ids sent to the provider, not display labels. */
export type SupportedModel = 'claude-sonnet-4-5' | 'gpt-4o' | 'gpt-4o-mini';
export type ModelProvider = 'anthropic' | 'openai';

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
