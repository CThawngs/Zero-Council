/**
 * POST /api/providers/test
 *
 * Re-tests an ALREADY SAVED provider key (the "Re-test connection" button).
 * Client sends only `{ providerId }` — the server decrypts the stored key and runs the same strict
 * verification as `/api/providers/verify` (live 1-token inference probe) for all three protocols:
 * `openai`, `anthropic` and `google`.
 *
 * Response: { ok: true, models, verifiedModel } on success, { ok: false, error: <code> } on failure.
 */

import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { getKey } from '@/lib/byok/key-store';
import { resolveVerifyTarget } from '@/lib/byok/resolve-target';
import { httpStatusForVerifyError, verifyProviderKey } from '@/lib/byok/verify';
import { listProviderKeys } from '@/lib/store/providerKeys';

export async function POST(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const { providerId } = (body ?? {}) as { providerId?: unknown };
  if (typeof providerId !== 'string' || !providerId.trim()) {
    return Response.json({ ok: false, error: 'PROVIDER_ID_REQUIRED' }, { status: 400 });
  }

  // Look up metadata (protocol, baseUrl, model) without the key.
  const records = await listProviderKeys(user.email);
  const record = records.find((r) => r.provider === providerId);
  if (!record) {
    return Response.json({ ok: false, error: 'PROVIDER_NOT_CONNECTED' }, { status: 404 });
  }

  // Built-ins re-resolve to their locked canonical endpoint; customs re-pass the SSRF guard.
  const resolved = resolveVerifyTarget({ provider: providerId, baseUrl: record.baseUrl });
  if (!resolved.ok) {
    return Response.json({ ok: false, error: resolved.error }, { status: 400 });
  }

  // Decrypt the key server-side — it never leaves the server.
  const apiKey = await getKey(user.email, providerId);
  if (!apiKey) {
    return Response.json({ ok: false, error: 'KEY_NOT_FOUND' }, { status: 404 });
  }

  const result = await verifyProviderKey(resolved.target, apiKey, { model: record.model });
  if (!result.ok) {
    console.warn(`[providers/test] ${providerId} failed: ${result.error}`);
    return Response.json(result, { status: httpStatusForVerifyError(result.error) });
  }
  return Response.json(result);
}
