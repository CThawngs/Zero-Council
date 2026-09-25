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
  | 'privacy';

export type Language = 'en' | 'vi';
export type Theme = 'dark' | 'light';

export type DecisionFramework =
  | 'Good / Normal / Bad Scenarios'
  | 'Six Thinking Hats'
  | 'Decision Matrix';

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
