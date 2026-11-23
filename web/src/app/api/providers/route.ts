import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { resolveVerifyTarget } from '@/lib/byok/resolve-target';
import { checkKeyShape, httpStatusForVerifyError, verifyProviderKey } from '@/lib/byok/verify';
import { isValidProviderId } from '@/lib/store/botValidation';
import {
  deleteAllProviderKeys,
  deleteProviderKey,
  listProviderKeysWithSecrets,
  saveProviderKey,
} from '@/lib/store/providerKeys';

const MAX_MODEL_ID_LENGTH = 200;
const MAX_STORED_MODELS = 500;

/** Keeps only non-empty, bounded model id strings from an untrusted array. */
const cleanModelList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((m): m is string => typeof m === 'string')
        .map((m) => m.trim())
        .filter((m) => m.length > 0 && m.length <= MAX_MODEL_ID_LENGTH)
    : [];

export async function GET() {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const providers = await listProviderKeysWithSecrets(user.email);
    return Response.json({ providers });
  } catch (error) {
    console.error('[providers] list failed:', (error as Error).message);
    return Response.json({ error: 'LIST_FAILED' }, { status: 500 });
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const { provider, model, models, key, label, baseUrl } = (body ?? {}) as {
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
  const verification = await verifyProviderKey(resolved.target, key, { model: selectedModel });
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
    const saved = await saveProviderKey(user.email, provider, selectedModel, key.trim(), {
      models: modelList,
      label: resolved.label,
      protocol: resolved.target.protocol,
      baseUrl: resolved.target.baseUrl,
    });
    return Response.json({ provider: saved }, { status: 201 });
  } catch (error) {
    console.error('[providers] save failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

/**
 * Update the selected default model or append a tested custom model on an already-connected
 * provider. A model that is not yet in the stored list is probed live with the stored key first.
 */
export async function PATCH(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const { provider, model, models } = (body ?? {}) as {
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
      const verification = await verifyProviderKey(resolved.target, current.key, { model: selectedModel });
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
    return Response.json({ provider: saved });
  } catch (error) {
    console.error('[providers] patch failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
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
    console.error('[providers] delete failed:', (error as Error).message);
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
