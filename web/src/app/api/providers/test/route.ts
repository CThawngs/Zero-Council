import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { getKey } from '@/lib/byok/key-store';
import { resolveVerifyTarget } from '@/lib/byok/resolve-target';
import { httpStatusForVerifyError, verifyProviderKey } from '@/lib/byok/verify';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';
import { listProviderKeys, providerStoreErrorOf } from '@/lib/store/providerKeys';

/** Verification probes several models with a per-request timeout; give the function room. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MODEL_ID_LENGTH = 200;

export async function POST(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'providers:test',
    limit: 30,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { providerId, model } = (body && typeof body === 'object' ? body : {}) as {
    providerId?: unknown;
    model?: unknown;
  };
  if (typeof providerId !== 'string' || !providerId.trim()) {
    return Response.json({ ok: false, error: 'PROVIDER_ID_REQUIRED' }, { status: 400 });
  }
  if (
    model !== undefined &&
    (typeof model !== 'string' || !model.trim() || model.trim().length > MAX_MODEL_ID_LENGTH)
  ) {
    return Response.json({ ok: false, error: 'INVALID_MODEL' }, { status: 400 });
  }

  let records: Awaited<ReturnType<typeof listProviderKeys>>;
  try {
    records = await listProviderKeys(user.email);
  } catch (error) {
    const { code, status } = providerStoreErrorOf(error);
    console.error('[providers/test] list failed:', (error as Error).message);
    return Response.json({ ok: false, error: code }, { status });
  }
  const record = records.find((r) => r.provider === providerId);
  if (!record) {
    return Response.json({ ok: false, error: 'PROVIDER_NOT_CONNECTED' }, { status: 404 });
  }

  const resolved = resolveVerifyTarget({ provider: providerId, baseUrl: record.baseUrl });
  if (!resolved.ok) {
    return Response.json({ ok: false, error: resolved.error }, { status: 400 });
  }

  let apiKey: string | null;
  try {
    apiKey = await getKey(user.email, providerId);
  } catch (error) {
    const { code, status } = providerStoreErrorOf(error);
    console.error('[providers/test] key read failed:', (error as Error).message);
    return Response.json({ ok: false, error: code }, { status });
  }
  if (!apiKey) {
    return Response.json({ ok: false, error: 'KEY_NOT_FOUND' }, { status: 404 });
  }

  const targetModel = typeof model === 'string' ? model.trim() : record.model;
  const result = await verifyProviderKey(resolved.target, apiKey, { model: targetModel });
  if (!result.ok) {
    console.warn(`[providers/test] ${providerId} failed: ${result.error}`);
    return Response.json(result, { status: httpStatusForVerifyError(result.error) });
  }
  return Response.json(result);
}
