/**
 * Strict BYOK key verification entrypoint — shared by server routes and browser fallback.
 *
 * Orchestrates key-shape validation, SSRF safety checks, `/models` discovery, OpenRouter `/auth/key`
 * verification, and live minimal inference probes (`probeModel` / `verifyProviderKey`), while
 * delegating types, input sanitization, HTTP classification, and candidate ranking to `./verify/*`.
 */

import type { DnsLookupFn } from '../security/ssrf.ts';
import { visibleModelsForProvider } from '../../prototype/chat/modelAllowList.ts';
import {
  ANTHROPIC_API_VERSION,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TOTAL_BUDGET_MS,
  PROBE_MAX_TOKENS,
  PROBE_RAISED_MAX_TOKENS,
  httpStatusForVerifyError,
  isVerifyErrorCode,
  type ClassifyContext,
  type RequestContext,
  type VerifyErrorCode,
  type VerifyOptions,
  type VerifyProtocol,
  type VerifyResult,
  type VerifySuccess,
  type VerifyTarget,
  type VerifyWarningCode,
} from './verify/types.ts';
import {
  checkKeyShape,
  isAllowedProviderBaseUrl,
  isSafeCustomEndpointTarget,
  normalizeProviderBaseUrl,
  sanitizeApiKey,
} from './verify/input.ts';
import {
  AUTH_ERROR_PATTERN,
  MISSING_SCOPE_PATTERN,
  TOKEN_PARAM_QUIRK_PATTERN,
  asRecord,
  authHeaders,
  classifyHttpFailure,
  parseModelList,
  readBody,
  send,
} from './verify/classify.ts';
import { probeCandidates } from './verify/candidates.ts';

export {
  ANTHROPIC_API_VERSION,
  PROBE_MAX_TOKENS,
  checkKeyShape,
  classifyHttpFailure,
  httpStatusForVerifyError,
  isAllowedProviderBaseUrl,
  isVerifyErrorCode,
  normalizeProviderBaseUrl,
  parseModelList,
  probeCandidates,
  sanitizeApiKey,
};
export type {
  VerifyErrorCode,
  VerifyOptions,
  VerifyProtocol,
  VerifyResult,
  VerifySuccess,
  VerifyTarget,
  VerifyWarningCode,
};

/** Providers whose `GET /models` rejects unauthenticated calls, so a 200 there proves the key. */
const AUTHENTICATED_MODEL_LIST_PROVIDERS = new Set([
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'deepseek',
]);

type ModelListOutcome =
  | {
      ok: true;
      models: string[];
      authProven: boolean;
      apiReachable: boolean;
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
    if (body.kind !== 'json') {
      return { ok: false, error: 'INVALID_BASE_URL', looksLikeWebsite: body.kind === 'html' };
    }
    const errorField = asRecord(body.value)?.error;
    if (errorField && AUTH_ERROR_PATTERN.test(JSON.stringify(errorField))) {
      return { ok: false, error: 'INVALID_KEY' };
    }
    return {
      ok: true,
      models: visibleModelsForProvider(target.providerId, parseModelList(target.protocol, body.value)),
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
      return classify.authProven ? { ok: true } : { ok: false, error: 'PROVIDER_ERROR', definitive: false };
    }
  }
  return { ok: false, error: 'PROVIDER_ERROR', definitive: false };
};

/**
 * Sends a minimal live inference call for one model (`16` tokens -> swapped token field -> raised
 * budget). Persistent token-parameter quirks pass ONLY when `authProven` was already established.
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
    lookupImpl?: DnsLookupFn;
    allowPrivateNetwork?: boolean;
  } = {}
): Promise<{ ok: true } | { ok: false; error: VerifyErrorCode }> => {
  const activeFetch = options.fetchImpl ?? fetch;
  if (target.providerId.startsWith('custom:')) {
    const normalizedBase = normalizeProviderBaseUrl(target.baseUrl);
    if (!(await isSafeCustomEndpointTarget(normalizedBase, activeFetch, options))) {
      return { ok: false, error: 'INVALID_BASE_URL' };
    }
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outcome = await probeOnce(
    target,
    sanitizeApiKey(rawKey),
    model,
    { fetchImpl: activeFetch, timeoutMs, deadline: Date.now() + DEFAULT_TOTAL_BUDGET_MS },
    { authProven: options.authProven === true, apiReachable: options.apiReachable === true }
  );
  return outcome.ok ? { ok: true } : { ok: false, error: outcome.error };
};

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
  if (custom && !(await isSafeCustomEndpointTarget(baseUrl, context.fetchImpl, options))) {
    return { ok: false, error: 'INVALID_BASE_URL' };
  }

  const initial = await runSingleVerify(normalizedTarget, key, context, explicitModel);
  if (initial.result.ok) {
    return baseUrl !== target.baseUrl ? { ...initial.result, resolvedBaseUrl: baseUrl } : initial.result;
  }
  if (initial.hostUnreachable && custom) return { ok: false, error: 'INVALID_BASE_URL' };

  if (custom && isBareOrigin(baseUrl) && V1_RESCUE_ERRORS.has(initial.result.error)) {
    const v1BaseUrl = `${baseUrl}/v1`;
    const rescued = await runSingleVerify({ ...normalizedTarget, baseUrl: v1BaseUrl }, key, context, explicitModel);
    if (rescued.result.ok) return { ...rescued.result, resolvedBaseUrl: v1BaseUrl };
    if (rescued.result.error === 'INVALID_KEY') return { ok: false, error: 'INVALID_KEY' };
  }

  return initial.result;
};
