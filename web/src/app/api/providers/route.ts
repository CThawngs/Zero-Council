import { currentUserOnly } from '@/lib/api/currentUserOnly';
import {
  customProviderProtocolOf,
  isBuiltinProviderId,
  isCustomProviderId,
  isValidProviderId,
} from '@/lib/store/botValidation';
import {
  deleteAllProviderKeys,
  deleteProviderKey,
  listProviderKeysWithSecrets,
  saveProviderKey,
} from '@/lib/store/providerKeys';
import { builtinProviderById, normalizeBaseUrl } from '@/prototype/chat/byok';

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
  if (typeof model !== 'string' || !model.trim()) {
    return Response.json({ error: 'MODEL_REQUIRED' }, { status: 400 });
  }
  if (typeof key !== 'string' || !key.trim()) {
    return Response.json({ error: 'KEY_REQUIRED' }, { status: 400 });
  }

  const modelList = Array.isArray(models)
    ? models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map((m) => m.trim())
    : [model.trim()];

  let resolvedLabel: string | undefined;
  let resolvedProtocol: 'anthropic' | 'openai' | 'google';
  let resolvedBaseUrl: string;

  if (isBuiltinProviderId(provider)) {
    const builtin = builtinProviderById(provider)!;
    // Verified built-in providers always lock baseUrl and protocol server-side.
    resolvedLabel = builtin.label;
    resolvedProtocol = builtin.protocol;
    resolvedBaseUrl = builtin.baseUrl;
  } else if (isCustomProviderId(provider)) {
    const proto = customProviderProtocolOf(provider);
    if (!proto) return Response.json({ error: 'INVALID_PROTOCOL' }, { status: 400 });
    if (typeof baseUrl !== 'string' || !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(baseUrl.trim())) {
      return Response.json({ error: 'INVALID_BASE_URL' }, { status: 400 });
    }
    resolvedProtocol = proto;
    resolvedBaseUrl = normalizeBaseUrl(baseUrl);
    resolvedLabel =
      typeof label === 'string' && label.trim().length > 0
        ? label.trim().slice(0, 60)
        : provider;
  } else {
    return Response.json({ error: 'UNKNOWN_PROVIDER' }, { status: 400 });
  }

  try {
    const saved = await saveProviderKey(user.email, provider, model.trim(), key.trim(), {
      models: modelList,
      label: resolvedLabel,
      protocol: resolvedProtocol,
      baseUrl: resolvedBaseUrl,
    });
    return Response.json({ provider: saved }, { status: 201 });
  } catch (error) {
    console.error('[providers] save failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

/** Update selected default model or append a tested custom model on an already-connected provider. */
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
  if (typeof model !== 'string' || !model.trim()) {
    return Response.json({ error: 'MODEL_REQUIRED' }, { status: 400 });
  }
  try {
    const existingList = await listProviderKeysWithSecrets(user.email);
    const current = existingList.find((item) => item.provider === provider);
    if (!current || !current.key) {
      return Response.json({ error: 'PROVIDER_NOT_CONNECTED' }, { status: 404 });
    }
    const mergedModels = Array.isArray(models)
      ? models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map((m) => m.trim())
      : [...(current.models ?? []), model.trim()];
    const saved = await saveProviderKey(user.email, provider, model.trim(), current.key, {
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
