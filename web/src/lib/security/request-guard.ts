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