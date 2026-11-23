/**
 * Strict BYOK key verification — shared by the server routes and the browser fallback.
 *
 * Why this exists: `GET /models` is PUBLIC on several providers (OpenRouter, NVIDIA NIM, many
 * custom gateways) and answers 200 + a model list even for a garbage key. Treating that 200 as
 * "connected" let any random string pass. A key is therefore only verified when:
 *   1. it has a plausible shape (no whitespace, printable ASCII, not a placeholder), and
 *   2. a REAL authenticated inference call (1–4 output tokens) succeeds against a chat model, and
 *   3. for OpenRouter, `GET /auth/key` also accepts the key.
 *
 * Every failure is reported as a stable error code. Provider response bodies are never returned
 * to callers because some providers echo part of the key in their error text.
 *
 * Constraints: zero dependencies, no path aliases, erasable TypeScript only — this file is imported
 * by `node --test` directly (type stripping) as well as by Next.js.
 */

export type VerifyProtocol = 'openai' | 'anthropic' | 'google';

export type VerifyErrorCode =
  | 'EMPTY_KEY'
  | 'INVALID_KEY'
  | 'INVALID_BASE_URL'
  | 'MODEL_NOT_FOUND'
  | 'NO_MODELS'
  | 'NETWORK_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_CREDITS'
  | 'PROVIDER_ERROR';

export interface VerifyTarget {
  /** Built-in provider id (`openai`, `openrouter`, …) or `custom:<protocol>:<slug>`. */
  providerId: string;
  protocol: VerifyProtocol;
  /** Normalized base URL without trailing slash, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
  /** Model probed first when the caller did not pick one. */
  defaultModel?: string;
}

export interface VerifyOptions {
  /** Exact model to verify. When set, ONLY this model is probed (no silent substitution). */
  model?: string;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout. */
  timeoutMs?: number;
}

export type VerifyResult =
  | { ok: true; models: string[]; verifiedModel: string }
  | { ok: false; error: VerifyErrorCode };

export const ANTHROPIC_API_VERSION = '2023-06-01';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PROBE_ATTEMPTS = 5;
const MAX_KEY_LENGTH = 512;
const MIN_KEY_LENGTH = 8;

/** Providers whose `GET /models` rejects unauthenticated calls, so a 200 there proves the key. */
const AUTHENTICATED_MODEL_LIST_PROVIDERS = new Set([
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'deepseek',
]);

/** Model ids that cannot answer a chat completion (embeddings, audio, images, moderation …). */
const NON_CHAT_MODEL_PATTERN =
  /(embed|whisper|tts|audio|speech|transcri|dall-e|imagen|image-|moderation|rerank|realtime|guard|aqa|veo|lyria|clip|ocr|starcoder|retriev|detector|safety|reward|pii|calibrat|translat)/i;

const PLACEHOLDER_KEY_PATTERN =
  /^(sk-ant-|sk-or-|sk-|gsk_|xai-|nvapi-|aiza)?(x+|\*+|\.+|0+|your[-_]?(api[-_]?)?key([-_]?here)?|api[-_]?key|key|test|placeholder|changeme|example|null|undefined|none)$/i;

const AUTH_ERROR_PATTERN =
  /(api[_ -]?key|invalid[_ ]?token|unauthori[sz]ed|unauthenticated|authentication|no auth credentials|incorrect api key|permission[_ ]denied|invalid x-api-key|missing bearer|forbidden)/i;

const MODEL_ERROR_PATTERN =
  /(model[^.]{0,60}(not found|does not exist|not exist|unknown|is not supported|not supported|not available|no such|invalid)|(unknown|invalid|unsupported|no such) model|model_not_found|no endpoints found)/i;

const TOKEN_PARAM_QUIRK_PATTERN =
  /(max_tokens|max_completion_tokens|maxoutputtokens|output limit|unsupported parameter|unsupported value|not supported with this model)/i;

/** Stable error carried through `throw` by the browser helpers in `prototype/chat/byok.ts`. */
export const isVerifyErrorCode = (value: unknown): value is VerifyErrorCode =>
  typeof value === 'string' &&
  [
    'EMPTY_KEY',
    'INVALID_KEY',
    'INVALID_BASE_URL',
    'MODEL_NOT_FOUND',
    'NO_MODELS',
    'NETWORK_FAILED',
    'TIMEOUT',
    'RATE_LIMITED',
    'INSUFFICIENT_CREDITS',
    'PROVIDER_ERROR',
  ].includes(value);

/**
 * Rejects keys that can never be valid before any network call is made.
 * Returns `null` when the shape is plausible (the provider still has the final word).
 */
export const checkKeyShape = (rawKey: unknown): 'EMPTY_KEY' | 'INVALID_KEY' | null => {
  if (typeof rawKey !== 'string') return 'EMPTY_KEY';
  const key = rawKey.trim();
  if (!key) return 'EMPTY_KEY';
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) return 'INVALID_KEY';
  // Printable ASCII only: rejects inner whitespace, the "…" of copied placeholders, smart quotes.
  if (!/^[\x21-\x7E]+$/.test(key)) return 'INVALID_KEY';
  if (PLACEHOLDER_KEY_PATTERN.test(key)) return 'INVALID_KEY';
  return null;
};

const PRIVATE_HOSTNAME_PATTERN = /(^localhost$|\.localhost$|\.local$|\.internal$|\.home\.arpa$)/i;

const isPrivateIpv4 = (host: string): boolean => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

const isPrivateIpv6 = (host: string): boolean => {
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!bare.includes(':')) return false;
  if (bare === '::' || bare === '::1') return true;
  if (bare.startsWith('fc') || bare.startsWith('fd') || bare.startsWith('fe80')) return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(bare);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
};

/**
 * Validates a custom provider Base URL before the SERVER calls it (SSRF guard).
 * Literal private / loopback / link-local hosts are refused unless `allowPrivateNetwork`.
 * Note: DNS names that resolve to private IPs are not resolved here (no DNS lookup).
 */
export const isAllowedProviderBaseUrl = (
  raw: unknown,
  options: { allowPrivateNetwork: boolean }
): boolean => {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  if (options.allowPrivateNetwork) return true;
  if (url.protocol !== 'https:') return false;
  const host = url.hostname;
  return !(PRIVATE_HOSTNAME_PATTERN.test(host) || isPrivateIpv4(host) || isPrivateIpv6(host));
};

type ParsedBody =
  | { kind: 'json'; value: unknown; raw: string }
  | { kind: 'html'; raw: string }
  | { kind: 'text'; raw: string }
  | { kind: 'empty'; raw: '' };

const headerOf = (response: Response, name: string): string => {
  try {
    return response.headers?.get?.(name) ?? '';
  } catch {
    return '';
  }
};

/** Reads a body exactly once and tells JSON apart from HTML landing pages and plain text. */
const readBody = async (response: Response): Promise<ParsedBody> => {
  const contentType = headerOf(response, 'content-type').toLowerCase();
  let raw = '';
  if (typeof response.text === 'function') {
    raw = await response.text().catch(() => '');
  }
  const trimmed = raw.trim();
  if (trimmed) {
    try {
      return { kind: 'json', value: JSON.parse(trimmed), raw: trimmed };
    } catch {
      if (contentType.includes('text/html') || /^<(!doctype|html|head|body|\?xml)/i.test(trimmed)) {
        return { kind: 'html', raw: trimmed };
      }
      return { kind: 'text', raw: trimmed };
    }
  }
  if (contentType.includes('text/html')) return { kind: 'html', raw: '' };
  if (typeof response.json === 'function') {
    try {
      const value: unknown = await response.json();
      if (value !== undefined && value !== null) {
        return { kind: 'json', value, raw: JSON.stringify(value) };
      }
    } catch {
      // Body already consumed or not JSON: fall through to "empty".
    }
  }
  return { kind: 'empty', raw: '' };
};

const authHeaders = (protocol: VerifyProtocol, key: string): Record<string, string> => {
  if (protocol === 'anthropic') {
    return {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_API_VERSION,
      // Needed for direct browser calls; harmless on the server.
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  if (protocol === 'google') return { 'x-goog-api-key': key };
  return { Authorization: `Bearer ${key}` };
};

type Sent = { response: Response } | { error: 'NETWORK_FAILED' | 'TIMEOUT' | 'INVALID_BASE_URL' };

const send = async (
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Sent> => {
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    // `redirect: manual` stops a provider URL from bouncing the call to an internal host.
    const response = await fetchImpl(url, { ...init, redirect: 'manual', signal });
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      return { error: 'INVALID_BASE_URL' };
    }
    return { response };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    return { error: name === 'TimeoutError' || name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_FAILED' };
  }
};

/**
 * Maps a non-2xx provider answer to an error code. Auth problems always win.
 * `apiReachable` is true once the Base URL already answered a JSON model list: a later plain-text
 * 404/405 then means "this model has no chat endpoint" (NVIDIA NIM does this), not a wrong URL.
 */
const classifyHttpFailure = (status: number, body: ParsedBody, apiReachable = false): VerifyErrorCode => {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  const text = body.raw;
  if (AUTH_ERROR_PATTERN.test(text) || /API_KEY_INVALID/.test(text)) return 'INVALID_KEY';
  if (status === 402) return 'INSUFFICIENT_CREDITS';
  if (status === 429) return 'RATE_LIMITED';
  // 410 Gone: the model reached end-of-life (NVIDIA answers this before checking the key).
  if (status === 410) return 'MODEL_NOT_FOUND';
  if (status === 404 || status === 405) {
    if (body.kind === 'json' || (apiReachable && body.kind !== 'html')) return 'MODEL_NOT_FOUND';
    return 'INVALID_BASE_URL';
  }
  if (MODEL_ERROR_PATTERN.test(text)) return 'MODEL_NOT_FOUND';
  if (body.kind === 'html') return 'INVALID_BASE_URL';
  return 'PROVIDER_ERROR';
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Extracts model ids from OpenAI (`data`), Anthropic (`data`), Google (`models`) or bare arrays. */
export const parseModelList = (protocol: VerifyProtocol, value: unknown): string[] => {
  const record = asRecord(value);
  if (protocol === 'google') {
    const entries = Array.isArray(record?.models) ? (record?.models as unknown[]) : [];
    const ids = entries
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .filter(
        (entry) =>
          !Array.isArray(entry.supportedGenerationMethods) ||
          (entry.supportedGenerationMethods as unknown[]).includes('generateContent')
      )
      .map((entry) => (typeof entry.name === 'string' ? entry.name.replace(/^models\//, '') : null))
      .filter((id): id is string => Boolean(id));
    return [...new Set(ids)].sort();
  }
  const entries: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(record?.data)
      ? (record?.data as unknown[])
      : Array.isArray(record?.models)
        ? (record?.models as unknown[])
        : [];
  const ids = entries
    .map((entry) => {
      const item = asRecord(entry);
      if (typeof item?.id === 'string') return item.id;
      if (typeof item?.name === 'string') return item.name;
      return null;
    })
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)].sort();
};

type ModelListOutcome =
  | {
      ok: true;
      models: string[];
      authProven: boolean;
      /** The Base URL answered a JSON model list, so it is a real API. */
      apiReachable: boolean;
      /** `/models` answered an HTML page: the Base URL is most likely a website. */
      looksLikeWebsite: boolean;
    }
  | { ok: false; error: VerifyErrorCode };

const fetchModelList = async (
  target: VerifyTarget,
  key: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ModelListOutcome> => {
  const sent = await send(
    fetchImpl,
    `${target.baseUrl}/models`,
    { method: 'GET', headers: authHeaders(target.protocol, key) },
    timeoutMs
  );
  if ('error' in sent) return { ok: false, error: sent.error };
  const { response } = sent;
  const body = await readBody(response);
  if (response.ok) {
    // A 200 HTML/text page means the Base URL is a website, not an API.
    if (body.kind !== 'json') return { ok: false, error: 'INVALID_BASE_URL' };
    const errorField = asRecord(body.value)?.error;
    if (errorField && AUTH_ERROR_PATTERN.test(JSON.stringify(errorField))) {
      return { ok: false, error: 'INVALID_KEY' };
    }
    return {
      ok: true,
      models: parseModelList(target.protocol, body.value),
      authProven: AUTHENTICATED_MODEL_LIST_PROVIDERS.has(target.providerId),
      apiReachable: true,
      looksLikeWebsite: false,
    };
  }
  const failure = classifyHttpFailure(response.status, body);
  // Hard verdicts stop here; anything else (404 listing not exposed, 429, 5xx) is decided by the probe.
  if (failure === 'INVALID_KEY') return { ok: false, error: 'INVALID_KEY' };
  return { ok: true, models: [], authProven: false, apiReachable: false, looksLikeWebsite: body.kind === 'html' };
};

/** OpenRouter's `/models` is public; `/auth/key` is the endpoint that actually checks the key. */
const checkOpenRouterKey = async (
  target: VerifyTarget,
  key: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<{ ok: true } | { ok: false; error: VerifyErrorCode }> => {
  const sent = await send(
    fetchImpl,
    `${target.baseUrl}/auth/key`,
    { method: 'GET', headers: authHeaders('openai', key) },
    timeoutMs
  );
  if ('error' in sent) return { ok: false, error: sent.error };
  const body = await readBody(sent.response);
  if (!sent.response.ok) {
    const failure = classifyHttpFailure(sent.response.status, body);
    return { ok: false, error: failure === 'MODEL_NOT_FOUND' ? 'PROVIDER_ERROR' : failure };
  }
  if (body.kind !== 'json' || !asRecord(asRecord(body.value)?.data)) {
    return { ok: false, error: 'INVALID_KEY' };
  }
  return { ok: true };
};

const buildProbe = (
  target: VerifyTarget,
  key: string,
  model: string,
  variant: 'first' | 'retry'
): { url: string; init: RequestInit } => {
  const tokens = variant === 'first' ? 1 : 4;
  const headers = { 'content-type': 'application/json', ...authHeaders(target.protocol, key) };
  if (target.protocol === 'anthropic') {
    return {
      url: `${target.baseUrl}/messages`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, max_tokens: tokens, messages: [{ role: 'user', content: 'ping' }] }),
      },
    };
  }
  if (target.protocol === 'google') {
    const cleanModel = model.replace(/^models\//, '');
    return {
      url: `${target.baseUrl}/models/${encodeURIComponent(cleanModel)}:generateContent`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: tokens },
        }),
      },
    };
  }
  // OpenAI itself prefers `max_completion_tokens` (required by reasoning models); most compatible
  // gateways only know `max_tokens`. The retry swaps the field in case the first one was refused.
  const prefersCompletionTokens = target.providerId === 'openai';
  const useCompletionField = variant === 'first' ? prefersCompletionTokens : !prefersCompletionTokens;
  const tokenField = useCompletionField ? { max_completion_tokens: tokens } : { max_tokens: tokens };
  return {
    url: `${target.baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, ...tokenField, messages: [{ role: 'user', content: 'ping' }] }),
    },
  };
};

/** True when a 2xx JSON body really is an inference answer for the given wire protocol. */
const looksLikeInference = (protocol: VerifyProtocol, value: unknown): boolean => {
  const record = asRecord(value);
  if (!record) return false;
  if (protocol === 'anthropic') return Array.isArray(record.content) || record.type === 'message';
  if (protocol === 'google') return Array.isArray(record.candidates) || asRecord(record.usageMetadata) !== null;
  return Array.isArray(record.choices);
};

type ProbeOutcome = { ok: true } | { ok: false; error: VerifyErrorCode };

/**
 * Sends one real minimal inference call. A 400 that only complains about the token parameter is
 * retried once with the other field; if it still fails it counts as verified ONLY when the key was
 * already proven by an authenticated endpoint (`authProven`).
 */
export const probeModel = async (
  target: VerifyTarget,
  key: string,
  model: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; authProven?: boolean; apiReachable?: boolean } = {}
): Promise<ProbeOutcome> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (const variant of ['first', 'retry'] as const) {
    const { url, init } = buildProbe(target, key, model, variant);
    const sent = await send(fetchImpl, url, init, timeoutMs);
    if ('error' in sent) return { ok: false, error: sent.error };
    const { response } = sent;
    const body = await readBody(response);

    if (response.ok) {
      if (body.kind !== 'json') return { ok: false, error: 'INVALID_BASE_URL' };
      const errorField = asRecord(body.value)?.error;
      if (errorField) {
        const detail = JSON.stringify(errorField);
        if (AUTH_ERROR_PATTERN.test(detail)) return { ok: false, error: 'INVALID_KEY' };
        return { ok: false, error: MODEL_ERROR_PATTERN.test(detail) ? 'MODEL_NOT_FOUND' : 'PROVIDER_ERROR' };
      }
      return looksLikeInference(target.protocol, body.value)
        ? { ok: true }
        : { ok: false, error: 'INVALID_BASE_URL' };
    }

    const failure = classifyHttpFailure(response.status, body, options.apiReachable === true);
    const isTokenQuirk =
      response.status === 400 && failure === 'PROVIDER_ERROR' && TOKEN_PARAM_QUIRK_PATTERN.test(body.raw);
    if (!isTokenQuirk) return { ok: false, error: failure };
    if (variant === 'retry') {
      return options.authProven ? { ok: true } : { ok: false, error: 'PROVIDER_ERROR' };
    }
  }
  return { ok: false, error: 'PROVIDER_ERROR' };
};

/** Picks which models to probe: the caller's choice only, otherwise default + discovered chat models. */
const probeCandidates = (target: VerifyTarget, models: string[], explicitModel?: string): string[] => {
  if (explicitModel) return [explicitModel];
  const chatModels = models.filter((id) => !NON_CHAT_MODEL_PATTERN.test(id));
  const preferred: string[] = [];
  if (target.defaultModel && (models.length === 0 || models.includes(target.defaultModel))) {
    preferred.push(target.defaultModel);
  }
  // OpenRouter keys without credits can still run free models.
  if (target.providerId === 'openrouter') {
    const free = chatModels.find((id) => id.endsWith(':free'));
    if (free) preferred.push(free);
  }
  return [...new Set([...preferred, ...chatModels])].slice(0, MAX_PROBE_ATTEMPTS);
};

/** Errors after which trying another model cannot help. */
const STOP_ERRORS: ReadonlySet<VerifyErrorCode> = new Set<VerifyErrorCode>([
  'INVALID_KEY',
  'INVALID_BASE_URL',
  'NETWORK_FAILED',
  'TIMEOUT',
  'RATE_LIMITED',
]);

/**
 * Full strict verification: key shape → model list → (OpenRouter auth check) → live inference probe.
 * Never resolves `ok: true` unless an authenticated inference call succeeded.
 */
export const verifyProviderKey = async (
  target: VerifyTarget,
  rawKey: string,
  options: VerifyOptions = {}
): Promise<VerifyResult> => {
  const shapeError = checkKeyShape(rawKey);
  if (shapeError) return { ok: false, error: shapeError };
  const key = rawKey.trim();
  const baseUrl = typeof target.baseUrl === 'string' ? target.baseUrl.trim().replace(/\/+$/, '') : '';
  if (!/^https?:\/\/[^\s/]+/i.test(baseUrl)) return { ok: false, error: 'INVALID_BASE_URL' };
  const normalizedTarget: VerifyTarget = { ...target, baseUrl };
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const explicitModel = options.model?.trim() || undefined;

  const listed = await fetchModelList(normalizedTarget, key, fetchImpl, timeoutMs);
  if (!listed.ok) return listed;
  let authProven = listed.authProven;

  if (normalizedTarget.providerId === 'openrouter') {
    const auth = await checkOpenRouterKey(normalizedTarget, key, fetchImpl, timeoutMs);
    if (!auth.ok) return auth;
    authProven = true;
  }

  const candidates = probeCandidates(normalizedTarget, listed.models, explicitModel);
  if (candidates.length === 0) {
    return { ok: false, error: listed.looksLikeWebsite ? 'INVALID_BASE_URL' : 'NO_MODELS' };
  }

  let lastError: VerifyErrorCode = 'NO_MODELS';
  for (const model of candidates) {
    const probe = await probeModel(normalizedTarget, key, model, {
      fetchImpl,
      timeoutMs,
      authProven,
      apiReachable: listed.apiReachable,
    });
    if (probe.ok) {
      const models = [...new Set([model, ...listed.models])].sort();
      return { ok: true, models, verifiedModel: model };
    }
    lastError = probe.error;
    if (STOP_ERRORS.has(probe.error)) break;
  }
  return { ok: false, error: lastError };
};

/** HTTP status our own API answers with for each verification error. */
export const httpStatusForVerifyError = (error: VerifyErrorCode): number => {
  switch (error) {
    case 'EMPTY_KEY':
    case 'INVALID_KEY':
    case 'INVALID_BASE_URL':
    case 'MODEL_NOT_FOUND':
    case 'NO_MODELS':
      return 422;
    case 'RATE_LIMITED':
      return 429;
    case 'INSUFFICIENT_CREDITS':
      return 402;
    case 'TIMEOUT':
      return 504;
    default:
      return 502;
  }
};
