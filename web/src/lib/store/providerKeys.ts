import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decryptProviderKey, encryptProviderKey } from '../crypto/providerKeys.ts';
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

const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH = serverEnv('ZC_PROVIDER_KEYS_STORE') ?? path.join(process.cwd(), '.zc-provider-keys.json');

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
  models?: unknown;
  label?: string | null;
  protocol?: string | null;
  base_url?: string | null;
  encrypted_key?: string;
  updated_at: string;
}

const normalizeModels = (primaryModel: string, rawModels: unknown): string[] => {
  const list = Array.isArray(rawModels)
    ? rawModels.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
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
    return rows.map((row) => ({ ...toRecord(row), key: decryptProviderKey(row.encrypted_key ?? '') }));
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
      key: decryptProviderKey(entry.encrypted),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
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
    try {
      const rows = await request('zc_provider_keys?on_conflict=user_email,provider', {
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
      const [row] = rows as Row[];
      if (row) return toRecord(row);
    } catch {
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
      if (row) return { ...toRecord(row), models, ...(meta.label ? { label: meta.label } : {}), ...(meta.protocol ? { protocol: meta.protocol } : {}), ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}) };
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
