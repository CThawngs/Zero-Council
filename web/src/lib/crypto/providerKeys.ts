import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { serverEnv } from '../serverEnv.ts';

/**
 * AES-256-GCM encryption for stored provider API keys.
 *
 * Key resolution (first match wins for NEW writes):
 *   1. `ZC_PROVIDER_KEY_SECRET` — base64 of 32 random bytes. Envelope `v1:<iv>:<tag>:<body>`.
 *   2. HKDF-SHA256 derived from `SUPABASE_SERVICE_ROLE_KEY` with a fixed domain label. Envelope
 *      `v2:srk1:<iv>:<tag>:<body>` — the key-version tag tells decrypt exactly which key to use.
 *   3. Local dev / CI only: a static development key (never on a deployed host).
 * A deployed host (VERCEL=1 or ZC_REQUIRE_PROD_SECRETS=1) with neither 1 nor 2 throws
 * `MISSING_PROVIDER_KEY_SECRET`; a malformed explicit secret throws `INVALID_PROVIDER_KEY_SECRET`.
 *
 * Rotation: decrypt tries the key named by the envelope first, then every other key that is
 * still configured (explicit secret, service-role derivation, the legacy plain-SHA-256 derivation
 * used before key-version tags existed). GCM authentication guarantees a wrong key can never
 * produce plaintext, so trying several candidates is safe. Rows re-encrypt with the current key
 * the next time they are saved.
 */

export const MISSING_PROVIDER_KEY_SECRET = 'MISSING_PROVIDER_KEY_SECRET';
export const INVALID_PROVIDER_KEY_SECRET = 'INVALID_PROVIDER_KEY_SECRET';

export type EncryptionMode =
  | 'explicit-secret'
  | 'derived-from-service-role'
  | 'dev-fallback'
  | 'invalid-secret'
  | 'missing';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const PLACEHOLDER_SERVICE_ROLE_PATTERN = /^(your[-_]|placeholder|changeme|example|zc-dev-only)/i;
const MIN_SERVICE_ROLE_KEY_LENGTH = 20;

/** Domain separation for the service-role derivation: never reuse the raw key as an AES key. */
const SERVICE_ROLE_HKDF_SALT = 'zero-council/provider-keys';
const SERVICE_ROLE_HKDF_INFO = 'aes-256-gcm/srk1';
const SERVICE_ROLE_KEY_ID = 'srk1';
const DEV_ONLY_SEED = 'zc-dev-only-not-a-secret';

type ExplicitSecretState = { state: 'unset' } | { state: 'invalid' } | { state: 'valid'; key: Buffer };

const readExplicitSecret = (): ExplicitSecretState => {
  const raw = serverEnv('ZC_PROVIDER_KEY_SECRET')?.trim();
  if (!raw) return { state: 'unset' };
  if (raw.length % 4 !== 0 || !BASE64_PATTERN.test(raw)) return { state: 'invalid' };
  const decoded = Buffer.from(raw, 'base64');
  return decoded.length === 32 ? { state: 'valid', key: decoded } : { state: 'invalid' };
};

const readServiceRoleKey = (): string | null => {
  const serviceRoleKey = serverEnv('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (
    !serviceRoleKey ||
    serviceRoleKey.length < MIN_SERVICE_ROLE_KEY_LENGTH ||
    PLACEHOLDER_SERVICE_ROLE_PATTERN.test(serviceRoleKey)
  ) {
    return null;
  }
  return serviceRoleKey;
};

const deriveFromServiceRole = (serviceRoleKey: string): Buffer =>
  Buffer.from(hkdfSync('sha256', serviceRoleKey, SERVICE_ROLE_HKDF_SALT, SERVICE_ROLE_HKDF_INFO, 32));

/** Pre-v2 local derivation (plain SHA-256 of the service-role key). Decrypt-only. */
const legacyServiceRoleKey = (serviceRoleKey: string): Buffer =>
  createHash('sha256').update(serviceRoleKey).digest();

const devOnlyKey = (): Buffer => createHash('sha256').update(DEV_ONLY_SEED).digest();

const isDeployedHost = (): boolean =>
  serverEnv('VERCEL') === '1' || serverEnv('ZC_REQUIRE_PROD_SECRETS') === '1';

/** Which key new writes use right now. Never exposes key material. */
export const getEncryptionMode = (): EncryptionMode => {
  const explicit = readExplicitSecret();
  if (explicit.state === 'valid') return 'explicit-secret';
  if (explicit.state === 'invalid' && isDeployedHost()) return 'invalid-secret';
  if (readServiceRoleKey()) return 'derived-from-service-role';
  return isDeployedHost() ? 'missing' : 'dev-fallback';
};

/** True when keys are protected by a real secret (explicit or derived), not the dev fallback. */
export const isEncryptionKeyConfigured = (): boolean => {
  const mode = getEncryptionMode();
  return mode === 'explicit-secret' || mode === 'derived-from-service-role';
};

type WriteKey = { envelopePrefix: string; key: Buffer };

const resolveWriteKey = (): WriteKey => {
  const explicit = readExplicitSecret();
  if (explicit.state === 'valid') return { envelopePrefix: 'v1', key: explicit.key };
  if (explicit.state === 'invalid' && isDeployedHost()) throw new Error(INVALID_PROVIDER_KEY_SECRET);
  const serviceRoleKey = readServiceRoleKey();
  if (serviceRoleKey) {
    return { envelopePrefix: `v2:${SERVICE_ROLE_KEY_ID}`, key: deriveFromServiceRole(serviceRoleKey) };
  }
  if (isDeployedHost()) throw new Error(MISSING_PROVIDER_KEY_SECRET);
  return { envelopePrefix: 'v1', key: devOnlyKey() };
};

export const encryptProviderKey = (plain: string): string => {
  const { envelopePrefix, key } = resolveWriteKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${envelopePrefix}:${iv.toString('base64')}:${tag.toString('base64')}:${body.toString('base64')}`;
};

const decryptWithKey = (key: Buffer, iv: Buffer, tag: Buffer, body: Buffer): string => {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
};

/** Every key that may have encrypted a row, the one named by the envelope first. */
const decryptCandidates = (keyId: 'v1' | typeof SERVICE_ROLE_KEY_ID): Buffer[] => {
  const explicit = readExplicitSecret();
  if (explicit.state === 'invalid' && isDeployedHost()) throw new Error(INVALID_PROVIDER_KEY_SECRET);
  const serviceRoleKey = readServiceRoleKey();
  const explicitKeys = explicit.state === 'valid' ? [explicit.key] : [];
  const derivedKeys = serviceRoleKey ? [deriveFromServiceRole(serviceRoleKey)] : [];
  const legacyKeys = serviceRoleKey ? [legacyServiceRoleKey(serviceRoleKey)] : [];
  const devKeys = isDeployedHost() ? [] : [devOnlyKey()];
  return keyId === SERVICE_ROLE_KEY_ID
    ? [...derivedKeys, ...explicitKeys]
    : [...explicitKeys, ...legacyKeys, ...devKeys, ...derivedKeys];
};

export const decryptProviderKey = (envelope: string): string => {
  const parts = envelope.split(':');
  let keyId: 'v1' | typeof SERVICE_ROLE_KEY_ID;
  let encoded: string[];
  if (parts[0] === 'v1' && parts.length === 4) {
    keyId = 'v1';
    encoded = parts.slice(1);
  } else if (parts[0] === 'v2' && parts[1] === SERVICE_ROLE_KEY_ID && parts.length === 5) {
    keyId = SERVICE_ROLE_KEY_ID;
    encoded = parts.slice(2);
  } else {
    throw new Error('BAD_ENVELOPE');
  }
  const [ivB64, tagB64, bodyB64] = encoded;
  if (!ivB64 || !tagB64 || !bodyB64) throw new Error('BAD_ENVELOPE');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const body = Buffer.from(bodyB64, 'base64');

  const candidates = decryptCandidates(keyId);
  if (candidates.length === 0) throw new Error(MISSING_PROVIDER_KEY_SECRET);
  let lastError: unknown = null;
  for (const key of candidates) {
    try {
      return decryptWithKey(key, iv, tag, body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('DECRYPT_FAILED');
};
