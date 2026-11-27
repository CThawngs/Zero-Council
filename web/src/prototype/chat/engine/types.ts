/**
 * Core contracts and budget constants for the Zero Council multi-agent conversation engine.
 *
 * Pure data shapes and constants only — zero runtime dependencies so both engine submodules and
 * UI components can import types without circular dependency edges.
 */

export const USER_HANDLE = 'user';

/** Announced as a single token so a pass is a decision, not an empty string. */
export const SILENT_TOKEN = '[SILENT]';

/** Sentinel id for `@all` / `@everyone` — never a real advisor. */
export const RESUME_ALL = '__all__';

/** Mentions that address every held advisor at once, for a resume. */
export const USER_ALIASES = ['user', 'you'];
export const RESUME_ALIASES = ['all', 'everyone'];

/** Context window per advisor turn, bounded so long transcripts never blow token limits. */
export const CONTEXT_MAX_MESSAGES = 200;
export const CONTEXT_MAX_CHARS = 32_000;
export const CONTEXT_SINGLE_EXCERPT = 8_000;

/** Maximum advisor turns one user message may trigger before the room parks itself. */
export const DEFAULT_MAX_TURNS = 12;

/** Maximum serial rounds per user message in Debate (`round-robin`) mode when opted in. */
export const COUNCIL_ROUNDS = 3;

/** Cumulative advisor turn ceiling for the entire room. */
export const DEFAULT_ROOM_BUDGET = 200;

/** Per-turn timeout (ms) before an unresponsive provider call is aborted cleanly. */
export const DEFAULT_TURN_TIMEOUT_MS = 55_000;

/** Base backoff (ms) before the single retry on transient HTTP 429/502/503/504 or network reset. */
export const DEFAULT_RETRY_DELAY_MS = 800;

export type ChatMode = 'round-robin' | 'panel';

export interface ChatBot {
  id: string;
  name: string;
}

export type AttachmentKind = 'link' | 'image' | 'video' | 'file';

/**
 * Attachment pinned to a message. `text` is read once at attach time rather than re-fetched on
 * every advisor turn; `dataUrl`/`frames`/`previewUrl` stay in memory only (see `storage.ts`).
 */
export interface ChatAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  href: string;
  text?: string;
  truncated?: boolean;
  dataUrl?: string;
  frames?: string[];
  previewUrl?: string;
  problem?: string;
}

export interface ChatMessage {
  id: string;
  /** `USER_HANDLE` or a bot id. */
  authorId: string;
  body: string;
  /** Ids resolved from `@` in user text — display and opening speaker selection only. */
  mentioned: string[];
  attachments?: ChatAttachment[];
}

/** Structured output of a single advisor turn. Bot-to-bot handoffs use `handoffs`, never prose. */
export interface BotTurn {
  text: string;
  handoffs: string[];
  silent?: boolean;
}

export type WhyStop = 'user' | 'silent' | 'max-turns' | 'budget' | 'failed' | 'cancelled';

export type TurnFailure =
  | { kind: 'silent'; messageId: string }
  | { kind: 'timeout'; after: number }
  | { kind: 'transient'; detail: string }
  | { kind: 'fatal'; detail: string };

/** Actionable failure category so the UI can show Retry vs Connect Key without guessing from raw text. */
export type TurnFailureReason =
  | 'missing-key'
  | 'provider-auth'
  | 'rate-limit'
  | 'timeout'
  | 'provider-error';

export interface TurnError {
  reason: TurnFailureReason;
  botId: string;
  provider?: string;
  detail: string;
  retryable: boolean;
}

export interface ChatTurnRequest {
  bot: ChatBot;
  roster?: ChatBot[];
  history: ChatMessage[];
  waiting: ChatBot[];
  handoffTargets?: ChatBot[];
  isClosing: boolean;
  prompt: string;
  language: 'en' | 'vi';
  attachments: ChatAttachment[];
  signal?: AbortSignal;
  soloMode?: boolean;
  mode?: ChatMode;
}

export type BotGenerator = (request: ChatTurnRequest) => Promise<BotTurn> | BotTurn;

export interface RunTurnInput {
  roster: ChatBot[];
  mode: ChatMode;
  history: ChatMessage[];
  userMessage: ChatMessage;
  generate: BotGenerator;
  maxTurns?: number;
  rounds?: number;
  roomBudget?: number;
  language?: 'en' | 'vi';
  turnsUsed?: number;
  roundIndex?: number;
  signal?: AbortSignal;
  onTurn?: (message: ChatMessage) => void;
  turnTimeoutMs?: number;
  retryDelayMs?: number;
  soloMode?: boolean;
}

export interface RunTurnResult {
  messages: ChatMessage[];
  stoppedBy: WhyStop;
  speakers: string[];
  failures: TurnFailure[];
  failureReason?: TurnFailureReason;
  turnError?: TurnError;
}
