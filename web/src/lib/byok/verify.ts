/**
 * Strict BYOK key verification — shared by the server routes and the browser fallback.
 *
 * Why this exists: `GET /models` is PUBLIC on several providers (OpenRouter, NVIDIA NIM, many
 * custom gateways) and answers 200 + a model list even for a garbage key. Treating that 200 as
 * "connected" let any random string pass. A key is therefore only verified when:
 *   1. it has a plausible shape (no whitespace, printable ASCII, not a placeholder), and
 *   2. a REAL authenticated inference call succeeds against a chat model, or the key was already
 *      authenticated by an endpoint that rejects anonymous callers and the only problem left is a
 *      temporary quota / rate limit on the probed model (reported as a `warning`), and
 *   3. for OpenRouter, `GET /auth/key` also accepts the key.
 *
 * Classification rules (no false negatives, no false positives):
 *   - 401, Google `API_KEY_INVALID`, or an explicit "invalid API key" body  -> INVALID_KEY (final).
 *   - 403 before the key was authenticated anywhere                        -> try the next model;
 *     INVALID_KEY only when every candidate refuses the key.
 *   - 403 after the key was authenticated (model / region access)           -> next model.
 *   - 402 / 429 / quota text                                                -> next model; when the
 *     key was authenticated this ends as CONNECTED with a warning instead of a failure.
 *   - HTML pages, unresolvable hosts, 404 with no JSON API behind it        -> INVALID_BASE_URL.
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
  | 'MODEL_ACCESS_DENIED'
  | 'NO_MODELS'
  | 'NETWORK_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_CREDITS'
  | 'PROVIDER_ERROR';

/** Conditions under which an AUTHENTICATED key is still reported as connected. */
export type VerifyWarningCode = 'RATE_LIMITED' | 'INSUFFICIENT_CREDITS';

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
  /** Wall-clock budget for the whole verification (all requests together). */
  totalBudgetMs?: number;
}

export type VerifySuccess = {
  ok: true;
  models: string[];
  verifiedModel: string;
  /** Set when the Base URL had to be adjusted (e.g. `/v1` appended) to reach the API. */
  resolvedBaseUrl?: string;
  /** Set when the key is authenticated but the probed model is temporarily unusable. */
  warning?: VerifyWarningCode;
};

export type VerifyResult = VerifySuccess | { ok: false; error: VerifyErrorCode };

export const ANTHROPIC_API_VERSION = '2023-06-01';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_TOTAL_BUDGET_MS = 45_000;
const MAX_PROBE_ATTEMPTS = 4;
const MAX_KEY_LENGTH = 512;
const MIN_KEY_LENGTH = 8;

/** Output budget of the probe. Large enough for reasoning models, still negligible in cost. */
export const PROBE_MAX_TOKENS = 16;
/** Raised budget for models that enforce a minimum output size. */
export const PROBE_RAISED_MAX_TOKENS = 64;

/** Providers whose `GET /models` rejects unauthenticated calls, so a 200 there proves the key. */
const AUTHENTICATED_MODEL_LIST_PROVIDERS = new Set([
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'deepseek',
]);

const ALL_ERROR_CODES: readonly VerifyErrorCode[] = [
  'EMPTY_KEY',
  'INVALID_KEY',
  'INVALID_BASE_URL',
  'MODEL_NOT_FOUND',
  'MODEL_ACCESS_DENIED',
  'NO_MODELS',
  'NETWORK_FAILED',
  'TIMEOUT',
  'RATE_LIMITED',
  'INSUFFICIENT_CREDITS',
  'PROVIDER_ERROR',
];

/** Model ids that cannot answer a chat completion (embeddings, audio, images, moderation, legacy completions …). */
export const NON_CHAT_MODEL_PATTERN =
  /(embed|whisper|tts|audio|speech|transcri|dall-e|imagen|image-|-image\b|gpt-image|chatgpt-image|moderation|rerank|realtime|search-preview|guard|aqa|veo|lyria|clip|ocr|starcoder|retriev|detector|safety|reward|pii|calibrat|translat|babbage|davinci|gpt-[^/]*-instruct|turbo-instruct|codex|computer-use|sora|robotics)/i;

const LIGHT_MODEL_PATTERN = /(mini|nano|flash|lite|small|tiny|haiku|instant|lightning|[^0-9]([1-9]b)\b|turbo)/i;
const HEAVY_MODEL_PATTERN =
  /(opus|[-/]pro\b|-pro-|large|ultra|405b|235b|480b|671b|1t\b|reasoner|reasoning|thinking|deep-research|preview|-exp\b|-vl\b|-vl-|vision|super)/i;

const PLACEHOLDER_KEY_PATTERN =
  /^(sk-ant-|sk-or-|sk-|gsk_|xai-|nvapi-|aiza)?(x+|\*+|\.+|0+|your[-_]?(api[-_]?)?key([-_]?here)?|api[-_]?key|key|test|placeholder|changeme|example|null|undefined|none)$/i;

/**
 * Explicit "this key is wrong" wording. Deliberately narrow: generic words such as `forbidden`,
 * `permission_denied` or a bare `api_key` mention also appear in model-access and region errors
 * for perfectly valid keys.
 */
const AUTH_ERROR_PATTERN =
  /(invalid[_ -]?api[_ -]?key|api[_ -]?key[_ -]?(is[_ -]?)?(not[_ -]?valid|invalid|expired|revoked|missing|required|not[_ -]?found)|incorrect[_ -]?api[_ -]?key|invalid[_ ]?token|invalid[_ ]?jwt|unauthori[sz]ed|unauthenticated|authentication[_ -]?(failed|fails|error)|authorization[_ -]?failed|no auth credentials|invalid x-api-key|missing bearer|user not found|API_KEY_INVALID)/i;

/** A 401 on `/models` with this wording is a restricted key without the "list models" scope. */
const MISSING_SCOPE_PATTERN = /(missing scopes?|insufficient permissions)/i;

const CREDITS_ERROR_PATTERN =
  /(insufficient[_ -]?(credits|quota|balance|funds)|credit balance is too low|exceeded your current quota|key limit exceeded|spend limit|monthly limit|billing hard limit|out of credits|(does not|doesn't) have (any )?credits|no credits)/i;

const MODEL_ERROR_PATTERN =
  /(model[^.]{0,60}(not found|does not exist|not exist|unknown|is not supported|not supported|not available|no such|invalid)|(unknown|invalid|unsupported|no such) model|model_not_found|no endpoints found)/i;

const TOKEN_PARAM_QUIRK_PATTERN =
  /(max_tokens|max_completion_tokens|maxoutputtokens|output limit|unsupported parameter|unsupported value|not supported with this model|minimum|at least|greater than|too small|thinking|budget|invalid_argument)/i;

const ENDPOINT_SUFFIX_PATTERN =
  /^(https?:\/\/[^/?#]+.*?)(\/(?:chat\/completions|completions|messages|responses|models(?:\/[^/?#]+(?::generateContent)?)?))\/?$/i;

/** Node.js network error codes meaning "nothing answers at this host" (not a transient blip). */
const UNREACHABLE_HOST_CODES = new Set([
  'ENOTFOUND',
  'EAI_NONAME',
  'EAI_NODATA',
  'ECONNREFUSED',
  'ERR_INVALID_URL',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
]);

/** Stable error carried through `throw` by the browser helpers in `prototype/chat/byok.ts`. */
export const isVerifyErrorCode = (value: unknown): value is VerifyErrorCode =>
  typeof value === 'string' && (ALL_ERROR_CODES as readonly string[]).includes(value);

const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]/g;

const unwrapQuotes = (value: string): string => {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1).replace(ZERO_WIDTH_PATTERN, '').trim();
  }
  return value;
};

/**
 * Strips zero-width paste artifacts, outer quotes, and an accidental `Bearer ` prefix while leaving
 * malformed inner spaces / non-ASCII untouched so `checkKeyShape` still rejects broken keys.
 */
export const sanitizeApiKey = (rawKey: unknown): string => {
  if (typeof rawKey !== 'string') return '';
  let cleaned = unwrapQuotes(rawKey.replace(ZERO_WIDTH_PATTERN, '').trim());
  const bearer = /^Bearer\s+([\x21-\x7E]+)$/i.exec(cleaned);
  if (bearer) {
    cleaned = bearer[1];
  }
  return cleaned;
};

/**
 * Trims, unwraps quotes, strips trailing slashes, and strips accidentally pasted endpoint paths
 * (`/chat/completions`, `/messages`, `/responses`, `/models/...`) down to the API root.
 */
export const normalizeProviderBaseUrl = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  let cleaned = unwrapQuotes(raw.replace(ZERO_WIDTH_PATTERN, '').trim());
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.replace(ENDPOINT_SUFFIX_PATTERN, '$1');
  return cleaned.replace(/\/+$/, '');
};

/**
 * Rejects keys that can never be valid before any network call is made.
 * Returns `null` when the shape is plausible (the provider still has the final word).
 */
export const checkKeyShape = (rawKey: unknown): 'EMPTY_KEY' | 'INVALID_KEY' | null => {
  if (typeof rawKey !== 'string') return 'EMPTY_KEY';
  const key = sanitizeApiKey(rawKey);
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
  const [first, second] = [Number(match[1]), Number(match[2])];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
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
  const normalized = normalizeProviderBaseUrl(raw);
  if (!normalized) return false;
  let url: URL;
  try {
    url = new URL(normalized);
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
  const base: Record<string, string> = {
    Accept: 'application/json',
    // Some gateways (Cloudflare bot rules) answer 403 to requests without a User-Agent. Browsers
    // forbid setting it, so it is only added on the server.
    ...(typeof window === 'undefined' ? { 'User-Agent': 'ZeroCouncil/1.0 (+key-verification)' } : {}),
  };
  if (protocol === 'anthropic') {
    return {
      ...base,
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_API_VERSION,
      // Needed for direct browser calls; harmless on the server.
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  if (protocol === 'google') return { ...base, 'x-goog-api-key': key };
  return { ...base, Authorization: `Bearer ${key}` };
};

/** Shared request context: one fetch implementation and one wall-clock deadline per verification. */
interface RequestContext {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  deadline: number;
}

type SendFailure = {
  error: 'NETWORK_FAILED' | 'TIMEOUT' | 'INVALID_BASE_URL';
  /** DNS / connection-refused / TLS-name failures: the host itself is wrong, not just flaky. */
  hostUnreachable?: boolean;
};

type Sent = { response: Response } | SendFailure;

const networkErrorCode = (error: unknown): string => {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  if (cause && typeof cause.code === 'string') return cause.code;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
};

const send = async (context: RequestContext, url: string, init: RequestInit): Promise<Sent> => {
  const remaining = context.deadline - Date.now();
  if (remaining <= 0) return { error: 'TIMEOUT' };
  try {
    const timeout = Math.min(context.timeoutMs, remaining);
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeout)
        : undefined;
    // `redirect: manual` stops a provider URL from bouncing the call to an internal host.
    const response = await context.fetchImpl(url, { ...init, redirect: 'manual', signal });
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      return { error: 'INVALID_BASE_URL' };
    }
    return { response };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return { error: 'TIMEOUT' };
    return { error: 'NETWORK_FAILED', hostUnreachable: UNREACHABLE_HOST_CODES.has(networkErrorCode(error)) };
  }
};

/** A classified non-2xx answer. `definitive` failures end the verification immediately. */
interface FailureVerdict {
  error: VerifyErrorCode;
  definitive: boolean;
}

interface ClassifyContext {
  /** The Base URL already answered a JSON model list, so it is a real API. */
  apiReachable: boolean;
  /** The key was already accepted by an endpoint that rejects anonymous callers. */
  authProven: boolean;
}

/** Maps a non-2xx provider answer to an error code plus whether trying another model can help. */
export const classifyHttpFailure = (
  status: number,
  bodyText: string,
  bodyKind: ParsedBody['kind'],
  context: ClassifyContext
): FailureVerdict => {
  if (status === 401) return { error: 'INVALID_KEY', definitive: true };
  // Once the key is authenticated, contradicting wording on a non-401 answer is a model or account
  // restriction, never proof that the key itself is wrong.
  if (!context.authProven && AUTH_ERROR_PATTERN.test(bodyText)) {
    return { error: 'INVALID_KEY', definitive: true };
  }
  if (status === 402) return { error: 'INSUFFICIENT_CREDITS', definitive: false };
  if (CREDITS_ERROR_PATTERN.test(bodyText)) return { error: 'INSUFFICIENT_CREDITS', definitive: false };
  if (status === 429) return { error: 'RATE_LIMITED', definitive: false };
  if (status === 403) {
    return context.authProven
      ? { error: 'MODEL_ACCESS_DENIED', definitive: false }
      : { error: 'INVALID_KEY', definitive: false };
  }
  // 410 Gone: the model reached end-of-life (NVIDIA answers this before checking the key).
  if (status === 410) return { error: 'MODEL_NOT_FOUND', definitive: false };
  if (status === 404 || status === 405) {
    if (bodyKind === 'json' || (context.apiReachable && bodyKind !== 'html')) {
      return { error: 'MODEL_NOT_FOUND', definitive: false };
    }
    return { error: 'INVALID_BASE_URL', definitive: true };
  }
  if (MODEL_ERROR_PATTERN.test(bodyText)) return { error: 'MODEL_NOT_FOUND', definitive: false };
  if (bodyKind === 'html') return { error: 'INVALID_BASE_URL', definitive: true };
  return { error: 'PROVIDER_ERROR', definitive: false };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Extracts model ids from OpenAI (`data`), Anthropic (`data`), Google (`models`) or bare arrays. */
export const parseModelList = (protocol: VerifyProtocol, value: unknown): string[] => {
  const record = asRecord(value);
  if (protocol === 'google') {
    const entries = Array.isArray(record?.models) ? (record?.models as unknown[]) : [];
    const ids = entries
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim().replace(/^models\//, '') || null;
        const item = asRecord(entry);
        if (!item) return null;
        if (
          Array.isArray(item.supportedGenerationMethods) &&
          !(item.supportedGenerationMethods as unknown[]).includes('generateContent')
        ) {
          return null;
        }
        return typeof item.name === 'string' ? item.name.trim().replace(/^models\//, '') || null : null;
      })
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
      if (typeof entry === 'string') return entry.trim() || null;
      const item = asRecord(entry);
      if (typeof item?.id === 'string') return item.id.trim() || null;
      if (typeof item?.name === 'string') return item.name.trim() || null;
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
  | { ok: false; error: VerifyErrorCode; looksLikeWebsite?: boolean; hostUnreachable?: boolean };

const fetchModelList = async (
  target: VerifyTarget,
  key: string,
  context: RequestContext
): Promise<ModelListOutcome> => {
  const sent = await send(context, `${target.baseUrl}/models`, {
    method: 'GET',
    headers: authHeaders(target.protocol, key),
  });
  if ('error' in sent) return { ok: false, error: sent.error, hostUnreachable: sent.hostUnreachable };
  const { response } = sent;
  const body = await readBody(response);
  if (response.ok) {
    // A 200 HTML/text page means the Base URL is a website, not an API.
    if (body.kind !== 'json') {
      return { ok: false, error: 'INVALID_BASE_URL', looksLikeWebsite: body.kind === 'html' };
    }
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
  const restrictedScope = response.status === 401 && MISSING_SCOPE_PATTERN.test(body.raw);
  const verdict = classifyHttpFailure(response.status, body.raw, body.kind, {
    apiReachable: false,
    authProven: false,
  });
  // Only an explicit key rejection ends the check here. Anything else (listing not exposed,
  // restricted key without the list scope, 403 from a bot filter, 429, 5xx) is decided by the
  // live inference probe.
  if (verdict.error === 'INVALID_KEY' && verdict.definitive && !restrictedScope) {
    return { ok: false, error: 'INVALID_KEY' };
  }
  return {
    ok: true,
    models: [],
    authProven: false,
    apiReachable: false,
    looksLikeWebsite: body.kind === 'html',
  };
};

/** OpenRouter's `/models` is public; `/auth/key` is the endpoint that actually checks the key. */
const checkOpenRouterKey = async (
  target: VerifyTarget,
  key: string,
  context: RequestContext
): Promise<{ ok: true } | { ok: false; error: VerifyErrorCode }> => {
  const sent = await send(context, `${target.baseUrl}/auth/key`, {
    method: 'GET',
    headers: authHeaders('openai', key),
  });
  if ('error' in sent) return { ok: false, error: sent.error };
  const body = await readBody(sent.response);
  if (!sent.response.ok) {
    const verdict = classifyHttpFailure(sent.response.status, body.raw, body.kind, {
      apiReachable: true,
      authProven: false,
    });
    if (verdict.error === 'MODEL_NOT_FOUND') return { ok: false, error: 'PROVIDER_ERROR' };
    return { ok: false, error: verdict.error };
  }
  if (body.kind !== 'json' || !asRecord(asRecord(body.value)?.data)) {
    return { ok: false, error: 'INVALID_KEY' };
  }
  return { ok: true };
};

type ProbeVariant = 'first' | 'retry' | 'budget';

const buildProbe = (
  target: VerifyTarget,
  key: string,
  model: string,
  variant: ProbeVariant
): { url: string; init: RequestInit } => {
  const tokens = variant === 'budget' ? PROBE_RAISED_MAX_TOKENS : PROBE_MAX_TOKENS;
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
    const googleTokens = variant === 'first' ? PROBE_MAX_TOKENS : PROBE_RAISED_MAX_TOKENS;
    return {
      url: `${target.baseUrl}/models/${encodeURIComponent(cleanModel)}:generateContent`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: googleTokens },
        }),
      },
    };
  }
  // OpenAI itself requires `max_completion_tokens` for reasoning / GPT-5 models; compatible gateways
  // typically expect `max_tokens`. `'retry'` swaps the field; `'budget'` restores the primary field
  // with a raised budget for models enforcing a minimum output size.
  const prefersCompletionTokens = target.providerId === 'openai';
  const useCompletionField = variant === 'retry' ? !prefersCompletionTokens : prefersCompletionTokens;
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

type ProbeOutcome =
  | { ok: true }
  | { ok: false; error: VerifyErrorCode; definitive: boolean; hostUnreachable?: boolean };

const probeOnce = async (
  target: VerifyTarget,
  key: string,
  model: string,
  context: RequestContext,
  classify: ClassifyContext
): Promise<ProbeOutcome> => {
  for (const variant of ['first', 'retry', 'budget'] as const) {
    const { url, init } = buildProbe(target, key, model, variant);
    const sent = await send(context, url, init);
    if ('error' in sent) {
      return {
        ok: false,
        error: sent.error,
        definitive: sent.error !== 'TIMEOUT',
        hostUnreachable: sent.hostUnreachable,
      };
    }
    const { response } = sent;
    const body = await readBody(response);

    if (response.ok) {
      if (body.kind !== 'json') return { ok: false, error: 'INVALID_BASE_URL', definitive: true };
      const errorField = asRecord(body.value)?.error;
      if (errorField) {
        // Gateways that always answer 200 and put the real status in the body.
        const detail = JSON.stringify(errorField);
        const embeddedStatus = Number(asRecord(errorField)?.code);
        return {
          ok: false,
          ...classifyHttpFailure(
            Number.isInteger(embeddedStatus) && embeddedStatus >= 400 ? embeddedStatus : 400,
            detail,
            'json',
            classify
          ),
        };
      }
      return looksLikeInference(target.protocol, body.value)
        ? { ok: true }
        : { ok: false, error: 'INVALID_BASE_URL', definitive: true };
    }

    const verdict = classifyHttpFailure(response.status, body.raw, body.kind, classify);
    const isTokenQuirk =
      (response.status === 400 || response.status === 422) &&
      verdict.error === 'PROVIDER_ERROR' &&
      TOKEN_PARAM_QUIRK_PATTERN.test(body.raw);
    if (!isTokenQuirk) return { ok: false, ...verdict };
    if (variant === 'budget') {
      // The provider understood the request and only disliked the output budget. That proves the
      // key ONLY when an authenticated endpoint already accepted it.
      return classify.authProven ? { ok: true } : { ok: false, error: 'PROVIDER_ERROR', definitive: false };
    }
  }
  return { ok: false, error: 'PROVIDER_ERROR', definitive: false };
};

/**
 * Sends a minimal live inference call for one model (`16` tokens -> swapped token field -> raised
 * budget). Persistent token-parameter quirks pass ONLY when `authProven` was already established
 * by an authenticated endpoint.
 */
export const probeModel = async (
  target: VerifyTarget,
  rawKey: string,
  model: string,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    authProven?: boolean;
    apiReachable?: boolean;
  } = {}
): Promise<{ ok: true } | { ok: false; error: VerifyErrorCode }> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outcome = await probeOnce(
    target,
    sanitizeApiKey(rawKey),
    model,
    { fetchImpl: options.fetchImpl ?? fetch, timeoutMs, deadline: Date.now() + DEFAULT_TOTAL_BUDGET_MS },
    { authProven: options.authProven === true, apiReachable: options.apiReachable === true }
  );
  return outcome.ok ? { ok: true } : { ok: false, error: outcome.error };
};

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
 * light preferred models, then the remaining chat models ordered light-first (never alphabetically
 * first, which used to pick huge vision / reasoning models).
 */
export const probeCandidates = (target: VerifyTarget, models: string[], explicitModel?: string): string[] => {
  if (explicitModel) return [explicitModel];
  const chatModels = models.filter((id) => !NON_CHAT_MODEL_PATTERN.test(id));
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

/** When nothing passed, the most useful error to show, most actionable first. */
const FAILURE_PRIORITY: readonly VerifyErrorCode[] = [
  'RATE_LIMITED',
  'INSUFFICIENT_CREDITS',
  'MODEL_ACCESS_DENIED',
  'TIMEOUT',
  'INVALID_KEY',
  'MODEL_NOT_FOUND',
  'NETWORK_FAILED',
  'PROVIDER_ERROR',
];

const pickFailure = (errors: VerifyErrorCode[]): VerifyErrorCode => {
  for (const code of FAILURE_PRIORITY) {
    if (errors.includes(code)) return code;
  }
  return errors[0] ?? 'NO_MODELS';
};

const isWarningCode = (code: VerifyErrorCode): code is VerifyWarningCode =>
  code === 'RATE_LIMITED' || code === 'INSUFFICIENT_CREDITS';

interface SingleVerifyOutcome {
  result: VerifyResult;
  looksLikeWebsite: boolean;
  hostUnreachable: boolean;
}

const runSingleVerify = async (
  target: VerifyTarget,
  key: string,
  context: RequestContext,
  explicitModel?: string
): Promise<SingleVerifyOutcome> => {
  const listed = await fetchModelList(target, key, context);
  if (!listed.ok) {
    return {
      result: { ok: false, error: listed.error },
      looksLikeWebsite: listed.looksLikeWebsite === true,
      hostUnreachable: listed.hostUnreachable === true,
    };
  }
  let authProven = listed.authProven;

  if (target.providerId === 'openrouter') {
    const auth = await checkOpenRouterKey(target, key, context);
    if (!auth.ok) return { result: auth, looksLikeWebsite: false, hostUnreachable: false };
    authProven = true;
  }

  const candidates = probeCandidates(target, listed.models, explicitModel);
  if (candidates.length === 0) {
    return {
      result: { ok: false, error: listed.looksLikeWebsite ? 'INVALID_BASE_URL' : 'NO_MODELS' },
      looksLikeWebsite: listed.looksLikeWebsite,
      hostUnreachable: false,
    };
  }

  const classify: ClassifyContext = { authProven, apiReachable: listed.apiReachable };
  const failures: { model: string; error: VerifyErrorCode }[] = [];
  for (const model of candidates) {
    const probe = await probeOnce(target, key, model, context, classify);
    if (probe.ok) {
      const models = [...new Set([model, ...listed.models])].sort();
      return {
        result: { ok: true, models, verifiedModel: model },
        looksLikeWebsite: false,
        hostUnreachable: false,
      };
    }
    if (probe.definitive) {
      return {
        result: { ok: false, error: probe.error },
        looksLikeWebsite: listed.looksLikeWebsite,
        hostUnreachable: probe.hostUnreachable === true,
      };
    }
    failures.push({ model, error: probe.error });
    // An authenticated key that is rate limited will be rate limited on every model: stop early.
    if (authProven && probe.error === 'RATE_LIMITED') break;
    if (probe.error === 'TIMEOUT' && Date.now() >= context.deadline) break;
  }

  const quotaHit = authProven ? failures.find((failure) => isWarningCode(failure.error)) : undefined;
  if (quotaHit && isWarningCode(quotaHit.error)) {
    return {
      result: {
        ok: true,
        models: [...new Set([quotaHit.model, ...listed.models])].sort(),
        verifiedModel: quotaHit.model,
        warning: quotaHit.error,
      },
      looksLikeWebsite: false,
      hostUnreachable: false,
    };
  }
  return {
    result: { ok: false, error: pickFailure(failures.map((failure) => failure.error)) },
    looksLikeWebsite: listed.looksLikeWebsite,
    hostUnreachable: false,
  };
};

const isCustomProvider = (providerId: string): boolean => providerId.startsWith('custom:');

const isBareOrigin = (baseUrl: string): boolean => {
  try {
    return new URL(baseUrl).pathname === '/';
  } catch {
    return false;
  }
};

/** Errors after which appending `/v1` to a custom bare origin is worth one more attempt. */
const V1_RESCUE_ERRORS: ReadonlySet<VerifyErrorCode> = new Set<VerifyErrorCode>([
  'INVALID_BASE_URL',
  'NO_MODELS',
  'MODEL_NOT_FOUND',
  'PROVIDER_ERROR',
]);

/**
 * Full strict verification: key shape -> model list -> (OpenRouter auth check) -> live inference
 * probe, with automatic `/v1` rescue for bare-origin custom gateways.
 */
export const verifyProviderKey = async (
  target: VerifyTarget,
  rawKey: string,
  options: VerifyOptions = {}
): Promise<VerifyResult> => {
  const shapeError = checkKeyShape(rawKey);
  if (shapeError) return { ok: false, error: shapeError };
  const key = sanitizeApiKey(rawKey);
  const baseUrl = normalizeProviderBaseUrl(target.baseUrl);
  if (!/^https?:\/\/[^\s/]+/i.test(baseUrl)) return { ok: false, error: 'INVALID_BASE_URL' };
  const normalizedTarget: VerifyTarget = { ...target, baseUrl };
  const context: RequestContext = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    deadline: Date.now() + (options.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS),
  };
  const explicitModel = options.model?.trim() || undefined;
  const custom = isCustomProvider(normalizedTarget.providerId);

  const initial = await runSingleVerify(normalizedTarget, key, context, explicitModel);
  if (initial.result.ok) {
    return baseUrl !== target.baseUrl ? { ...initial.result, resolvedBaseUrl: baseUrl } : initial.result;
  }
  // For a user-typed custom Base URL, a host that does not resolve or refuses connections is a
  // wrong Base URL, not a temporary network problem.
  if (initial.hostUnreachable && custom) return { ok: false, error: 'INVALID_BASE_URL' };

  if (custom && isBareOrigin(baseUrl) && V1_RESCUE_ERRORS.has(initial.result.error)) {
    const v1BaseUrl = `${baseUrl}/v1`;
    const rescued = await runSingleVerify({ ...normalizedTarget, baseUrl: v1BaseUrl }, key, context, explicitModel);
    if (rescued.result.ok) return { ...rescued.result, resolvedBaseUrl: v1BaseUrl };
    if (rescued.result.error === 'INVALID_KEY') return { ok: false, error: 'INVALID_KEY' };
  }

  return initial.result;
};

/** HTTP status our own API answers with for each verification error. */
export const httpStatusForVerifyError = (error: VerifyErrorCode): number => {
  switch (error) {
    case 'EMPTY_KEY':
    case 'INVALID_KEY':
    case 'INVALID_BASE_URL':
    case 'MODEL_NOT_FOUND':
    case 'MODEL_ACCESS_DENIED':
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
