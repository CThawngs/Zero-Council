/**
 * Input sanitization, API key shape validation, and SSRF endpoint checks for BYOK verification.
 *
 * Rejects malformed/placeholder keys and unsafe private/loopback Base URLs before any HTTP call.
 */

import {
  assertSafeRemoteUrl,
  isPrivateProviderNetworkAllowed,
  validateRemoteUrlLiteral,
  type DnsLookupFn,
} from '../../security/ssrf.ts';

const NATIVE_FETCH: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined;

const MAX_KEY_LENGTH = 512;
const MIN_KEY_LENGTH = 8;
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]/g;

const PLACEHOLDER_KEY_PATTERN =
  /^(sk-ant-|sk-or-|sk-|gsk_|xai-|nvapi-|aiza)?(x+|\*+|\.+|0+|your[-_]?(api[-_]?)?key([-_]?here)?|api[-_]?key|key|test|placeholder|changeme|example|null|undefined|none)$/i;

const ENDPOINT_SUFFIX_PATTERN =
  /^(https?:\/\/[^/?#]+.*?)(\/(?:chat\/completions|completions|messages|responses|models(?:\/[^/?#]+(?::generateContent)?)?))\/?$/i;

const unwrapQuotes = (value: string): string => {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1).replace(ZERO_WIDTH_PATTERN, '').trim();
  }
  return value;
};

/**
 * Strips zero-width paste artifacts, outer quotes, and an accidental `Bearer ` prefix while leaving
 * malformed inner spaces / non-ASCII untouched so `checkKeyShape` still rejects broken keys.
 */
export const sanitizeApiKey = (rawKey: unknown): string => {
  if (typeof rawKey !== 'string') return '';
  let cleaned = unwrapQuotes(rawKey.replace(ZERO_WIDTH_PATTERN, '').trim());
  const bearer = /^Bearer\s+([\x21-\x7E]+)$/i.exec(cleaned);
  if (bearer) {
    cleaned = bearer[1];
  }
  return cleaned;
};

/**
 * Trims, unwraps quotes, strips trailing slashes, and strips accidentally pasted endpoint paths
 * (`/chat/completions`, `/messages`, `/responses`, `/models/...`) down to the API root.
 */
export const normalizeProviderBaseUrl = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  let cleaned = unwrapQuotes(raw.replace(ZERO_WIDTH_PATTERN, '').trim());
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.replace(ENDPOINT_SUFFIX_PATTERN, '$1');
  return cleaned.replace(/\/+$/, '');
};

/**
 * Rejects keys that can never be valid before any network call is made.
 * Returns `null` when the shape is plausible (the provider still has the final word).
 */
export const checkKeyShape = (rawKey: unknown): 'EMPTY_KEY' | 'INVALID_KEY' | null => {
  if (typeof rawKey !== 'string') return 'EMPTY_KEY';
  const key = sanitizeApiKey(rawKey);
  if (!key) return 'EMPTY_KEY';
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) return 'INVALID_KEY';
  if (!/^[\x21-\x7E]+$/.test(key)) return 'INVALID_KEY';
  if (PLACEHOLDER_KEY_PATTERN.test(key)) return 'INVALID_KEY';
  return null;
};

/**
 * Validates a custom provider Base URL literal before calling it (SSRF guard).
 * Literal private / loopback / link-local / hex-mapped IPv6 hosts are refused unless
 * `allowPrivateNetwork` is enabled.
 */
export const isAllowedProviderBaseUrl = (
  raw: unknown,
  options: { allowPrivateNetwork: boolean }
): boolean => {
  const normalized = normalizeProviderBaseUrl(raw);
  if (!normalized) return false;
  return validateRemoteUrlLiteral(normalized, {
    requireHttps: true,
    allowPrivateNetwork: options.allowPrivateNetwork,
  }).ok;
};

/** Verifies both literal URL safety and (when running on Node) DNS resolution against SSRF rebinding. */
export const isSafeCustomEndpointTarget = async (
  baseUrl: string,
  activeFetch: typeof fetch,
  options: { lookupImpl?: DnsLookupFn; allowPrivateNetwork?: boolean }
): Promise<boolean> => {
  const allowPrivate = options.allowPrivateNetwork ?? isPrivateProviderNetworkAllowed();
  if (allowPrivate) return true;
  if (!validateRemoteUrlLiteral(baseUrl, { requireHttps: true, allowPrivateNetwork: false }).ok) {
    return false;
  }
  const shouldResolveDns =
    Boolean(options.lookupImpl) || (typeof window === 'undefined' && activeFetch === NATIVE_FETCH);
  if (!shouldResolveDns) return true;
  try {
    await assertSafeRemoteUrl(baseUrl, {
      requireHttps: true,
      allowPrivateNetwork: false,
      lookupImpl: options.lookupImpl,
    });
    return true;
  } catch {
    return false;
  }
};
