/**
 * Keeps a live room across a page reload.
 *
 * A deliberation is the whole product; losing twenty turns to a refresh makes the room feel like a
 * toy. `sessionStorage` is the smallest thing that fixes it and is native, so there is no new
 * dependency and no server round trip.
 *
 * The ceiling is deliberate and named: this is per-tab and dies with the tab. It is not a room you
 * can reopen on another device, and it is not a backup. Durable history needs auth and a store,
 * which do not exist yet — see `.agent/TODO.md`. When they do, this file is the only thing to
 * replace; nothing else touches storage.
 */

/** Bumped whenever `ChatRoom` gains a field, so an old blob cannot half-load into a new UI. */
const SCHEMA = 2;
const KEY = 'zero-council:room';

/** What is stored about an attachment. `text` is kept so a reloaded room does not re-fetch the page. */
interface StoredAttachment {
  id: string;
  /** Spelled out rather than imported: this file imports nothing, by design. */
  kind: 'link' | 'image' | 'file';
  name: string;
  href: string;
  text?: string;
  problem?: string;
}

/**
 * Only the fields needed to rebuild the room. `mode`, `roster`, `held`, `turns`, `stoppedBy` and
 * `failures` all affect what the room does next, so they are stored rather than re-derived.
 */
interface StoredRoom {
  schema: number;
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
  /** Pinned to the next message but not sent yet. Sending moves them onto that message. */
  pending: StoredAttachment[];
  turns: number;
  stoppedBy: string | null;
  failures: unknown[];
  held: string[];
}

/**
 * Parses defensively. Anything unreadable returns null so the user lands in a fresh room rather
 * than a crash: a corrupt cache is not worth failing a page over.
 */
export const readStoredRoom = (): StoredRoom | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRoom;
    if (parsed?.schema !== SCHEMA) return null;
    if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.roster)) return null;
    // Pinned-but-unsent attachments live in the room: reloading must not silently drop what the
    // user had just attached, which is how it was lost before this field existed.
    if (!Array.isArray(parsed.pending)) return null;
    // A room with no advisors cannot produce a round; treat it as absent rather than as an error.
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
    // The schema tag is written here, not by the caller, so a caller can never store a blob that
    // claims a version it does not have.
    window.sessionStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, ...room }));
  } catch {
    // A full or blocked store (private mode, quota) must not break the room that is running.
  }
};

export const clearStoredRoom = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
};