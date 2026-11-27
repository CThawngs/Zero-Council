/**
 * Single source of truth for BYOK model allow-lists and non-chat capability exclusions.
 *
 * Keeps `fetchProviderModels`, `verifyProviderKey`, and UI model pickers focused on active
 * text-chat models while filtering out embeddings, audio/TTS/STT, image/video generation,
 * moderation/safety classifiers, legacy completion-only `-instruct` endpoints, and retired models.
 */

import type { BuiltinProviderId } from './byok.ts';

/**
 * Unified non-chat model exclusion pattern shared by both UI model filtering (`modelAllowList.ts`)
 * and strict server/client key verification (`lib/byok/verify.ts`).
 *
 * Note: `gpt-[^/]*-instruct` and `turbo-instruct` target legacy OpenAI completion-only endpoints
 * without excluding chat-tuned open-weight models like `meta/llama-3.1-8b-instruct`.
 */
export const NON_CHAT_MODEL_PATTERN =
  /(embed|whisper|tts|audio|voice|speech|transcri|dall-e|imagen|image-|-image\b|gpt-image|chatgpt-image|video|veo|sora|lyria|moderation|rerank|realtime|search-preview|guard|aqa|clip|ocr|starcoder|retriev|detector|safety|reward|pii|calibrat|translat|babbage|davinci|gpt-[^/]*-instruct|turbo-instruct|codex|computer-use|robotics)/i;

/** Backwards-compatible pattern array export wrapping `NON_CHAT_MODEL_PATTERN`. */
export const NON_TEXT_CHAT_PATTERNS: readonly RegExp[] = [NON_CHAT_MODEL_PATTERN];

/**
 * Returns `true` when `modelId` belongs to a non-text-chat capability (embeddings, audio/TTS/STT,
 * image/video generation, moderation, safety guards, legacy completion-only instruct, etc.).
 */
export const isNonChatModel = (modelId: string): boolean => NON_CHAT_MODEL_PATTERN.test(modelId.trim());

/** Valid OpenRouter `<vendor>/<model>` identifier (including `:free`, `:extended`, etc.). */
const OPENROUTER_MODEL_ID_PATTERN = /^[\w.-]+\/[\w.:-]+$/;

/**
 * Active text-chat model prefixes per built-in provider.
 *
 * - `google` includes live GA `gemini-2.5-*` (`gemini-2.5-pro`, `gemini-2.5-flash`,
 *   `gemini-2.5-flash-lite`) alongside `gemini-3.*` / `gemini-4*` and `gemma-3*` / `gemma-4*`.
 * - `openrouter` aggregates dozens of active text-chat vendors (`openai/`, `anthropic/`, `google/`,
 *   `meta-llama/`, `deepseek/`, `mistralai/`, `qwen/`, `nvidia/`, `liquid/`, `moonshotai/`,
 *   `minimax/`, `z-ai/`, `microsoft/`, `nousresearch/`, etc.), so any valid `<vendor>/<model>` ID
 *   that passes `!isNonChatModel` is accepted.
 */
export const MODEL_ALLOW_LIST: Partial<Record<BuiltinProviderId, readonly string[]>> = {
  google: ['gemini-2.5-', 'gemini-3.', 'gemini-3-', 'gemini-4', 'gemma-3', 'gemma-4'],
  openai: ['gpt-4o', 'gpt-4.1', 'gpt-4.5', 'gpt-5', 'gpt-6', 'o1', 'o3', 'o4', 'chatgpt-4o'],
  anthropic: [
    'claude-3-5-',
    'claude-3-7-',
    'claude-sonnet-4',
    'claude-opus-4',
    'claude-haiku-4',
    'claude-4-',
    'claude-sonnet-5',
    'claude-opus-5',
    'claude-haiku-5',
    'claude-fable-',
    'claude-5-',
  ],
  groq: [
    'llama-3.1-',
    'llama-3.3-',
    'llama-4-',
    'meta-llama/',
    'qwen',
    'deepseek-',
    'gemma2-',
    'mistral-',
    'mixtral-',
    'compound-',
    'openai/gpt-oss-',
  ],
  xai: ['grok-2', 'grok-3', 'grok-4', 'grok-code'],
  nvidia: [
    'meta/llama-3',
    'meta/llama-4',
    'deepseek-ai/',
    'qwen/',
    'mistralai/',
    'google/gemma',
    'nvidia/llama',
    'nvidia/nemotron',
  ],
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder', 'deepseek-v4', 'deepseek-flash'],
};

const BUILTIN_FILTERED_PROVIDERS: ReadonlySet<string> = new Set<BuiltinProviderId>([
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'openrouter',
  'nvidia',
  'deepseek',
]);

/**
 * Returns `true` when `modelId` is an active text-chat model for the given built-in provider.
 */
export const isAllowedBuiltinModel = (
  providerId: BuiltinProviderId,
  modelId: string
): boolean => {
  const id = modelId.trim();
  if (!id) return false;
  if (isNonChatModel(id)) return false;

  if (providerId === 'openrouter') {
    return OPENROUTER_MODEL_ID_PATTERN.test(id);
  }

  const allowPrefixes = MODEL_ALLOW_LIST[providerId];
  if (!allowPrefixes) return true;
  return allowPrefixes.some((prefix) => id.startsWith(prefix));
};

/**
 * Filters a list of raw model IDs to only active text-chat models for a built-in provider.
 */
export const filterBuiltinModels = (
  providerId: BuiltinProviderId,
  modelIds: string[]
): string[] => modelIds.filter((id) => isAllowedBuiltinModel(providerId, id));

/**
 * Returns the deduped list of models to display for a provider in UI dropdowns.
 * Built-in providers are filtered through `filterBuiltinModels`; custom providers keep all models
 * except non-chat capabilities when empty.
 */
export const visibleModelsForProvider = (
  providerId: string,
  models?: readonly string[],
  fallbackModel?: string
): string[] => {
  const base =
    models && models.length > 0
      ? [...models]
      : fallbackModel
        ? [fallbackModel]
        : [];
  const deduped = Array.from(new Set(base.map((m) => m.trim()).filter(Boolean)));
  if (BUILTIN_FILTERED_PROVIDERS.has(providerId)) {
    return filterBuiltinModels(providerId as BuiltinProviderId, deduped);
  }
  return deduped;
};
