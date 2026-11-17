import {
  AdvisorPersona,
  ApiKeyConfig,
  DeliberationSession,
  Language,
  ModelProvider,
  SupportedModel,
  frameworkIdOf,
} from '../types';
import { copy } from '../i18n';
import { PROVIDERS, builtinProviderById } from '../chat/byok';
import { buildFixtureRound, type CommunicationMode } from '@/lib/deliberation/engine';

const sessionFixture = (
  id: string,
  title: string,
  framework: DeliberationSession['framework'],
  language: Language = 'en'
): DeliberationSession => {
  const t = copy[language];
  const advisors = initialPersonas.map((persona) => localizePersona(persona, language));
  const mode: CommunicationMode =
    id === 'team-priority' ? 'debate' : id === 'process-change' ? 'chain' : 'independent';
  return {
    id,
    title,
    summary: t.sampleSessionSummary,
    framework,
    mode,
    timestamp: '2026-01-01T00:00:00Z',
    relativeTime: t.sample,
    status: 'Concluded',
    advisors,
    rounds: [
      buildFixtureRound({
        mode,
        framework: frameworkIdOf(framework),
        prompt: title,
        language,
        advisorIds: advisors.map((persona) => persona.id),
        advisorStances: advisors.reduce<Record<string, string>>((map, persona) => {
          map[persona.id] = persona.stance;
          return map;
        }, {}),
        roundIndex: 1,
      }),
    ],
    scenarios: {
      good: {
        title: t.favorableTitle,
        subtitle: t.illustrativeOnly,
        description: t.favorableDescription,
        actions: [t.favorableActionOne, t.favorableActionTwo],
      },
      normal: {
        title: t.baselineTitle,
        subtitle: t.illustrativeOnly,
        description: t.baselineDescription,
        actions: [t.baselineActionOne, t.baselineActionTwo],
      },
      bad: {
        title: t.difficultTitle,
        subtitle: t.illustrativeOnly,
        description: t.difficultDescription,
        actions: [t.difficultActionOne, t.difficultActionTwo],
      },
    },
  };
};

export const localizePersona = (persona: AdvisorPersona, language: Language): AdvisorPersona => {
  const t = copy[language];
  const translated: Record<
    string,
    Pick<AdvisorPersona, 'name' | 'archetype' | 'stance' | 'instructions' | 'sampleQuote'>
  > = {
    pragmatist: {
      name: t.pragmatistName,
      archetype: t.pragmatistArchetype,
      stance: t.pragmatistStance,
      instructions: t.pragmatistInstructions,
      sampleQuote: t.pragmatistQuote,
    },
    dreamer: {
      name: t.dreamerName,
      archetype: t.dreamerArchetype,
      stance: t.dreamerStance,
      instructions: t.dreamerInstructions,
      sampleQuote: t.dreamerQuote,
    },
    skeptic: {
      name: t.skepticName,
      archetype: t.skepticArchetype,
      stance: t.skepticStance,
      instructions: t.skepticInstructions,
      sampleQuote: t.skepticQuote,
    },
  };
  const fixture = translated[persona.id];
  if (fixture) return { ...persona, ...fixture };
  if (!persona.generatedName) return persona;
  return {
    ...persona,
    name: t.samplePersonaName.replace('{name}', persona.archetype),
    sampleQuote: t.samplePersonaQuote,
  };
};

export const initialPersonas: AdvisorPersona[] = [
  {
    id: 'pragmatist',
    name: copy.en.pragmatistName,
    archetype: copy.en.pragmatistArchetype,
    model: 'claude-sonnet-4-5',
    provider: 'anthropic',
    colorToken: 'persona-sage',
    colorHex: '#7C9885',
    stance: copy.en.pragmatistStance,
    instructions: copy.en.pragmatistInstructions,
    sampleQuote: copy.en.pragmatistQuote,
  },
  {
    id: 'dreamer',
    name: copy.en.dreamerName,
    archetype: copy.en.dreamerArchetype,
    model: 'gpt-4o',
    provider: 'openai',
    colorToken: 'persona-rose',
    colorHex: '#B98389',
    stance: copy.en.dreamerStance,
    instructions: copy.en.dreamerInstructions,
    sampleQuote: copy.en.dreamerQuote,
  },
  {
    id: 'skeptic',
    name: copy.en.skepticName,
    archetype: copy.en.skepticArchetype,
    model: 'gpt-4o-mini',
    provider: 'openai',
    colorToken: 'persona-slate',
    colorHex: '#6E85A6',
    stance: copy.en.skepticStance,
    instructions: copy.en.skepticInstructions,
    sampleQuote: copy.en.skepticQuote,
  },
];

export const initialSessions: DeliberationSession[] = [
  sessionFixture('project-proposal', copy.en.initialProjectTitle, 'Good / Normal / Bad Scenarios'),
  sessionFixture('team-priority', copy.en.initialTeamTitle, 'Six Thinking Hats'),
  sessionFixture('process-change', copy.en.initialProcessTitle, 'Decision Matrix'),
];

/** One row per verified built-in provider. Custom providers are appended dynamically per account. */
export const initialApiKeys: ApiKeyConfig[] = PROVIDERS.map((p) => ({
  provider: p.id,
  modelName: p.models[0]?.id ?? '',
  models: p.models.map((m) => m.id),
  connected: false,
  label: p.label,
  protocol: p.protocol,
  baseUrl: p.baseUrl,
  isCustom: false,
}));

const modelLabels: Record<SupportedModel, string> = {
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'grok-2-latest': 'Grok 2',
  'openai/gpt-4o-mini': 'OpenRouter GPT-4o mini',
  'meta/llama-3.1-70b-instruct': 'Llama 3.1 70B',
  'deepseek-chat': 'DeepSeek V3 Chat',
};

export const modelLabel = (model: string) =>
  (modelLabels as Record<string, string>)[model] ?? model;

export const providerLabel = (provider: ModelProvider, customLabel?: string) => {
  if (customLabel) return customLabel;
  const builtin = builtinProviderById(provider);
  if (builtin) return builtin.label;
  if (provider.startsWith('custom:openai:')) {
    return `${provider.slice('custom:openai:'.length)} (OpenAI API)`;
  }
  if (provider.startsWith('custom:anthropic:')) {
    return `${provider.slice('custom:anthropic:'.length)} (Anthropic API)`;
  }
  return provider;
};
