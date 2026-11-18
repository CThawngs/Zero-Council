/**
 * POST /api/providers/test
 *
 * Server-side connectivity test for a stored provider key.
 * Client sends only `{ providerId }` — the raw API key is NEVER sent from the
 * browser. The server decrypts the stored key and makes a minimal test call.
 *
 * Response: { ok: true } on success, { ok: false, error: string } on failure.
 */

import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { getKey } from '@/lib/byok/key-store';
import { callAnthropic, callOpenAI } from '@/lib/byok/protocol';
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

  // Decrypt the key server-side — it never leaves the server.
  const apiKey = await getKey(user.email, providerId);
  if (!apiKey) {
    return Response.json({ ok: false, error: 'KEY_NOT_FOUND' }, { status: 404 });
  }

  try {
    const opts = {
      baseUrl: record.baseUrl ?? (record.protocol === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : 'https://api.openai.com/v1'),
      apiKey,
      model: record.model,
      system: 'You are a connectivity test assistant.',
      prompt: 'Reply with the single word: OK',
    };

    if (record.protocol === 'anthropic') {
      await callAnthropic(opts);
    } else {
      await callOpenAI(opts);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    // Log without the key (it is never in the error message from our protocol fns).
    console.error('[providers/test] test call failed:', message);
    return Response.json({ ok: false, error: message.slice(0, 200) });
  }
}
