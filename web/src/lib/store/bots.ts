import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '../serverEnv.ts';
import type { ValidBotInput } from './botValidation.ts';

// Per-account bots, mirroring providerKeys.ts: every query is scoped by the
// caller's own email, resolved in the route handler from the session — never
// from a client-supplied value. Supabase in prod, JSON file in local dev.

export interface BotRecord {
  id: string;
  name: string;
  instruction: string;
  provider: string;
  model: string;
  createdAt: string;
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

const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH = serverEnv('ZC_BOTS_STORE') ?? path.join(process.cwd(), '.zc-bots.json');

type FileShape = Record<string, BotRecord>;

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

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const rowKey = (email: string, id: string) => `${email}|${id}`;

interface Row {
  id: string;
  name: string;
  instruction: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
}

const toRecord = (row: Row): BotRecord => ({
  id: row.id,
  name: row.name,
  instruction: row.instruction,
  provider: row.provider,
  model: row.model,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listBots = async (email: string): Promise<BotRecord[]> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  if (supabaseConfig()) {
    const rows = await request(
      `zc_bots?user_email=eq.${encodeURIComponent(key)}&select=id,name,instruction,provider,model,created_at,updated_at&order=created_at`
    );
    return (rows as Row[]).map(toRecord);
  }
  return Object.entries(await readAll())
    .filter(([k]) => k.startsWith(`${key}|`))
    .map(([, entry]) => entry)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const createBot = async (email: string, input: ValidBotInput): Promise<BotRecord> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  const now = new Date().toISOString();
  const record: BotRecord = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  if (supabaseConfig()) {
    const rows = await request('zc_bots', {
      method: 'POST',
      body: JSON.stringify({
        user_email: key,
        id: record.id,
        name: record.name,
        instruction: record.instruction,
        provider: record.provider,
        model: record.model,
      }),
    });
    const [row] = rows as Row[];
    return toRecord(row);
  }
  const data = await readAll();
  data[rowKey(key, record.id)] = record;
  await writeAll(data);
  return record;
};

export const updateBot = async (
  email: string,
  id: string,
  input: ValidBotInput
): Promise<BotRecord | null> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  const now = new Date().toISOString();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_bots?user_email=eq.${encodeURIComponent(key)}&id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: input.name,
          instruction: input.instruction,
          provider: input.provider,
          model: input.model,
          updated_at: now,
        }),
      }
    );
    const [row] = rows as Row[];
    return row ? toRecord(row) : null;
  }
  const data = await readAll();
  const k = rowKey(key, id);
  if (!data[k]) return null;
  data[k] = { ...data[k], ...input, id, createdAt: data[k].createdAt, updatedAt: now };
  await writeAll(data);
  return data[k];
};

export const deleteBot = async (email: string, id: string): Promise<boolean> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  if (supabaseConfig()) {
    const rows = await request(
      `zc_bots?user_email=eq.${encodeURIComponent(key)}&id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return (rows as unknown[]).length > 0;
  }
  const data = await readAll();
  const k = rowKey(key, id);
  if (!data[k]) return false;
  delete data[k];
  await writeAll(data);
  return true;
};
