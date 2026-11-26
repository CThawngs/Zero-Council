/**
 * HTTP transport, response body reader, error classifier, and model-list parser for BYOK verification.
 *
 * Separates wire-protocol quirks (JSON vs HTML error pages, embedded status codes, redirect refusal)
 * from the high-level verification state machine in `../verify.ts`.
 */

import {
  ANTHROPIC_API_VERSION,
  type ClassifyContext,
  type FailureVerdict,
  type ParsedBody,
  type RequestContext,
  type VerifyProtocol,
} from './types.ts';

/**
 * Explicit "this key is wrong" wording. Deliberately narrow: generic words such as `forbidden`,
 * `permission_denied` or a bare `api_key` mention also appear in model-access and region errors
 * for perfectly valid keys.
 */
export const AUTH_ERROR_PATTERN =
  /(invalid[_ -]?api[_ -]?key|api[_ -]?key[_ -]?(is[_ -]?)?(not[_ -]?valid|invalid|expired|revoked|missing|required|not[_ -]?found)|incorrect[_ -]?api[_ -]?key|invalid[_ ]?token|invalid[_ ]?jwt|unauthori[sz]ed|unauthenticated|authentication[_ -]?(failed|fails|error)|authorization[_ -]?failed|no auth credentials|invalid x-api-key|missing bearer|user not found|API_KEY_INVALID)/i;

/** A 401 on `/models` with this wording is a restricted key without the "list models" scope. */
export const MISSING_SCOPE_PATTERN = /(missing scopes?|insufficient permissions)/i;

export const TOKEN_PARAM_QUIRK_PATTERN =
  /(max_tokens|max_completion_tokens|maxoutputtokens|output limit|unsupported parameter|unsupported value|not supported with this model|minimum|at least|greater than|too small|thinking|budget|invalid_argument)/i;

const CREDITS_ERROR_PATTERN =
  /(insufficient[_ -]?(credits|quota|balance|funds)|credit balance is too low|exceeded your current quota|key limit exceeded|spend limit|monthly limit|billing hard limit|out of credits|(does not|doesn't) have (any )?credits|no credits)/i;

const MODEL_ERROR_PATTERN =
  /(model[^.]{0,60}(not found|does not exist|not exist|unknown|is not supported|not supported|not available|no such|invalid)|(unknown|invalid|unsupported|no such) model|model_not_found|no endpoints found)/i;

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

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const headerOf = (response: Response, name: string): string => {
  try {
    return response.headers?.get?.(name) ?? '';
  } catch {
    return '';
  }
};

/** Reads a body exactly once and tells JSON apart from HTML landing pages and plain text. */
export const readBody = async (response: Response): Promise<ParsedBody> => {
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

export const authHeaders = (protocol: VerifyProtocol, key: string): Record<string, string> => {
  const base: Record<string, string> = {
    Accept: 'application/json',
    ...(typeof window === 'undefined' ? { 'User-Agent': 'ZeroCouncil/1.0 (+key-verification)' } : {}),
  };
  if (protocol === 'anthropic') {
    return {
      ...base,
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  if (protocol === 'google') return { ...base, 'x-goog-api-key': key };
  return { ...base, Authorization: `Bearer ${key}` };
};

export type SendFailure = {
  error: 'NETWORK_FAILED' | 'TIMEOUT' | 'INVALID_BASE_URL';
  hostUnreachable?: boolean;
};

export type Sent = { response: Response } | SendFailure;

const networkErrorCode = (error: unknown): string => {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  if (cause && typeof cause.code === 'string') return cause.code;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
};

/** Executes a bounded HTTP request with `redirect: 'manual'` so endpoints never bounce to internal IPs. */
export const send = async (context: RequestContext, url: string, init: RequestInit): Promise<Sent> => {
  const remaining = context.deadline - Date.now();
  if (remaining <= 0) return { error: 'TIMEOUT' };
  try {
    const timeout = Math.min(context.timeoutMs, remaining);
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeout)
        : undefined;
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

/** Maps a non-2xx provider answer to an error code plus whether trying another model can help. */
export const classifyHttpFailure = (
  status: number,
  bodyText: string,
  bodyKind: ParsedBody['kind'],
  context: ClassifyContext
): FailureVerdict => {
  if (status === 401) return { error: 'INVALID_KEY', definitive: true };
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

/** Extracts model ids from OpenAI (`data`), Anthropic (`data`), Google (`models`) or bare arrays. */
export const parseModelList = (protocol: VerifyProtocol, value: unknown): string[] => {
  const record = asRecord(value);
  if (protocol === 'google') {
    const entries = Array.isArray(record?.models) ? (record.models as unknown[]) : [];
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
      ? (record.data as unknown[])
      : Array.isArray(record?.models)
        ? (record.models as unknown[])
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
