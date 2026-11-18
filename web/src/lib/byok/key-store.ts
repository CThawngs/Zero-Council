/**
 * Server-side provider key retrieval.
 *
 * Keys are stored AES-256-GCM encrypted in the DB (see lib/crypto/providerKeys.ts).
 * This module is the only place that decrypts them. The plain-text key must NEVER:
 *   - appear in a response body sent to the browser
 *   - be logged at any log level
 *   - be stored anywhere outside this call's stack frame
 *
 * Pattern: decrypt → use → discard. Caller gets an opaque string; they pass it
 * directly to the fetch call and throw it away.
 */

import { listProviderKeysWithSecrets } from '../store/providerKeys';

/**
 * Retrieve and decrypt one provider's API key for a given user.
 * Returns `null` when no key is stored for that provider.
 *
 * The returned string is the raw API key — handle with care, do not log.
 */
export const getKey = async (
  userEmail: string,
  providerId: string
): Promise<string | null> => {
  const rows = await listProviderKeysWithSecrets(userEmail);
  const match = rows.find((row) => row.provider === providerId);
  return match?.key ?? null;
};
