import { createHmac, timingSafeEqual } from 'node:crypto';

type SignableRecord = Record<string, unknown>;

/**
 * payOS signs an object as a query string whose keys are sorted alphabetically
 * (https://payos.vn/docs/api/).
 *
 * Null and empty values are KEPT, as `key=`. Proved against the live v2 API on
 * 2026-09-27: a create-payment response carrying `expiredAt: null` verified only when the
 * empty field stayed in the string, so skipping it rejected every real response.
 *
 * Keeping them is also the stricter of the two choices. Dropping empty values would make
 * `null` and "field absent" produce the same signature, so a field could be stripped from
 * the payload without the signature breaking.
 */
const normalize = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const toSignaturePayload = (data: SignableRecord): string =>
  Object.keys(data)
    .sort()
    .map((key) => `${key}=${normalize(data[key])}`)
    .join('&');

export const signData = (data: SignableRecord, checksumKey: string): string =>
  createHmac('sha256', checksumKey).update(toSignaturePayload(data)).digest('hex');

/** Constant-time compare: a webhook is a trust boundary, so a plain `===` would leak timing. */
export const verifySignature = (
  data: SignableRecord,
  signature: unknown,
  checksumKey: string
): boolean => {
  if (typeof signature !== 'string' || signature.length === 0) return false;
  const expected = Buffer.from(signData(data, checksumKey), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
};
