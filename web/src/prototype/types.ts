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
  | 'privacy'
  | 'chat-room';

export type Language = 'en' | 'vi';

export type DecisionFramework =
  | 'Good / Normal / Bad Scenarios'
  | 'Six Thinking Hats'
  | 'Decision Matrix';

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

export interface DeliberationSession {
  id: string;
  title: string;
  summary: string;
  framework: DecisionFramework;
  timestamp: string;
  relativeTime: string;
  status: 'Concluded' | 'Deliberating' | 'Active';
  advisors: AdvisorPersona[];
  testimonies: {
    advisorId: string;
    heading: string;
    stanceBadge: string;
    primaryText: string;
    secondaryText: string;
  }[];
  synthesis: {
    chairTitle: string;
    chairRole: string;
    statusBadge: string;
    coreOutput: string;
    stipulations: string[];
    nextAction: string;
    quote: string;
  };
  scenarios: {
    good: { title: string; subtitle: string; description: string; actions: string[] };
    normal: { title: string; subtitle: string; description: string; actions: string[] };
    bad: { title: string; subtitle: string; description: string; actions: string[] };
  };
}

export interface ApiKeyConfig {
  provider: ModelProvider;
  modelName: SupportedModel;
  connected: boolean;
}
