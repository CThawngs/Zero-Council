export type ViewType =
  | 'overview'
  | 'sign-in'
  | 'empty-chamber'
  | 'session-active'
  | 'session-concluded'
  | 'sessions'
  | 'personas'
  | 'new-advisor'
  | 'api-keys'
  | 'pricing'
  | 'settings'
  | 'billing-history'
  | 'privacy';

export type Language = 'en' | 'vi';

export type Theme = 'dark' | 'light';

export type DecisionFramework =
  | 'Good / Normal / Bad Scenarios'
  | 'Six Thinking Hats'
  | 'Decision Matrix';

export type SupportedModel = 'Claude 4.6' | 'GPT-5.2' | 'Gemini 3 Pro';

export type ModelProvider = 'Anthropic' | 'OpenAI' | 'Google Gemini';

export interface AdvisorPersona {
  id: string;
  name: string; // "The [Archetype]"
  archetype: string;
  model: SupportedModel;
  provider: ModelProvider;
  colorToken: 'persona-rose' | 'persona-sage' | 'persona-slate' | 'persona-ochre';
  colorHex: string;
  stance: string;
  instructions: string;
  webSearchEnabled: boolean;
  generateDiagramEnabled: boolean;
  sampleQuote?: string;
  solvencyMetric?: string;
}

export interface DeliberationSession {
  id: string;
  title: string;
  summary: string;
  framework: DecisionFramework;
  timestamp: string;
  relativeTime: string;
  status: 'Concluded' | 'Deliberating' | 'Active';
  voteCount: number;
  voteSummary: string;
  referenceCode: string;
  advisors: AdvisorPersona[];
  baselineMetrics: {
    baselineCashflow: string;
    baseAdjustment: string;
    locationModel: string;
    commuteRecovery: string;
  };
  testimonies: {
    advisorId: string;
    heading: string;
    stanceBadge: string;
    primaryText: string;
    secondaryText: string;
    metricLabel: string;
    metricValue: string;
  }[];
  synthesis: {
    chairTitle: string;
    chairRole: string;
    statusBadge: string;
    coreRecommendation: string;
    stipulations: string[];
    tradeOffCalculus: {
      grossDeficit: string;
      effectiveLaborRate: string;
      reclaimedHours: string;
    };
    nextAction: string;
    quote: string;
  };
  scenarios: {
    good: {
      title: string;
      subtitle: string;
      description: string;
      actions: string[];
    };
    normal: {
      title: string;
      subtitle: string;
      description: string;
      actions: string[];
    };
    bad: {
      title: string;
      subtitle: string;
      description: string;
      actions: string[];
    };
  };
  matrixRows?: {
    criteria: string;
    criteriaDesc: string;
    weight: string;
    offerAScore: string;
    offerBScore: string;
    variance: string;
    favors: 'A' | 'B';
  }[];
}

export interface ApiKeyConfig {
  provider: ModelProvider;
  modelName: SupportedModel;
  connected: boolean;
  maskedKey?: string;
}

export interface InvoiceRecord {
  id: string;
  date: string;
  clearingTime: string;
  plan: string;
  receiptCode: string;
  amount: number; // in VNĐ
  status: 'Mock settled';
}
