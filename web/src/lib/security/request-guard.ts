import { serverEnv } from '../serverEnv.ts';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

const payloadTooLargeResponse = (): Response =>
  Response.json(
    { ok: false, error: 'PAYLOAD_TOO_LARGE' },
    { status: 413, headers: NO_STORE_HEADERS }
  );

const invalidJsonResponse = (): Response =>
  Response.json(
    { ok: false, error: 'INVALID_JSON' },
    { status: 400, headers: NO_STORE_HEADERS }
  );

const csrfOriginMismatchResponse = (): Response =>
  Response.json(
    { ok: false, error: 'CSRF_ORIGIN_MISMATCH' },
    { status: 403, headers: NO_STORE_HEADERS }
  );

/**
 * Parses an HTTP(S) URL or Origin header value and returns its normalized `origin`
 * (`scheme://host[:port]`), or `null` if missing, `'null'`, or non-HTTP(S).
 */
export const parseHttpOrigin = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

/**
 * Resolves the canonical site origin for security-sensitive redirects (such as OAuth callbacks)
 * from `NEXT_PUBLIC_SITE_URL` when valid, falling back to `new URL(request.url).origin`.
 * Client-spoofable `x-forwarded-host` / `x-forwarded-proto` headers are never trusted.
 */
export const resolveCanonicalOrigin = (
  request: Request,
  configuredSiteUrl: string | null | undefined = serverEnv('NEXT_PUBLIC_SITE_URL')
): string => {
  const configuredOrigin = parseHttpOrigin(configuredSiteUrl);
  if (configuredOrigin) return configuredOrigin;
  return new URL(request.url).origin;
};

/**
 * Validates an untrusted `next` query parameter so post-auth redirects stay strictly on the
 * canonical origin (must start with `/`, never `//` or `/\`, and resolve to the same origin).
 */
export const sanitizeRelativeNextPath = (
  rawNext: string | null | undefined,
  canonicalOrigin: string
): string => {
  if (typeof rawNext !== 'string') return '/';
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return '/';
  }
  try {
    const resolved = new URL(trimmed, canonicalOrigin);
    if (resolved.origin !== canonicalOrigin) return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
};

/**
 * Enforces same-origin CSRF protection for cookie-authenticated state-changing routes
 * (`POST`, `PUT`, `PATCH`, `DELETE`). Rejects cross-site Fetch metadata, missing origin
 * provenance, or `Origin` / `Referer` mismatches against the request origin / `NEXT_PUBLIC_SITE_URL`.
 */
export const verifySameOrigin = (request: Request): Response | null => {
  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    return csrfOriginMismatchResponse();
  }

  const allowedOrigins = new Set<string>();
  const requestOrigin = parseHttpOrigin(request.url);
  if (requestOrigin) allowedOrigins.add(requestOrigin);
  const configuredOrigin = parseHttpOrigin(serverEnv('NEXT_PUBLIC_SITE_URL'));
  if (configuredOrigin) allowedOrigins.add(configuredOrigin);

  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  let callerOrigin: string | null = null;
  if (originHeader !== null && originHeader.trim() !== '') {
    callerOrigin = parseHttpOrigin(originHeader);
  } else if (refererHeader !== null && refererHeader.trim() !== '') {
    callerOrigin = parseHttpOrigin(refererHeader);
  }

  if (!callerOrigin || !allowedOrigins.has(callerOrigin)) {
    return csrfOriginMismatchResponse();
  }

  return null;
};

/**
 * Reads and parses a JSON request body while strictly enforcing `maxBytes` both against
 * declared `Content-Length` and while streaming chunks, aborting oversized streams immediately.
 */
export async function readBoundedJson<T = unknown>(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const limit = Math.max(1, Math.floor(maxBytes));

  const contentLengthRaw = request.headers.get('content-length');
  if (contentLengthRaw !== null && contentLengthRaw.trim() !== '') {
    const declaredBytes = Number(contentLengthRaw);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0) {
      return { ok: false, response: invalidJsonResponse() };
    }
    if (declaredBytes > limit) {
      await request.body?.cancel().catch(() => undefined);
      return { ok: false, response: payloadTooLargeResponse() };
    }
  }

  if (!request.body) {
    return { ok: false, response: invalidJsonResponse() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: payloadTooLargeResponse() };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, response: invalidJsonResponse() };
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return { ok: false, response: invalidJsonResponse() };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(merged);
  if (!rawText.trim()) {
    return { ok: false, response: invalidJsonResponse() };
  }

  try {
    const data = JSON.parse(rawText) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, response: invalidJsonResponse() };
  }
}
