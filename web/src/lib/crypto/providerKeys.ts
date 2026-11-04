import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { serverEnv } from '../serverEnv.ts';

// AES-256-GCM for provider keys. The secret comes from ZC_PROVIDER_KEY_SECRET (base64 of 32
// random bytes). When that is unset outside production the key is derived from the service role
// key, so local development works without minting a new secret; production must set the explicit
// secret because rotating the service role key must not silently re-encrypt every stored key.
// ponytail: no KMS. If keys ever need rotation without downtime, add key versioning to the
// envelope prefix (v1: -> v2:) and re-encrypt on read.
const keyMaterial = (): Buffer => {
  const explicit = serverEnv('ZC_PROVIDER_KEY_SECRET');
  if (explicit) {
    const decoded = Buffer.from(explicit, 'base64');
    if (decoded.length === 32) return decoded;
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
