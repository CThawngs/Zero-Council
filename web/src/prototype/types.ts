import type { CommunicationMode, FrameworkId, Round } from '@/lib/deliberation/engine';
import type { ChatMessage, ChatMode, TurnFailure, WhyStop } from './chat/engine';

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
  | 'bot-wizard';

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

/** Built-in provider slugs + custom:(openai|anthropic):<slug> IDs. */
export type BuiltinModelProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'groq'
  | 'xai'
  | 'openrouter'
  | 'nvidia'
  | 'deepseek';

export type ModelProvider = BuiltinModelProvider | (string & {});

export type SupportedModel =
  | 'claude-sonnet-4-5'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini-2.5-flash'
  | 'llama-3.3-70b-versatile'
  | 'grok-2-latest'
  | 'openai/gpt-4o-mini'
  | 'meta/llama-3.1-70b-instruct'
  | 'deepseek-chat';

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
  titlePinned?: boolean;
  summary: string;
  framework: DecisionFramework;
  mode: CommunicationMode;
  timestamp: string;
  relativeTime: string;
  status: 'Concluded' | 'Deliberating' | 'Active';
  advisors: AdvisorPersona[];
  rounds: Round[];
  scenarios: {
    good: ScenarioBranch;
    normal: ScenarioBranch;
    bad: ScenarioBranch;
  };
}

export interface ApiKeyConfig {
  provider: ModelProvider;
  /** Default wire model id selected for this provider. */
  modelName: string;
  /** Full list of discovered + custom-tested model ids available on this provider. */
  models?: string[];
  connected: boolean;
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
  isCustom?: boolean;
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

/** Durable chat conversation: either a 1-on-1 Solo Bot thread or a Multi-Bot Group Chat (>= 2 bots). */
export type ConversationKind = 'solo' | 'group';

export interface SavedConversation {
  id: string;
  kind: ConversationKind;
  /** Set when `kind === 'solo'` (raw UserBot id). */
  botId?: string;
  title: string;
  mode: ChatMode;
  /** Persona IDs (`bot:<id>` or preset advisor IDs). Group chats require >= 2 entries. */
  roster: string[];
  messages: ChatMessage[];
  turns: number;
  stoppedBy: WhyStop | null;
  failures: TurnFailure[];
  held: string[];
  createdAt: string;
  updatedAt: string;
}

export const cookieLanguage = 'zc-lang';
export const cookieTheme = 'zc-theme';
