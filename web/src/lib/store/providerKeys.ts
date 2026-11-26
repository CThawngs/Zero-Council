import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  decryptProviderKey,
  encryptProviderKey,
  INVALID_PROVIDER_KEY_SECRET,
  MISSING_PROVIDER_KEY_SECRET,
} from '../crypto/providerKeys.ts';
import { serverEnv } from '../serverEnv.ts';

export interface ProviderKeyRecord {
  provider: string;
  model: string;
  models?: string[];
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
  updatedAt: string;
}

export interface SaveProviderKeyMeta {
  models?: string[];
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
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
      Prefer: 'return=representation,resolution=merge-duplicates',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SUPABASE_${response.status}:${body.slice(0, 300)}`);
  }
  return response.json();
};

/**
 * Stable error codes the provider routes return as JSON instead of a generic 500.
 * `status` is the HTTP status our API answers with.
 */
export type ProviderStoreErrorCode =
  | typeof MISSING_PROVIDER_KEY_SECRET
  | typeof INVALID_PROVIDER_KEY_SECRET
  | 'STORE_NOT_CONFIGURED'
  | 'STORE_SCHEMA_OUTDATED'
  | 'STORE_UNAVAILABLE';

export const STORE_SCHEMA_OUTDATED = 'STORE_SCHEMA_OUTDATED';

const CONFIGURATION_ERRORS = new Set<string>([MISSING_PROVIDER_KEY_SECRET, INVALID_PROVIDER_KEY_SECRET]);

/** Maps an error thrown by this store (or the crypto layer) to a code that is safe to show. */
export const providerStoreErrorOf = (
  error: unknown
): { code: ProviderStoreErrorCode; status: number } => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === MISSING_PROVIDER_KEY_SECRET) return { code: MISSING_PROVIDER_KEY_SECRET, status: 503 };
  if (message === INVALID_PROVIDER_KEY_SECRET) return { code: INVALID_PROVIDER_KEY_SECRET, status: 503 };
  if (message === 'SUPABASE_NOT_CONFIGURED' || message === 'STORE_NOT_CONFIGURED') {
    return { code: 'STORE_NOT_CONFIGURED', status: 503 };
  }
  if (message === STORE_SCHEMA_OUTDATED) return { code: STORE_SCHEMA_OUTDATED, status: 503 };
  return { code: 'STORE_UNAVAILABLE', status: 502 };
};

/** PostgreSQL foreign-key violation from an unmigrated pre-0008 schema. */
const isLegacyProviderForeignKeyError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : '';
  return /23503/.test(message) && /(fk_zc_provider_keys_provider|zc_provider_keys_provider_fkey)/.test(message);
};

/** PostgREST / PostgreSQL "column does not exist" (database older than migration 0008). */
const isMissingColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : '';
  return /(PGRST204|42703|column)/i.test(message);
};

const storePath = () =>
  serverEnv('ZC_PROVIDER_KEYS_STORE') ?? path.join(process.cwd(), '.zc-provider-keys.json');

type FileEntry = {
  provider: string;
  model: string;
  models?: string[];
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
  encrypted: string;
  updatedAt: string;
};

type FileShape = Record<string, FileEntry>;

const readAll = async (): Promise<FileShape> => {
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ storePath(), 'utf8')) as FileShape;
  } catch {
    return {};
  }
};

const writeAll = (data: FileShape) =>
  writeFile(/* turbopackIgnore: true */ storePath(), JSON.stringify(data, null, 2), 'utf8');

const assertStoreAvailable = () => {
  if (supabaseConfig()) return;
  if (serverEnv('VERCEL') === '1') throw new Error('SUPABASE_NOT_CONFIGURED');
};

const rowKey = (email: string, provider: string) => `${email}|${provider}`;

interface Row {
  provider: string;
  model: string;
  models?: unknown;
  label?: string | null;
  protocol?: string | null;
  base_url?: string | null;
  encrypted_key?: string;
  updated_at: string;
}

const normalizeModels = (primaryModel: string, rawModels: unknown): string[] => {
  const list = Array.isArray(rawModels)
    ? rawModels.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map((m) => m.trim())
    : [];
  if (primaryModel && !list.includes(primaryModel)) {
    list.unshift(primaryModel);
  }
  return [...new Set(list)];
};

const toRecord = (row: Row): ProviderKeyRecord => ({
  provider: row.provider,
  model: row.model,
  models: normalizeModels(row.model, row.models),
  ...(row.label ? { label: row.label } : {}),
  ...(row.protocol === 'anthropic' || row.protocol === 'openai' || row.protocol === 'google'
    ? { protocol: row.protocol }
    : {}),
  ...(row.base_url ? { baseUrl: row.base_url } : {}),
  updatedAt: row.updated_at,
});

export const listProviderKeys = async (email: string): Promise<ProviderKeyRecord[]> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    try {
      const rows = await request(
        `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&select=provider,model,models,label,protocol,base_url,updated_at&order=provider`
      );
      return (rows as Row[]).map(toRecord);
    } catch {
      const rows = await request(
        `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&select=provider,model,updated_at&order=provider`
      );
      return (rows as Row[]).map(toRecord);
    }
  }
  return Object.entries(await readAll())
    .filter(([k]) => k.startsWith(`${key}|`))
    .map(([, entry]) => ({
      provider: entry.provider,
      model: entry.model,
      models: normalizeModels(entry.model, entry.models),
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.protocol ? { protocol: entry.protocol } : {}),
      ...(entry.baseUrl ? { baseUrl: entry.baseUrl } : {}),
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
};

export const listProviderKeysWithSecrets = async (
  email: string
): Promise<(ProviderKeyRecord & { key: string })[]> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    let rows: Row[];
    try {
      rows = (await request(
        `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&select=provider,model,models,label,protocol,base_url,encrypted_key,updated_at&order=provider`
      )) as Row[];
    } catch {
      rows = (await request(
        `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&select=provider,model,encrypted_key,updated_at&order=provider`
      )) as Row[];
    }
    const results: (ProviderKeyRecord & { key: string })[] = [];
    for (const row of rows) {
      try {
        results.push({ ...toRecord(row), key: decryptProviderKey(row.encrypted_key ?? '') });
      } catch (error) {
        if (CONFIGURATION_ERRORS.has((error as Error).message)) throw error;
        console.warn(
          `[store/providerKeys] skipping unreadable row for ${row.provider}: ${(error as Error).message}`
        );
      }
    }
    return results;
  }
  const results: (ProviderKeyRecord & { key: string })[] = [];
  for (const [k, entry] of Object.entries(await readAll())) {
    if (!k.startsWith(`${key}|`)) continue;
    try {
      results.push({
        provider: entry.provider,
        model: entry.model,
        models: normalizeModels(entry.model, entry.models),
        ...(entry.label ? { label: entry.label } : {}),
        ...(entry.protocol ? { protocol: entry.protocol } : {}),
        ...(entry.baseUrl ? { baseUrl: entry.baseUrl } : {}),
        updatedAt: entry.updatedAt,
        key: decryptProviderKey(entry.encrypted),
      });
    } catch (error) {
      if (CONFIGURATION_ERRORS.has((error as Error).message)) throw error;
      console.warn(
        `[store/providerKeys] skipping unreadable local entry for ${entry.provider}: ${(error as Error).message}`
      );
    }
  }
  return results.sort((a, b) => a.provider.localeCompare(b.provider));
};

export const saveProviderKey = async (
  email: string,
  provider: string,
  model: string,
  plainKey: string,
  meta: SaveProviderKeyMeta = {}
): Promise<ProviderKeyRecord> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  const encrypted = encryptProviderKey(plainKey);
  const updatedAt = new Date().toISOString();
  const models = normalizeModels(model, meta.models);
  if (supabaseConfig()) {
    let rows: unknown = null;
    try {
      rows = await request('zc_provider_keys?on_conflict=user_email,provider', {
        method: 'POST',
        body: JSON.stringify({
          user_email: key,
          provider,
          model,
          models,
          label: meta.label ?? null,
          protocol: meta.protocol ?? null,
          base_url: meta.baseUrl ?? null,
          encrypted_key: encrypted,
          updated_at: updatedAt,
        }),
      });
    } catch (error) {
      if (isLegacyProviderForeignKeyError(error)) {
        // Pre-0008 schema still carrying the dropped provider FK: report schema outdated cleanly.
        throw new Error(STORE_SCHEMA_OUTDATED);
      }
      if (!isMissingColumnError(error)) {
        throw error;
      }
    }
    const [savedRow] = (Array.isArray(rows) ? rows : []) as Row[];
    if (savedRow) return toRecord(savedRow);
    if (rows === null) {
      const legacyRows = await request('zc_provider_keys?on_conflict=user_email,provider', {
        method: 'POST',
        body: JSON.stringify({
          user_email: key,
          provider,
          model,
          encrypted_key: encrypted,
          updated_at: updatedAt,
        }),
      });
      const [legacyRow] = legacyRows as Row[];
      if (legacyRow) {
        return {
          ...toRecord(legacyRow),
          models,
          ...(meta.label ? { label: meta.label } : {}),
          ...(meta.protocol ? { protocol: meta.protocol } : {}),
          ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
        };
      }
    }
    const [existing] = (await request(
      `zc_provider_keys?user_email=eq.${encodeURIComponent(key)}&provider=eq.${encodeURIComponent(provider)}&select=provider,model,updated_at`
    )) as Row[];
    return toRecord(existing);
  }
  const data = await readAll();
  data[rowKey(key, provider)] = {
    provider,
    model,
    models,
    ...(meta.label ? { label: meta.label } : {}),
    ...(meta.protocol ? { protocol: meta.protocol } : {}),
    ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
    encrypted,
    updatedAt,
  };
  await writeAll(data);
  return {
    provider,
    model,
    models,
    ...(meta.label ? { label: meta.label } : {}),
    ...(meta.protocol ? { protocol: meta.protocol } : {}),
    ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
    updatedAt,
  };
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
