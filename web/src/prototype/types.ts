import type { CommunicationMode, FrameworkId, Round } from '@/lib/deliberation/engine';

export type ViewType =
  | 'overview'
  | 'empty-chamber'
  | 'guide'
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
  | 'room-summary'
  | 'set-password'
  | 'chat-room'
  | 'bot-wizard'

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
export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'deepseek';

export type SupportedModel =
  // OpenAI
  | 'gpt-6-astra'
  | 'gpt-6.1-sol'
  | 'gpt-6-luna'
  | 'gpt-5.6-sol'
  | 'gpt-5.6-terra'
  | 'gpt-5.6-luna'
  | 'gpt-5.5'
  | 'gpt-oss-120b'
  | 'gpt-oss-20b'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1-preview'
  | 'o1-mini'

  // Anthropic
  | 'claude-opus-4-8'
  | 'claude-opus-4-7'
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-haiku-20240307'
  | 'claude-3-opus-20240229'

  // Google Gemini
  | 'gemini-4-argon'
  | 'gemini-3.8-flash'
  | 'gemini-3.7-flash'
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'

  // Groq
  | 'openai/gpt-oss-120b'
  | 'openai/gpt-oss-20b'
  | 'qwen/qwen3.8-27b'
  | 'minimaxai/minimax-m2.7'
  | 'meta-models/muse-spark-open'
  | 'llama-3.3-70b-versatile'
  | 'mixtral-8x7b-32768'

  // DeepSeek
  | 'deepseek-v4-pro'
  | 'deepseek-flash'
  | 'deepseek-v4-flash'
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'deepseek-v3.2';


export interface AdvisorPersona {
  id: string;
  name: string;
  archetype: string;
  model: string;
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
  /**
   * Set once the user renames a session: their text then wins over the seed
   * title localization, which otherwise re-translates the canned title.
   */
  titlePinned?: boolean;
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
  /** Wire model id from the live /v1/models list — any provider-returned id, not a fixed catalog. */
  modelName: string;
  connected: boolean;
}

/** A user-owned AI bot: one persona, one brain. Persisted server-side per account. */
export interface UserBot {
  id: string;
  name: string;
  instruction: string;
  provider: ModelProvider;
  model: string;
  createdAt?: string;
  updatedAt?: string;
}
