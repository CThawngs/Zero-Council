/**
 * BYOK protocol adapters — the only place that knows how to call each AI provider.
 *
 * Two wire protocols are supported:
 *   - openai  : Bearer-token auth, /chat/completions endpoint (OpenAI, Groq, xAI, etc.)
 *   - anthropic: x-api-key auth, /messages endpoint
 *
 * Google Gemini uses a separate query-param scheme handled in byok.ts (prototype chat).
 * This module is for the deliberation engine only and does not touch the chat subsystem.
 *
 * Security: raw API keys are passed in by the caller (AppContext) and must NEVER be
 * stored, logged, or put into DOM attributes. This module only uses them for the
 * outbound fetch and immediately discards them.
 */

/** Anthropic API version header required by every request. */
export const ANTHROPIC_API_VERSION = '2023-06-01';

/** Max tokens we ask for in a single deliberation turn (keeps cost/latency bounded). */
const MAX_TOKENS = 1200;

export interface CallOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** System-level persona / instructions. */
  system: string;
  /** The user-visible prompt for this turn. */
  prompt: string;
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
      max_tokens: MAX_TOKENS,
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
      max_tokens: MAX_TOKENS,
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
