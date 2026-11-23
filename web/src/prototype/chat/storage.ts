import { localizeAttachmentProblem } from '../i18n.ts';
import type { Language } from '../types.ts';

const SCHEMA = 2;
const KEY = 'zero-council:room';

interface StoredAttachment {
  id: string;
  kind: 'link' | 'image' | 'video' | 'file';
  name: string;
  href: string;
  text?: string;
  truncated?: boolean;
  dataUrl?: string;
  frames?: string[];
  previewUrl?: string;
  problem?: string;
}

interface StoredRoom {
  schema: number;
  conversationId?: string;
  kind?: 'solo' | 'group';
  botId?: string;
  title: string;
  mode: string;
  roster: string[];
  messages: {
    id: string;
    authorId: string;
    body: string;
    mentioned: string[];
    attachments?: StoredAttachment[];
  }[];
  pending: StoredAttachment[];
  turns: number;
  stoppedBy: string | null;
  failures: unknown[];
  held: string[];
}

const withoutHeavyBytes = <
  T extends { dataUrl?: string; frames?: string[]; previewUrl?: string }
>(
  attachments: T[] | undefined
): T[] | undefined =>
  attachments?.map((attachment) => {
    if (
      attachment.dataUrl === undefined &&
      attachment.frames === undefined &&
      attachment.previewUrl === undefined
    ) {
      return attachment;
    }
    const copy = { ...attachment };
    delete copy.dataUrl;
    delete copy.frames;
    delete copy.previewUrl;
    return copy;
  });

export const readStoredRoom = (language: Language = 'en'): StoredRoom | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRoom;
    if (parsed?.schema !== SCHEMA) return null;
    if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.roster)) return null;
    if (!Array.isArray(parsed.pending)) return null;
    parsed.pending = parsed.pending.map((attachment) =>
      (attachment.kind === 'image' || attachment.kind === 'video') && !attachment.problem
        ? {
            ...attachment,
            problem: localizeAttachmentProblem(
              attachment.kind === 'video'
                ? 'The video was not kept when the page reloaded. Attach it again.'
                : 'The image was not kept when the page reloaded. Attach it again.',
              language
            ),
          }
        : attachment
    );
    if (parsed.roster.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

type RoomToStore = Omit<StoredRoom, 'schema'>;

export const writeStoredRoom = (room: RoomToStore): void => {
  if (typeof window === 'undefined') return;
  try {
    const stored = {
      schema: SCHEMA,
      ...room,
      messages: room.messages.map((message) => ({
        ...message,
        attachments: withoutHeavyBytes(message.attachments),
      })),
      pending: withoutHeavyBytes(room.pending) ?? [],
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Quota or private-mode failure must never break the live room.
  }
};

export const clearStoredRoom = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
};
