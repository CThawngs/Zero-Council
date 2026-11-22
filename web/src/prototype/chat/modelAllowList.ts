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
  // Google Gemini: keep active Gemini 3.x+ and Gemma 3+ text models; exclude deprecated 1.5/2.0/2.5.
  google: ['gemini-3.', 'gemini-3-', 'gemma-3'],
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
