/**
 * BYOK protocol adapters — server-side single-turn calls to each AI provider.
 *
 * Three wire protocols are supported:
 *   - openai   : Bearer-token auth, POST /chat/completions (OpenAI, Groq, xAI, OpenRouter, NVIDIA, DeepSeek, custom)
 *   - anthropic: x-api-key auth, POST /messages (Anthropic, custom Anthropic-compatible gateways)
 *   - google   : x-goog-api-key auth, POST /models/<model>:generateContent (Google Gemini)
 *
 * Key verification (garbage-key detection) lives in `./verify.ts`; this module only performs calls
 * with keys that the caller already holds.
 *
 * Security: raw API keys are passed in by the caller and must NEVER be stored, logged, or put into
 * DOM attributes. Error messages contain the HTTP status and a trimmed provider body only.
 */

import { ANTHROPIC_API_VERSION } from './verify.ts';

export { ANTHROPIC_API_VERSION };

export type WireProtocol = 'openai' | 'anthropic' | 'google';

/** Canonical base URL used when a stored record has no explicit one. */
export const DEFAULT_BASE_URL: Record<WireProtocol, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

/** Max tokens we ask for in a single deliberation turn (4096 gives reasoning/thinking models room for both thoughts and output). */
const MAX_TOKENS = 4096;

export interface CallOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** System-level persona / instructions. */
  system: string;
  /** The user-visible prompt for this turn. */
  prompt: string;
  /** Override the output token budget (defaults to MAX_TOKENS). */
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Throw a clear, loggable error — intern can read and understand immediately. */
const fail = (prefix: string, status: number, body: string): never => {
  throw new Error(`${prefix}: ${status} ${body.slice(0, 200)}`);
};

/**
 * OpenAI-compatible single-turn text completion.
 * Works with: OpenAI, Groq, xAI, OpenRouter, NVIDIA NIM, DeepSeek,
 * and any custom provider that speaks the OpenAI wire protocol.
 */
export const callOpenAI = async (opts: CallOptions): Promise<string> => {
  const response = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.prompt },
      ],
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    fail(`OpenAI-compatible call failed (${opts.model})`, response.status, await response.text().catch(() => ''));
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  return (payload.choices?.[0]?.message?.content ?? '').trim();
};

/**
 * Anthropic native single-turn text completion.
 * Works with: Anthropic Claude, and custom providers that speak the Anthropic wire protocol.
 */
export const callAnthropic = async (opts: CallOptions): Promise<string> => {
  const response = await fetch(`${opts.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      // Required for direct browser access; harmless server-side.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    fail(`Anthropic call failed (${opts.model})`, response.status, await response.text().catch(() => ''));
  }

  const payload = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();
};

/**
 * Google Gemini single-turn text completion (v1beta generateContent).
 * The key travels in the `x-goog-api-key` header, never in the URL query string, so it cannot
 * leak into proxy or access logs.
 */
export const callGoogle = async (opts: CallOptions): Promise<string> => {
  const modelId = opts.model.replace(/^models\//, '');
  const response = await fetch(`${opts.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
      generationConfig: { maxOutputTokens: opts.maxTokens ?? MAX_TOKENS },
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    fail(`Google Gemini call failed (${opts.model})`, response.status, await response.text().catch(() => ''));
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  return (payload.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
};

/** Dispatches to the adapter matching the stored provider protocol. */
export const callByProtocol = (protocol: WireProtocol, opts: CallOptions): Promise<string> => {
  if (protocol === 'anthropic') return callAnthropic(opts);
  if (protocol === 'google') return callGoogle(opts);
  return callOpenAI(opts);
};
