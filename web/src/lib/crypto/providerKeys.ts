import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { serverEnv } from '../serverEnv.ts';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const decodeExplicitSecret = (): Buffer | null => {
  const raw = serverEnv('ZC_PROVIDER_KEY_SECRET')?.trim();
  if (!raw) return null;
  if (raw.length % 4 !== 0 || !BASE64_PATTERN.test(raw)) return null;
  const decoded = Buffer.from(raw, 'base64');
  return decoded.length === 32 ? decoded : null;
};

const requiresProductionSecrets = (): boolean =>
  serverEnv('VERCEL') === '1' || serverEnv('ZC_REQUIRE_PROD_SECRETS') === '1';

export const isEncryptionKeyConfigured = (): boolean => decodeExplicitSecret() !== null;

// AES-256-GCM for provider keys. The secret comes from ZC_PROVIDER_KEY_SECRET (base64 of 32
// random bytes). Deployed environments (VERCEL=1 or ZC_REQUIRE_PROD_SECRETS=1) strictly require
// an explicit 32-byte key so rotating SUPABASE_SERVICE_ROLE_KEY never invalidates stored keys and
// missing secrets never fall back to a static seed. Outside deployed hosts, local dev and CI keep
// the deterministic fallback so offline workflows run without mandatory secret provisioning.
const keyMaterial = (): Buffer => {
  const explicit = decodeExplicitSecret();
  if (explicit) return explicit;
  if (requiresProductionSecrets()) {
    throw new Error('MISSING_PROVIDER_KEY_SECRET');
  }
  const seed = serverEnv('SUPABASE_SERVICE_ROLE_KEY') ?? 'zc-dev-only-not-a-secret';
  return createHash('sha256').update(seed).digest();
};

export const encryptProviderKey = (plain: string): string => {
  const key = keyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${body.toString('base64')}`;
};

export const decryptProviderKey = (envelope: string): string => {
  const [version, ivB64, tagB64, bodyB64] = envelope.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !bodyB64) throw new Error('BAD_ENVELOPE');
  const decipher = createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(bodyB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};