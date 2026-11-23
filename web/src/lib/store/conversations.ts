import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '../serverEnv.ts';
import type { ChatMessage, ChatMode, TurnFailure, WhyStop } from '../../prototype/chat/engine.ts';
import { copy } from '../../prototype/i18n.ts';

export type ConversationKind = 'solo' | 'group';

export interface ConversationRecord {
  id: string;
  kind: ConversationKind;
  botId?: string;
  title: string;
  mode: ChatMode;
  roster: string[];
  messages: ChatMessage[];
  turns: number;
  stoppedBy: WhyStop | null;
  failures: TurnFailure[];
  held: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationInput {
  kind?: unknown;
  botId?: unknown;
  title?: unknown;
  mode?: unknown;
  roster?: unknown;
  messages?: unknown;
  language?: unknown;
}

export interface PatchConversationInput {
  id?: unknown;
  title?: unknown;
  mode?: unknown;
  roster?: unknown;
  messages?: unknown;
  turns?: unknown;
  stoppedBy?: unknown;
  failures?: unknown;
  held?: unknown;
}

const sanitizeMessages = (raw: unknown): ChatMessage[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => {
      const attachments = Array.isArray(item.attachments)
        ? item.attachments
            .filter((att): att is Record<string, unknown> => Boolean(att && typeof att === 'object'))
            .map((att, aIdx) => ({
              id: typeof att.id === 'string' && att.id.trim() ? att.id : `att-${idx}-${aIdx}`,
              kind:
                att.kind === 'image' || att.kind === 'video' || att.kind === 'file'
                  ? (att.kind as 'image' | 'video' | 'file')
                  : ('link' as const),
              name: typeof att.name === 'string' && att.name.trim() ? att.name : 'attachment',
              href: typeof att.href === 'string' && att.href.trim() ? att.href : 'attachment://item',
              ...(typeof att.text === 'string' ? { text: att.text.slice(0, 24_000) } : {}),
              ...(typeof att.truncated === 'boolean' ? { truncated: att.truncated } : {}),
              ...(typeof att.problem === 'string' ? { problem: att.problem } : {}),
            }))
        : undefined;
      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id : String(idx),
        authorId: typeof item.authorId === 'string' && item.authorId.trim() ? item.authorId : 'user',
        body: typeof item.body === 'string' ? item.body : '',
        mentioned: Array.isArray(item.mentioned)
          ? item.mentioned.filter((m): m is string => typeof m === 'string')
          : [],
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      };
    });
};

export const validateCreateConversation = (
  input: CreateConversationInput
):
  | {
      value: {
        kind: ConversationKind;
        botId?: string;
        title: string;
        mode: ChatMode;
        roster: string[];
        messages: ChatMessage[];
      };
    }
  | { error: string } => {
  const kind = input?.kind === 'solo' || input?.kind === 'group' ? input.kind : null;
  if (!kind) return { error: 'INVALID_CONVERSATION_KIND' };
  const lang = input?.language === 'vi' ? 'vi' : 'en';
  const title =
    typeof input?.title === 'string' && input.title.trim()
      ? input.title.trim().slice(0, 140)
      : kind === 'group'
        ? copy[lang].defaultGroupTitle
        : copy[lang].defaultSoloTitle;
  const mode: ChatMode = input?.mode === 'panel' ? 'panel' : 'round-robin';
  const roster = Array.isArray(input?.roster)
    ? [...new Set(input.roster.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))]
    : [];

  if (kind === 'solo') {
    const botId = typeof input?.botId === 'string' ? input.botId.trim() : '';
    if (!botId) return { error: 'BOT_ID_REQUIRED' };
    const effectiveRoster = roster.length === 1 ? roster : [`bot:${botId}`];
    if (effectiveRoster.length !== 1) return { error: 'SOLO_REQUIRES_ONE_BOT' };
    return {
      value: {
        kind: 'solo',
        botId,
        title,
        mode: 'round-robin',
        roster: effectiveRoster,
        messages: sanitizeMessages(input?.messages),
      },
    };
  }

  // Group Chat rule: strictly requires AT LEAST 2 bots!
  if (roster.length < 2) {
    return { error: 'GROUP_REQUIRES_TWO_BOTS' };
  }

  return {
    value: {
      kind: 'group',
      title,
      mode,
      roster,
      messages: sanitizeMessages(input?.messages),
    },
  };
};

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
    throw new Error(`SUPABASE_${response.status}:${body.slice(0, 300)}`);
  }
  return response.json();
};

const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH =
  serverEnv('ZC_CONVERSATIONS_STORE') ?? path.join(process.cwd(), '.zc-conversations.json');

type FileShape = Record<string, ConversationRecord>;

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

interface DbRow {
  id: string;
  title: string;
  conversation_type: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const fromDbRow = (row: DbRow): ConversationRecord | null => {
  const meta = row.metadata ?? {};
  const kind: ConversationKind | null =
    meta.kind === 'solo' || row.conversation_type === 'solo'
      ? 'solo'
      : meta.kind === 'group' || row.conversation_type === 'group'
        ? 'group'
        : null;
  if (!kind) return null;
  const roster = Array.isArray(meta.roster)
    ? meta.roster.filter((item): item is string => typeof item === 'string')
    : [];
  if (roster.length === 0) return null;
  return {
    id: row.id,
    kind,
    ...(typeof meta.botId === 'string' ? { botId: meta.botId } : {}),
    title: row.title,
    mode: meta.mode === 'panel' ? 'panel' : 'round-robin',
    roster,
    messages: sanitizeMessages(meta.messages),
    turns: typeof meta.turns === 'number' ? meta.turns : 0,
    stoppedBy: typeof meta.stoppedBy === 'string' ? (meta.stoppedBy as WhyStop) : null,
    failures: Array.isArray(meta.failures) ? (meta.failures as TurnFailure[]) : [],
    held: Array.isArray(meta.held)
      ? meta.held.filter((item): item is string => typeof item === 'string')
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const listConversations = async (email: string): Promise<ConversationRecord[]> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  if (supabaseConfig()) {
    const rows = (await request(
      `zc_conversations?user_email=eq.${encodeURIComponent(key)}&conversation_type=in.(solo,group)&select=id,title,conversation_type,metadata,created_at,updated_at&order=updated_at.desc`
    )) as DbRow[];
    return rows.map(fromDbRow).filter((item): item is ConversationRecord => item !== null);
  }
  return Object.entries(await readAll())
    .filter(([k]) => k.startsWith(`${key}|`))
    .map(([, entry]) => entry)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createConversation = async (
  email: string,
  input: {
    kind: ConversationKind;
    botId?: string;
    title: string;
    mode: ChatMode;
    roster: string[];
    messages: ChatMessage[];
  }
): Promise<ConversationRecord> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  const now = new Date().toISOString();
  const record: ConversationRecord = {
    id: randomUUID(),
    kind: input.kind,
    ...(input.botId ? { botId: input.botId } : {}),
    title: input.title,
    mode: input.mode,
    roster: input.roster,
    messages: input.messages,
    turns: 0,
    stoppedBy: null,
    failures: [],
    held: [],
    createdAt: now,
    updatedAt: now,
  };
  if (supabaseConfig()) {
    const rows = (await request('zc_conversations', {
      method: 'POST',
      body: JSON.stringify({
        id: record.id,
        user_email: key,
        title: record.title,
        conversation_type: record.kind,
        status: 'Active',
        metadata: {
          kind: record.kind,
          botId: record.botId ?? null,
          mode: record.mode,
          roster: record.roster,
          messages: record.messages,
          turns: record.turns,
          stoppedBy: record.stoppedBy,
          failures: record.failures,
          held: record.held,
        },
        created_at: now,
        updated_at: now,
      }),
    })) as DbRow[];
    return fromDbRow(rows[0]) ?? record;
  }
  const data = await readAll();
  data[rowKey(key, record.id)] = record;
  await writeAll(data);
  return record;
};

export const updateConversation = async (
  email: string,
  id: string,
  patch: PatchConversationInput
): Promise<{ conversation: ConversationRecord } | { error: string }> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  const existingList = await listConversations(key);
  const current = existingList.find((item) => item.id === id);
  if (!current) return { error: 'CONVERSATION_NOT_FOUND' };

  const nextTitle =
    typeof patch.title === 'string' && patch.title.trim()
      ? patch.title.trim().slice(0, 140)
      : current.title;
  const nextMode: ChatMode =
    patch.mode === 'panel' || patch.mode === 'round-robin' ? patch.mode : current.mode;
  const nextRoster = Array.isArray(patch.roster)
    ? [...new Set(patch.roster.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))]
    : current.roster;

  if (current.kind === 'group' && nextRoster.length < 2) {
    return { error: 'GROUP_REQUIRES_TWO_BOTS' };
  }
  if (current.kind === 'solo' && nextRoster.length !== 1) {
    return { error: 'SOLO_REQUIRES_ONE_BOT' };
  }

  const now = new Date().toISOString();
  const updated: ConversationRecord = {
    ...current,
    title: nextTitle,
    mode: current.kind === 'solo' ? 'round-robin' : nextMode,
    roster: nextRoster,
    messages: patch.messages !== undefined ? sanitizeMessages(patch.messages) : current.messages,
    turns: typeof patch.turns === 'number' ? patch.turns : current.turns,
    stoppedBy:
      patch.stoppedBy === null || typeof patch.stoppedBy === 'string'
        ? (patch.stoppedBy as WhyStop | null)
        : current.stoppedBy,
    failures: Array.isArray(patch.failures) ? (patch.failures as TurnFailure[]) : current.failures,
    held: Array.isArray(patch.held)
      ? patch.held.filter((item): item is string => typeof item === 'string')
      : current.held,
    updatedAt: now,
  };

  if (supabaseConfig()) {
    await request(
      `zc_conversations?user_email=eq.${encodeURIComponent(key)}&id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: updated.title,
          metadata: {
            kind: updated.kind,
            botId: updated.botId ?? null,
            mode: updated.mode,
            roster: updated.roster,
            messages: updated.messages,
            turns: updated.turns,
            stoppedBy: updated.stoppedBy,
            failures: updated.failures,
            held: updated.held,
          },
          updated_at: now,
        }),
      }
    );
    return { conversation: updated };
  }

  const data = await readAll();
  data[rowKey(key, id)] = updated;
  await writeAll(data);
  return { conversation: updated };
};

export const deleteConversation = async (email: string, id: string): Promise<boolean> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  if (supabaseConfig()) {
    const rows = (await request(
      `zc_conversations?user_email=eq.${encodeURIComponent(key)}&id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )) as unknown[];
    return rows.length > 0;
  }
  const data = await readAll();
  const k = rowKey(key, id);
  if (!data[k]) return false;
  delete data[k];
  await writeAll(data);
  return true;
};

export const deleteAllConversations = async (email: string): Promise<number> => {
  assertStoreAvailable();
  const key = normalizeEmail(email);
  if (supabaseConfig()) {
    const rows = (await request(
      `zc_conversations?user_email=eq.${encodeURIComponent(key)}&conversation_type=in.(solo,group)`,
      { method: 'DELETE' }
    )) as unknown[];
    return rows.length;
  }
  const data = await readAll();
  let removed = 0;
  for (const k of Object.keys(data)) {
    if (k.startsWith(`${key}|`)) {
      delete data[k];
      removed += 1;
    }
  }
  if (removed > 0) await writeAll(data);
  return removed;
};
