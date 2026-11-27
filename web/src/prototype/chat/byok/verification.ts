/**
 * Strict BYOK connection verification and per-model probing helpers.
 *
 * Uses `/api/providers/verify` when signed in so browser CORS never blocks verification and
 * server-side SSRF/inference rules apply uniformly, falling back to direct client verification
 * only when the app server cannot judge (e.g., signed-out preview or unit test harness).
 */

import {
  checkKeyShape,
  probeModel,
  sanitizeApiKey,
  verifyProviderKey,
  type VerifyWarningCode,
} from '../../../lib/byok/verify.ts';
import { visibleModelsForProvider } from '../modelAllowList.ts';
import {
  resolveProviderEndpoint,
  verifyTargetFor,
  type Credentials,
  type ProviderEndpointSpec,
  type ProviderId,
} from './providers.ts';

/** Outcome of a successful provider connection test before saving a key. */
export interface ProviderConnectionResult {
  models: string[];
  verifiedModel: string;
  /** Base URL that answered during verification (normalized, with `/v1` auto-discovered if needed). */
  resolvedBaseUrl?: string;
  /** Indicates the key is authentic, though the probed model hit rate limits or quota exhaustion. */
  warning?: VerifyWarningCode;
}

const throwCode = (code: string): never => {
  throw new Error(code);
};

const isWarning = (value: unknown): value is VerifyWarningCode =>
  value === 'RATE_LIMITED' || value === 'INSUFFICIENT_CREDITS';

/**
 * Direct strict verification against the upstream provider. Requires a genuine authenticated
 * inference probe to pass — public `200 /models` lists or HTML login pages are rejected.
 */
export const verifyProviderKeyDirect = async (
  target: ProviderId | ProviderEndpointSpec,
  apiKey: string,
  options: { model?: string } = {}
): Promise<ProviderConnectionResult> => {
  const result = await verifyProviderKey(verifyTargetFor(target), apiKey, { model: options.model });
  if (!result.ok) return throwCode(result.error);
  return {
    models: result.models,
    verifiedModel: result.verifiedModel,
    ...(result.resolvedBaseUrl ? { resolvedBaseUrl: result.resolvedBaseUrl } : {}),
    ...(result.warning ? { warning: result.warning } : {}),
  };
};

/**
 * Verifies a provider key and returns its curated live model list in a single strict call.
 */
export const fetchProviderModels = async (
  target: ProviderId | ProviderEndpointSpec,
  apiKey: string
): Promise<string[]> => (await verifyProviderKeyDirect(target, apiKey)).models;

/**
 * Verifies a provider key via `POST /api/providers/verify`, falling back to `verifyProviderKeyDirect`
 * only when the server route is unreachable or the user is signed out (`NEED_LOGIN`).
 */
export const verifyProviderConnection = async (
  target: ProviderId | ProviderEndpointSpec,
  apiKey: string,
  options: { model?: string } = {}
): Promise<ProviderConnectionResult> => {
  const shapeError = checkKeyShape(apiKey);
  if (shapeError) return throwCode(shapeError);
  const endpoint = resolveProviderEndpoint(target);

  let response: Response | null = null;
  try {
    response = await fetch('/api/providers/verify', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: endpoint.provider,
        key: sanitizeApiKey(apiKey),
        ...(options.model ? { model: options.model } : {}),
        ...(endpoint.isBuiltin ? {} : { protocol: endpoint.protocol, baseUrl: endpoint.baseUrl }),
      }),
    });
  } catch {
    response = null;
  }

  const payload = response
    ? ((await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: unknown;
            models?: unknown;
            verifiedModel?: unknown;
            resolvedBaseUrl?: unknown;
            warning?: unknown;
          }
        | null)
    : null;

  const serverCannotJudge =
    !response || !payload || response.status === 404 || payload.error === 'NEED_LOGIN';
  if (serverCannotJudge) return verifyProviderKeyDirect(target, apiKey, options);

  if (payload.ok === true && typeof payload.verifiedModel === 'string' && Array.isArray(payload.models)) {
    const rawModels = payload.models.filter((m): m is string => typeof m === 'string');
    const models = visibleModelsForProvider(endpoint.provider, rawModels, payload.verifiedModel);
    return {
      models: models.length > 0 ? models : [payload.verifiedModel],
      verifiedModel: payload.verifiedModel,
      ...(typeof payload.resolvedBaseUrl === 'string' ? { resolvedBaseUrl: payload.resolvedBaseUrl } : {}),
      ...(isWarning(payload.warning) ? { warning: payload.warning } : {}),
    };
  }
  return throwCode(typeof payload.error === 'string' ? payload.error : 'PROVIDER_ERROR');
};

/**
 * Probes an exact custom model ID with a minimal live inference call before adding it to a provider.
 */
export const testProviderModel = async (
  credentials: Omit<Credentials, 'model'>,
  modelId: string
): Promise<true> => {
  const shapeError = checkKeyShape(credentials.apiKey);
  if (shapeError) return throwCode(shapeError);
  const model = modelId.trim();
  if (!model) return throwCode('EMPTY_MODEL');
  const target = verifyTargetFor(credentials);
  if (!/^https?:\/\//i.test(target.baseUrl)) return throwCode('INVALID_BASE_URL');
  const probe = await probeModel(target, sanitizeApiKey(credentials.apiKey), model);
  if (!probe.ok) return throwCode(probe.error);
  return true;
};
