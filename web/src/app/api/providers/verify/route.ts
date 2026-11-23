/**
 * POST /api/providers/verify
 *
 * Server-side strict key verification (no browser CORS, no public `/models` false positives).
 * Body: { provider, key, model?, protocol?, baseUrl? }
 *   - 200 { ok: true, models, verifiedModel }
 *   - 4xx/5xx { ok: false, error: 'INVALID_KEY' | 'INVALID_BASE_URL' | 'MODEL_NOT_FOUND' | 'EMPTY_KEY' | ... }
 *
 * Requires a signed-in user: an anonymous verify endpoint would be an open proxy to any host.
 * The key is used for the outbound probe only — never stored, logged, or echoed back.
 */

import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { resolveVerifyTarget } from '@/lib/byok/resolve-target';
import { checkKeyShape, httpStatusForVerifyError, verifyProviderKey } from '@/lib/byok/verify';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson } from '@/lib/security/request-guard';

const MAX_MODEL_ID_LENGTH = 200;
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'providers:verify',
    limit: 30,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { provider, key, model, protocol, baseUrl } = (
    body && typeof body === 'object' ? body : {}
  ) as {
    provider?: unknown;
    key?: unknown;
    model?: unknown;
    protocol?: unknown;
    baseUrl?: unknown;
  };

  const resolved = resolveVerifyTarget({ provider, protocol, baseUrl });
  if (!resolved.ok) {
    return Response.json({ ok: false, error: resolved.error }, { status: 400 });
  }

  const shapeError = checkKeyShape(key);
  if (shapeError) {
    return Response.json(
      { ok: false, error: shapeError },
      { status: httpStatusForVerifyError(shapeError) }
    );
  }

  if (model !== undefined && (typeof model !== 'string' || model.length > MAX_MODEL_ID_LENGTH)) {
    return Response.json({ ok: false, error: 'INVALID_MODEL' }, { status: 400 });
  }

  const result = await verifyProviderKey(resolved.target, key as string, {
    model: typeof model === 'string' ? model : undefined,
  });

  if (!result.ok) {
    // Log the provider id and error code only — never the key or the provider's response body.
    console.warn(`[providers/verify] ${resolved.target.providerId} rejected: ${result.error}`);
    return Response.json(result, { status: httpStatusForVerifyError(result.error) });
  }
  return Response.json(result);
}