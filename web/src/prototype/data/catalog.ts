import type {
  AdvisorPersona,
  ApiKeyConfig,
  Language,
  ModelProvider,
  SupportedModel,
} from '../types';
import { copy } from '../i18n';
import { PROVIDERS, builtinProviderById } from '../chat/byok';

/** One row per verified built-in provider. Custom providers are appended dynamically per account. */
export const INITIAL_PROVIDERS: ApiKeyConfig[] = PROVIDERS.map((p) => ({
  provider: p.id,
  modelName: p.models[0]?.id ?? '',
  models: p.models.map((m) => m.id),
  connected: false,
  label: p.label,
  protocol: p.protocol,
  baseUrl: p.baseUrl,
  isCustom: false,
}));

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
  const preset = translated[persona.id];
  if (preset) return { ...persona, ...preset };
  if (!persona.generatedName) return persona;
  return {
    ...persona,
    name: t.samplePersonaName.replace('{name}', persona.archetype),
    sampleQuote: t.samplePersonaQuote,
  };
};

const modelLabels: Record<SupportedModel, string> = {
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'grok-2-latest': 'Grok 2',
  'openai/gpt-4o-mini': 'OpenRouter GPT-4o mini',
  'meta/llama-3.1-70b-instruct': 'Llama 3.1 70B',
  'deepseek-chat': 'DeepSeek V3 Chat',
};

export const modelLabel = (model: string): string =>
  (modelLabels as Record<string, string>)[model] ?? model;

export const providerLabel = (provider: ModelProvider, customLabel?: string): string => {
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
