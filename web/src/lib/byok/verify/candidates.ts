/**
 * Candidate model ranking for BYOK live inference probes.
 *
 * Orders lightweight chat models ahead of slow/expensive reasoning or vision models so key
 * verification completes quickly and cheaply without false negatives.
 */

import { isNonChatModel } from '../../../prototype/chat/modelAllowList.ts';
import { MAX_PROBE_ATTEMPTS, type VerifyTarget } from './types.ts';

const LIGHT_MODEL_PATTERN = /(mini|nano|flash|lite|small|tiny|haiku|instant|lightning|[^0-9]([1-9]b)\b|turbo)/i;
const HEAVY_MODEL_PATTERN =
  /(opus|[-/]pro\b|-pro-|large|ultra|405b|235b|480b|671b|1t\b|reasoner|reasoning|thinking|deep-research|preview|-exp\b|-vl\b|-vl-|vision|super)/i;

const OPENROUTER_CLEAN_FREE_PREFIXES = [
  'google/gemma',
  'meta-llama/',
  'qwen/',
  'mistralai/',
  'nvidia/',
  'liquid/',
];

const rankOpenRouterFreeModels = (freeModels: string[]): string[] => {
  const score = (id: string): number => {
    const lower = id.toLowerCase();
    const noisy = HEAVY_MODEL_PATTERN.test(lower);
    const prefixIndex = OPENROUTER_CLEAN_FREE_PREFIXES.findIndex((prefix) => lower.startsWith(prefix));
    if (prefixIndex !== -1 && !noisy) return prefixIndex;
    if (!noisy) return 100;
    if (prefixIndex !== -1) return 200 + prefixIndex;
    return 300;
  };
  return [...freeModels].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
};

/**
 * Light, widely available chat models per provider, tried right after the provider default.
 * `prefix` patterns also match dated / versioned ids (`gpt-4o-mini-2024-07-18`).
 */
const PROVIDER_PREFERRED_MODELS: Record<string, { mode: 'prefix' | 'exact'; patterns: string[] }> = {
  anthropic: {
    mode: 'prefix',
    patterns: ['claude-haiku-4-5', 'claude-3-5-haiku', 'claude-3-haiku', 'claude-sonnet-4-5', 'claude-sonnet-4'],
  },
  openai: {
    mode: 'prefix',
    patterns: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-3.5-turbo'],
  },
  google: {
    mode: 'prefix',
    patterns: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'],
  },
  groq: {
    mode: 'prefix',
    patterns: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'],
  },
  xai: {
    mode: 'prefix',
    patterns: ['grok-3-mini', 'grok-3', 'grok-4', 'grok-2'],
  },
  nvidia: {
    mode: 'exact',
    patterns: ['meta/llama-3.1-8b-instruct', 'google/gemma-3-4b-it', 'google/gemma-3-12b-it', 'mistralai/mistral-7b-instruct-v0.3'],
  },
  deepseek: {
    mode: 'exact',
    patterns: ['deepseek-chat', 'deepseek-reasoner'],
  },
};

const lightnessRank = (id: string): number => {
  if (HEAVY_MODEL_PATTERN.test(id)) return 2;
  return LIGHT_MODEL_PATTERN.test(id) ? 0 : 1;
};

const preferredModelsFor = (providerId: string, chatModels: string[]): string[] => {
  const spec = PROVIDER_PREFERRED_MODELS[providerId];
  if (!spec) return [];
  const picked: string[] = [];
  for (const pattern of spec.patterns) {
    const lowerPattern = pattern.toLowerCase();
    for (const id of chatModels) {
      const lowerId = id.toLowerCase();
      const isExact = lowerId === lowerPattern;
      const isVersioned =
        spec.mode === 'prefix' &&
        (lowerId.startsWith(`${lowerPattern}-`) || lowerId.startsWith(`${lowerPattern}:`));
      if (isExact || isVersioned) picked.push(id);
    }
  }
  return picked;
};

/**
 * Picks which models to probe: the caller's choice only; otherwise the provider default, then
 * light preferred models, then the remaining chat models ordered light-first.
 */
export const probeCandidates = (target: VerifyTarget, models: string[], explicitModel?: string): string[] => {
  if (explicitModel) return [explicitModel];
  const chatModels = models.filter((id) => !isNonChatModel(id));
  const ordered: string[] = [];
  if (target.defaultModel && (models.length === 0 || models.includes(target.defaultModel))) {
    ordered.push(target.defaultModel);
  }
  if (target.providerId === 'openrouter') {
    ordered.push(...rankOpenRouterFreeModels(chatModels.filter((id) => id.endsWith(':free'))));
  } else {
    ordered.push(...preferredModelsFor(target.providerId, chatModels));
  }
  const lightFirst = chatModels
    .map((id, index) => ({ id, index, rank: lightnessRank(id) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.id);
  return [...new Set([...ordered, ...lightFirst])].slice(0, MAX_PROBE_ATTEMPTS);
};
