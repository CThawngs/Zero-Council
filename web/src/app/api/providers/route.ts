import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { resolveVerifyTarget } from '@/lib/byok/resolve-target';
import {
  checkKeyShape,
  httpStatusForVerifyError,
  sanitizeApiKey,
  verifyProviderKey,
} from '@/lib/byok/verify';
import { maskProviderKey } from '@/lib/crypto/providerKeys';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson } from '@/lib/security/request-guard';
import { isValidProviderId } from '@/lib/store/botValidation';
import {
  deleteAllProviderKeys,
  deleteProviderKey,
  listProviderKeysWithSecrets,
  providerStoreErrorOf,
  saveProviderKey,
} from '@/lib/store/providerKeys';

/** Verification probes several models with a per-request timeout; give the function room. */
export const maxDuration = 60;

const MAX_MODEL_ID_LENGTH = 200;
const MAX_STORED_MODELS = 500;
const MAX_BODY_BYTES = 32 * 1024;

/** Answers a store / encryption failure with its stable code instead of a generic 500. */
const storeFailure = (scope: string, error: unknown, fallbackCode: string): Response => {
  const { code, status } = providerStoreErrorOf(error);
  console.error(`[providers] ${scope} failed:`, (error as Error).message);
  return Response.json(
    { error: code === 'STORE_UNAVAILABLE' ? fallbackCode : code },
    { status: code === 'STORE_UNAVAILABLE' ? 500 : status }
  );
};

/** Keeps only non-empty, bounded model id strings from an untrusted array. */
const cleanModelList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((m): m is string => typeof m === 'string')
        .map((m) => m.trim())
        .filter((m) => m.length > 0 && m.length <= MAX_MODEL_ID_LENGTH)
    : [];

/**
 * Lists connected providers for the signed-in user.
 * Plaintext API keys are NEVER returned to the browser — only `hasKey: true` and a masked
 * display tail (`••••abcd`) are exposed.
 */
export async function GET() {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const rows = await listProviderKeysWithSecrets(user.email);
    const providers = rows.map(({ key, ...record }) => ({
      ...record,
      hasKey: true,
      maskedKey: maskProviderKey(key),
    }));
    return Response.json({ providers });
  } catch (error) {
    return storeFailure('list', error, 'LIST_FAILED');
  }
}

/**
 * Save (connect) a provider key. The key is re-verified server-side with a live authenticated
 * inference probe against the selected model BEFORE it is persisted, so a garbage key can never be
 * stored as "connected" — not through the UI and not by calling this API directly.
 */
export async function POST(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'providers:write',
    limit: 30,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { provider, model, models, key, label, baseUrl } = (
    body && typeof body === 'object' ? body : {}
  ) as {
    provider?: unknown;
    model?: unknown;
    models?: unknown;
    key?: unknown;
    label?: unknown;
    baseUrl?: unknown;
  };
  if (!isValidProviderId(provider)) {
    return Response.json({ error: 'UNKNOWN_PROVIDER' }, { status: 400 });
  }
  if (typeof model !== 'string' || !model.trim() || model.trim().length > MAX_MODEL_ID_LENGTH) {
    return Response.json({ error: 'MODEL_REQUIRED' }, { status: 400 });
  }
  if (typeof key !== 'string' || !key.trim()) {
    return Response.json({ error: 'KEY_REQUIRED' }, { status: 400 });
  }
  const shapeError = checkKeyShape(key);
  if (shapeError) {
    return Response.json({ error: shapeError }, { status: httpStatusForVerifyError(shapeError) });
  }

  // Built-ins lock protocol + Base URL server-side; customs pass the SSRF guard.
  const resolved = resolveVerifyTarget({ provider, baseUrl, label });
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }

  const selectedModel = model.trim();
  // Store exactly what was verified: quotes / "Bearer " / zero-width paste artifacts removed.
  const cleanKey = sanitizeApiKey(key);
  const verification = await verifyProviderKey(resolved.target, cleanKey, { model: selectedModel });
  if (!verification.ok) {
    console.warn(`[providers] save refused for ${provider}: ${verification.error}`);
    return Response.json(
      { error: verification.error },
      { status: httpStatusForVerifyError(verification.error) }
    );
  }

  const modelList = [
    ...new Set([selectedModel, ...cleanModelList(models), ...verification.models]),
  ].slice(0, MAX_STORED_MODELS);

  try {
    const saved = await saveProviderKey(user.email, provider, selectedModel, cleanKey, {
      models: modelList,
      label: resolved.label,
      protocol: resolved.target.protocol,
      // Persist the Base URL the API actually answered on (normalized, `/v1` appended if needed).
      baseUrl: verification.resolvedBaseUrl ?? resolved.target.baseUrl,
    });
    return Response.json(
      {
        provider: {
          ...saved,
          hasKey: true,
          maskedKey: maskProviderKey(cleanKey),
        },
        ...(verification.warning ? { warning: verification.warning } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    return storeFailure('save', error, 'SAVE_FAILED');
  }
}

/**
 * Update the selected default model or append a tested custom model on an already-connected
 * provider. A model that is not yet in the stored list is probed live with the stored key first.
 */
export async function PATCH(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'providers:write',
    limit: 30,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { provider, model, models } = (
    body && typeof body === 'object' ? body : {}
  ) as {
    provider?: unknown;
    model?: unknown;
    models?: unknown;
  };
  if (!isValidProviderId(provider)) {
    return Response.json({ error: 'UNKNOWN_PROVIDER' }, { status: 400 });
  }
  if (typeof model !== 'string' || !model.trim() || model.trim().length > MAX_MODEL_ID_LENGTH) {
    return Response.json({ error: 'MODEL_REQUIRED' }, { status: 400 });
  }
  const selectedModel = model.trim();
  try {
    const existingList = await listProviderKeysWithSecrets(user.email);
    const current = existingList.find((item) => item.provider === provider);
    if (!current || !current.key) {
      return Response.json({ error: 'PROVIDER_NOT_CONNECTED' }, { status: 404 });
    }

    const alreadyKnown = (current.models ?? [current.model]).includes(selectedModel);
    if (!alreadyKnown) {
      const resolved = resolveVerifyTarget({ provider, baseUrl: current.baseUrl });
      if (!resolved.ok) return Response.json({ error: resolved.error }, { status: 400 });
      const verification = await verifyProviderKey(resolved.target, current.key, {
        model: selectedModel,
      });
      if (!verification.ok) {
        console.warn(`[providers] model add refused for ${provider}: ${verification.error}`);
        return Response.json(
          { error: verification.error },
          { status: httpStatusForVerifyError(verification.error) }
        );
      }
    }

    const requested = cleanModelList(models);
    const mergedModels = [
      ...new Set([selectedModel, ...(requested.length > 0 ? requested : current.models ?? [])]),
    ].slice(0, MAX_STORED_MODELS);
    const saved = await saveProviderKey(user.email, provider, selectedModel, current.key, {
      models: mergedModels,
      label: current.label,
      protocol: current.protocol,
      baseUrl: current.baseUrl,
    });
    return Response.json({
      provider: {
        ...saved,
        hasKey: true,
        maskedKey: maskProviderKey(current.key),
      },
    });
  } catch (error) {
    return storeFailure('patch', error, 'SAVE_FAILED');
  }
}

export async function DELETE(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const provider = new URL(request.url).searchParams.get('provider');
    if (provider) {
      if (!isValidProviderId(provider)) {
        return Response.json({ error: 'UNKNOWN_PROVIDER' }, { status: 400 });
      }
      await deleteProviderKey(user.email, provider);
    } else {
      await deleteAllProviderKeys(user.email);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return storeFailure('delete', error, 'DELETE_FAILED');
  }
}
