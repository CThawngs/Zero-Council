import { currentUserOnly } from '@/lib/api/currentUserOnly';
import {
  deleteAllProviderKeys,
  deleteProviderKey,
  listProviderKeysWithSecrets,
  saveProviderKey,
} from '@/lib/store/providerKeys';

const ALLOWED_PROVIDERS = new Set(['anthropic', 'openai']);

/** The caller's own connected providers. Secrets travel back to the owner's browser only, so a
 *  reload restores the in-memory keys chat needs; they are never stored client-side. */
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

/** Save after the client-side test connection passed. The plaintext key is encrypted before it
 *  touches storage and never echoed back. */
export async function POST(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const { provider, model, key } = (body ?? {}) as { provider?: unknown; model?: unknown; key?: unknown };
  if (typeof provider !== 'string' || !ALLOWED_PROVIDERS.has(provider)) {
    return Response.json({ error: 'UNKNOWN_PROVIDER' }, { status: 400 });
  }
  if (typeof model !== 'string' || !model.trim()) {
    return Response.json({ error: 'MODEL_REQUIRED' }, { status: 400 });
  }
  if (typeof key !== 'string' || !key.trim()) {
    return Response.json({ error: 'KEY_REQUIRED' }, { status: 400 });
  }
  try {
    const saved = await saveProviderKey(user.email, provider, model.trim(), key.trim());
    return Response.json({ provider: saved }, { status: 201 });
  } catch (error) {
    console.error('[providers] save failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

/** ?provider=anthropic removes one; no param removes all of the caller's. */
export async function DELETE(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const provider = new URL(request.url).searchParams.get('provider');
    if (provider) {
      if (!ALLOWED_PROVIDERS.has(provider)) return Response.json({ error: 'UNKNOWN_PROVIDER' }, { status: 400 });
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
