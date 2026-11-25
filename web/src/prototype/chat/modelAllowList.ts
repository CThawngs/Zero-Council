/**
 * Allow-lists and non-text-chat exclusion patterns for built-in BYOK providers.
 *
 * Keeps `fetchProviderModels` focused on active, text-chat models and filters out
 * retired/deprecated versions as well as video, voice, TTS, image, and embedding models.
 */

import type { BuiltinProviderId } from './byok.ts';

/**
 * Patterns for non-text-chat capabilities (video, voice/audio, TTS, image gen, embeddings, moderation).
 * Applied across all built-in providers before checking provider-specific allow-lists.
 */
export const NON_TEXT_CHAT_PATTERNS: readonly RegExp[] = [
  /\btts\b/i,
  /-tts\b/i,
  /\bwhisper\b/i,
  /\btranscribe\b/i,
  /\brealtime\b/i,
  /\bnative-audio\b/i,
  /\baudio\b/i,
  /\bvoice\b/i,
  /\bvideo\b/i,
  /\bveo\b/i,
  /\bsora\b/i,
  /\bimagen\b/i,
  /\bdall-e\b/i,
  /\bgpt-image\b/i,
  /-image\b/i,
  /\bembedding\b/i,
  /\bembed\b/i,
  /\bmoderation\b/i,
  /\brerank\b/i,
  /\baqa\b/i,
];

/**
 * Active text-chat model prefixes per built-in provider.
 * A model ID is kept if it does not match `NON_TEXT_CHAT_PATTERNS` and starts with
 * at least one prefix listed for its provider.
 */
export const MODEL_ALLOW_LIST: Partial<Record<BuiltinProviderId, readonly string[]>> = {
  // Google Gemini: keep active Gemini 3.x/4.x (e.g. Hydrogen, Argon) and Gemma 3/4 text models; exclude deprecated 1.5/2.0/2.5.
  google: ['gemini-3.', 'gemini-3-', 'gemini-4', 'gemma-3', 'gemma-4'],
  // OpenAI: keep active GPT-4o+, GPT-5/6, o-series, and ChatGPT text models; exclude retired gpt-3.5 and audio/tts/image.
  openai: ['gpt-4o', 'gpt-4.1', 'gpt-4.5', 'gpt-5', 'gpt-6', 'o1', 'o3', 'o4', 'chatgpt-4o'],
  // Anthropic (Claude): keep active Claude 3.5+ and Claude 4/5 text models; exclude retired claude-2/instant/3.0.
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
    'claude-5-',
  ],
  // Groq: active Llama, Qwen, DeepSeek, Gemma, Mistral/Mixtral, and GPT-OSS text models; excludes whisper/tts.
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
  // xAI (Grok): active Grok 2/3/4/code text models; non-text image/video models are excluded by NON_TEXT_CHAT_PATTERNS.
  xai: ['grok-2', 'grok-3', 'grok-4', 'grok-code'],
  // OpenRouter: major active text-chat vendor prefixes; non-text models are excluded by NON_TEXT_CHAT_PATTERNS.
  openrouter: [
    'openai/',
    'anthropic/',
    'google/',
    'meta-llama/',
    'deepseek/',
    'mistralai/',
    'qwen/',
    'x-ai/',
    'cohere/',
  ],
  // NVIDIA NIM: active Llama, DeepSeek, Qwen, Mistral, Gemma, and Nemotron text-chat models.
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
  // DeepSeek: active text-chat and reasoning models.
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
};

/**
 * Returns true when `modelId` is an active text-chat model for the given built-in provider.
 */
export const isAllowedBuiltinModel = (
  providerId: BuiltinProviderId,
  modelId: string
): boolean => {
  const id = modelId.trim();
  if (!id) return false;
  if (NON_TEXT_CHAT_PATTERNS.some((pattern) => pattern.test(id))) {
    return false;
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
 * Built-in providers are filtered through `filterBuiltinModels`; custom providers keep all models.
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
  if (Object.prototype.hasOwnProperty.call(MODEL_ALLOW_LIST, providerId)) {
    return filterBuiltinModels(providerId as BuiltinProviderId, deduped);
  }
  return deduped;
};
