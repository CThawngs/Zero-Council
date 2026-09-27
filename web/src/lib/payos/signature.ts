import { createHmac, timingSafeEqual } from 'node:crypto';

type SignableRecord = Record<string, unknown>;

const EMPTY = new Set([undefined, null, 'null', 'NULL', '']);

/**
 * payOS signs an object as a query string whose keys are sorted alphabetically
 * (https://payos.vn/docs/api/). Nested objects and arrays are JSON-encoded with
 * their own keys sorted, matching the reference implementation in payOS docs.
 */
const normalize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => sortByKey(item as Record<string, unknown>)));
  }
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(sortByKey(value as Record<string, unknown>));
  }
  if (value === undefined || value === null) return '';
  return String(value);
};

const sortByKey = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = record[key];
      return sorted;
    }, {});

export const toSignaturePayload = (data: SignableRecord): string =>
  Object.keys(data)
    .sort()
    .map((key) => {
      const value = normalize(data[key]);
      return EMPTY.has(value) ? '' : `${key}=${value}`;
    })
    .filter(Boolean)
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
