import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '../serverEnv.ts';
import { decryptProviderKey, encryptProviderKey } from '../crypto/providerKeys.ts';

// Per-account provider keys. The row identity is (user email, provider): account 2 can never
// read account 1's keys because every query is scoped by the caller's own email, resolved in the
// route handler from the session — never from a client-supplied value.

export interface ProviderKeyRecord {
  provider: string;
  model: string;
  updatedAt: string;
}

const supabaseConfig = () => {
  const url = serverEnv('SUPABASE_URL')?.replace(/\/+$/, '');
  const key = serverEnv('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url, key } : null;
};

const request = async (pathAndQuery: string, init: RequestInit = {}): Promise<unknown> => {
  const config = supabaseConfig();
  if (!config) throw new Error('STORE_NOT_CONFIGURED');
  const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`SUPABASE_${response.status}:${body.slice(0, 300)}`) as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.json();
};

// Dev fallback, same shape as account.ts: a JSON file, refused on Vercel where a local file
// would silently lose the keys the user thinks are saved.
const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH = serverEnv('ZC_PROVIDER_KEYS_STORE') ?? path.join(process.cwd(), '.zc-provider-keys.json');

type FileShape = Record<string, { provider: string; model: string; encrypted: string; updatedAt: string }>;

const readAll = async (): Promise<FileShape> => {
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ STORE_PATH, 'utf8')) as FileShape;
  } catch {
    return {};
  }
};

const writeAll = (data: FileShape) =>
  writeFile(/* turbopackIgnore: true */ STORE_PATH, JSON.stringify(data, null, 2), 'utf8');

const assertStoreAvailable = () => {
  if (supabaseConfig()) return;
  if (EPHEMERAL) throw new Error('SUPABASE_NOT_CONFIGURED');
};

const rowKey = (email: string, provider: string) => `${email}|${provider}`;

interface Row {
  provider: string;
  model: string;
  encrypted_key: string;
  updated_at: string;
}

const toRecord = (row: Row): ProviderKeyRecord => ({
  provider: row.provider,
  model: row.model,
  updatedAt: row.updated_at,
});

export const listProviderKeys = async (email: string): Promise<ProviderKeyRecord[]> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&select=provider,model,updated_at&order=provider`
    );
    return (rows as Row[]).map(toRecord);
  }
  return Object.values(await readAll())
    .filter((entry) => entry && rowKey(key, entry.provider).startsWith(`${key}|`))
    .map(({ provider, model, updatedAt }) => ({ provider, model, updatedAt }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
};

/** Decrypted secrets for the caller's own browser session, so a reload restores the in-memory
 *  keys chat needs. Never persisted client-side, never logged, returned only over the
 *  authenticated route — the same trust boundary as browser-direct BYOK already accepts. */
export const listProviderKeysWithSecrets = async (
  email: string
): Promise<(ProviderKeyRecord & { key: string })[]> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&select=provider,model,encrypted_key,updated_at&order=provider`
    );
    return (rows as Row[]).map((row) => ({ ...toRecord(row), key: decryptProviderKey(row.encrypted_key) }));
  }
  return Object.entries(await readAll())
    .filter(([k]) => k.startsWith(`${key}|`))
    .map(([, entry]) => ({
      provider: entry.provider,
      model: entry.model,
      updatedAt: entry.updatedAt,
      key: decryptProviderKey(entry.encrypted),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
};

export const saveProviderKey = async (
  email: string,
  provider: string,
  model: string,
  plainKey: string
): Promise<ProviderKeyRecord> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  const encrypted = encryptProviderKey(plainKey);
  const updatedAt = new Date().toISOString();
  if (supabaseConfig()) {
    const rows = await request('zc_provider_keys?on_conflict=user_email,provider', {
      method: 'POST',
      body: JSON.stringify({
        user_email: key,
        provider,
        model,
        encrypted_key: encrypted,
        updated_at: updatedAt,
      }),
    });
    const [row] = rows as Row[];
    if (row) return toRecord(row);
    const [existing] = (await request(
      `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&provider=eq.${encodeURIComponent(provider)}&select=provider,model,updated_at`
    )) as Row[];
    return toRecord(existing);
  }
  const data = await readAll();
  data[rowKey(key, provider)] = { provider, model, encrypted, updatedAt };
  await writeAll(data);
  return { provider, model, updatedAt };
};

export const deleteProviderKey = async (email: string, provider: string): Promise<boolean> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&provider=eq.${encodeURIComponent(provider)}`,
      { method: 'DELETE' }
    );
    return (rows as unknown[]).length > 0;
  }
  const data = await readAll();
  const k = rowKey(key, provider);
  if (!data[k]) return false;
  delete data[k];
  await writeAll(data);
  return true;
};

export const deleteAllProviderKeys = async (email: string): Promise<number> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    );
    return (rows as unknown[]).length;
  }
  const data = await readAll();
  let removed = 0;
  for (const k of Object.keys(data)) {
    if (k.startsWith(`${key}|`)) {
      delete data[k];
      removed += 1;
    }
  }
  if (removed) await writeAll(data);
  return removed;
};
