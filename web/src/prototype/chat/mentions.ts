/**
 * Pure @-mention detection, live filtering, replacement, rich inline tokenization,
 * and bilingual (EN/VI) UX strings for Solo & Group Chat rooms.
 */

import type { TurnFailure } from './engine.ts';
import { RESUME_ALL, USER_HANDLE } from './engine.ts';

export type ChatLanguage = 'en' | 'vi';

export interface ChatUxCopy {
  mentionTriggerLabel: string;
  mentionMenuTitle: string;
  mentionEmpty: string;
  mentionNavHint: string;
  mentionAllSubtitle: string;
  mentionAllBadge: string;
  mentionUserSubtitle: string;
  mentionUserBadge: string;
  mentionConnectedLabel: string;
  mentionPreviewLabel: string;
  defaultAttachmentPrompt: string;
  noKeySoloNote: string;
  noKeyGroupAllNote: string;
  noKeyGroupPartialNote: string;
  connectApiKeyCta: string;
  openSettingsCtaSolo: string;
  openSettingsCtaGroup: string;
  failureTimeout: string;
  failureTransient: string;
  failureFatal: string;
  failureSilent: string;
  failureUnknown: string;
  saveChanges: string;
}

export const CHAT_UX_COPY: Record<ChatLanguage, ChatUxCopy> = {
  en: {
    mentionTriggerLabel: 'Mention a bot or @all',
    mentionMenuTitle: 'Mention in chat',
    saveChanges: 'Save',
    mentionEmpty: 'No matching participant',
    mentionNavHint: '↑↓ navigate · Enter/Tab insert · Esc close',
    mentionAllSubtitle: 'Ask every active bot in this room to deliberate together',
    mentionAllBadge: 'Everyone',
    mentionUserSubtitle: 'Your handle in this conversation (@user / @you)',
    mentionUserBadge: 'You',
    mentionConnectedLabel: 'Connected',
    mentionPreviewLabel: 'Preview',
    defaultAttachmentPrompt: 'Analyze the attached files and media.',
    noKeySoloNote:
      'Preview mode — no API key is connected for this bot yet, so replies use simulated preview text.',
    noKeyGroupAllNote:
      'Preview mode — no API key is connected yet, so bots reply with simulated preview text.',
    noKeyGroupPartialNote:
      '{names} has no connected API key yet and will use simulated preview replies.',
    connectApiKeyCta: 'Connect API Key',
    openSettingsCtaSolo: 'Bot settings',
    openSettingsCtaGroup: 'Room settings',
    failureTimeout: 'timed out waiting for provider',
    failureTransient: 'temporary provider error',
    failureFatal: 'provider request failed',
    failureSilent: 'no response returned',
    failureUnknown: 'unexpected error',
  },
  vi: {

    saveChanges: 'Lưu',    mentionTriggerLabel: 'Gắn thẻ @bot hoặc @all',
    mentionMenuTitle: 'Gắn thẻ trong phòng chat',
    mentionEmpty: 'Không tìm thấy thành viên phù hợp',
    mentionNavHint: '↑↓ di chuyển · Enter/Tab chèn · Esc đóng',
    mentionAllSubtitle: 'Mời toàn bộ bot đang hoạt động trong phòng cùng thảo luận',
    mentionAllBadge: 'Tất cả',
    mentionUserSubtitle: 'Định danh của bạn trong cuộc trò chuyện (@user / @you)',
    mentionUserBadge: 'Bạn',
    mentionConnectedLabel: 'Đã kết nối',
    mentionPreviewLabel: 'Xem trước',
    defaultAttachmentPrompt: 'Hãy phân tích các tệp và phương tiện đính kèm.',
    noKeySoloNote:
      'Chế độ xem trước — bot này chưa có API Key kết nối nên phản hồi đang dùng nội dung mô phỏng.',
    noKeyGroupAllNote:
      'Chế độ xem trước — chưa kết nối API Key nên các bot đang phản hồi bằng nội dung mô phỏng.',
    noKeyGroupPartialNote:
      '{names} chưa kết nối API Key nên sẽ dùng phản hồi xem trước mô phỏng.',
    connectApiKeyCta: 'Kết nối API Key',
    openSettingsCtaSolo: 'Cài đặt bot',
    openSettingsCtaGroup: 'Cài đặt phòng',
    failureTimeout: 'quá thời gian chờ nhà cung cấp',
    failureTransient: 'lỗi kết nối tạm thời từ nhà cung cấp',
    failureFatal: 'yêu cầu tới nhà cung cấp thất bại',
    failureSilent: 'không nhận được phản hồi',
    failureUnknown: 'lỗi không xác định',
  },
};

export const formatTurnFailureReason = (
  failure: TurnFailure | undefined,
  language: ChatLanguage
): string => {
  const ux = CHAT_UX_COPY[language];
  if (!failure) return ux.failureUnknown;
  switch (failure.kind) {
    case 'timeout':
      return ux.failureTimeout;
    case 'transient':
      return ux.failureTransient;
    case 'fatal':
      return ux.failureFatal;
    case 'silent':
      return ux.failureSilent;
    default:
      return ux.failureUnknown;
  }
};

/**
 * Strips diacritics (including Vietnamese đ/Đ) and lowercases while preserving spaces
 * for prefix/word matching.
 */
export const normalizeMentionSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const compactMentionKey = (value: string): string =>
  normalizeMentionSearch(value).replace(/[^a-z0-9]/g, '');

export interface MentionQueryMatch {
  /** Index of '@' in the composer draft. */
  start: number;
  /** Current caret index where the query ends. */
  end: number;
  /** Raw text typed after '@' up to the caret. */
  query: string;
}

const VALID_TRIGGER_BEFORE = /[\s([{'"“‘«.,;:!?-]/u;
const VALID_QUERY_PATTERN = /^[\p{L}\p{N}_-]*(?:\s[\p{L}\p{N}_-]*){0,2}$/u;

/**
 * Detects an active `@query` right before `cursor` in a textarea draft.
 * Ignores email addresses (`dev@zerocouncil.local`), newlines, and already-completed
 * trailing-space mentions (`@all `, `@The Dreamer `).
 */
export const detectMentionQuery = (
  text: string,
  cursor: number,
  completedHandles: readonly string[] = ['all', 'everyone', 'user', 'you']
): MentionQueryMatch | null => {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const beforeCursor = text.slice(0, safeCursor);

  // Scan back to the nearest '@' on the current line only.
  const lastNewline = Math.max(beforeCursor.lastIndexOf('\n'), beforeCursor.lastIndexOf('\r'));
  const lineStart = lastNewline + 1;
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex < lineStart) return null;

  // '@' must be at index 0 or preceded by whitespace / opening punctuation (not alphanumeric email local-part).
  if (atIndex > 0) {
    const prevChar = beforeCursor[atIndex - 1];
    if (!VALID_TRIGGER_BEFORE.test(prevChar)) return null;
  }

  const query = beforeCursor.slice(atIndex + 1);
  if (query.includes('@')) return null;

  // Once the user finishes a known handle and types a trailing space ("@all ", "@The Dreamer "),
  // close the autocomplete popover naturally so normal sentence typing continues uninterrupted.
  if (/\s$/.test(query)) {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const normTrimmed = compactMentionKey(trimmed);
    const matchesCompleted = completedHandles.some(
      (handle) => compactMentionKey(handle) === normTrimmed
    );
    if (matchesCompleted) return null;
  }

  if (!VALID_QUERY_PATTERN.test(query)) return null;

  return {
    start: atIndex,
    end: safeCursor,
    query,
  };
};

export interface MentionBotInput {
  id: string;
  name: string;
  archetype?: string;
  providerLabel?: string;
  modelLabel?: string;
  colorHex?: string;
  connected?: boolean;
  locked?: boolean;
}

export interface MentionCandidate {
  id: string;
  kind: 'all' | 'bot' | 'user';
  /** Inserted without '@' as `@${handle} `. */
  handle: string;
  /** Primary display title in the menu. */
  label: string;
  /** Secondary description / model summary. */
  subtitle: string;
  /** Optional role pill badge. */
  roleBadge?: string;
  colorHex?: string;
  connected?: boolean;
  searchTerms: string[];
}

export const buildMentionCandidates = ({
  roster,
  isSolo,
  language,
}: {
  roster: readonly MentionBotInput[];
  isSolo: boolean;
  language: ChatLanguage;
}): MentionCandidate[] => {
  const ux = CHAT_UX_COPY[language];
  const candidates: MentionCandidate[] = [];

  if (!isSolo && roster.some((bot) => !bot.locked)) {
    candidates.push({
      id: RESUME_ALL,
      kind: 'all',
      handle: 'all',
      label: '@all',
      subtitle: ux.mentionAllSubtitle,
      roleBadge: ux.mentionAllBadge,
      searchTerms: ['all', 'everyone', 'tat ca', 'tất cả', 'ca phong', 'cả phòng', 'group', 'nhom'],
    });
  }

  for (const bot of roster) {
    if (bot.locked) continue;
    const withoutArticle = bot.name.replace(/^(the|a|an)\s+/i, '').trim();
    const metaParts = [bot.modelLabel, bot.providerLabel].filter(Boolean);
    candidates.push({
      id: bot.id,
      kind: 'bot',
      handle: bot.name,
      label: bot.name,
      subtitle: metaParts.join(' · ') || bot.archetype || '',
      roleBadge: bot.archetype,
      colorHex: bot.colorHex,
      connected: bot.connected,
      searchTerms: [
        bot.name,
        withoutArticle,
        bot.archetype ?? '',
        bot.providerLabel ?? '',
        bot.modelLabel ?? '',
      ].filter(Boolean),
    });
  }

  candidates.push({
    id: USER_HANDLE,
    kind: 'user',
    handle: USER_HANDLE,
    label: '@user',
    subtitle: ux.mentionUserSubtitle,
    roleBadge: ux.mentionUserBadge,
    searchTerms: ['user', 'you', 'me', 'human', 'ban', 'bạn', 'nguoi dung', 'người dùng', 'toi', 'tôi'],
  });

  return candidates;
};

export const filterMentionCandidates = (
  candidates: readonly MentionCandidate[],
  query: string
): MentionCandidate[] => {
  const normQuery = normalizeMentionSearch(query);
  const compactQuery = compactMentionKey(query);
  if (!normQuery && !compactQuery) return [...candidates];

  const scored: { candidate: MentionCandidate; score: number; order: number }[] = [];

  candidates.forEach((candidate, order) => {
    const normHandle = normalizeMentionSearch(candidate.handle);
    const compactHandle = compactMentionKey(candidate.handle);
    const handleWords = normHandle.split(' ').filter(Boolean);
    const allNormTerms = candidate.searchTerms.map(normalizeMentionSearch);
    const allCompactTerms = candidate.searchTerms.map(compactMentionKey);

    let score = 0;
    if (normHandle === normQuery || (compactQuery && compactHandle === compactQuery)) {
      score = 100;
    } else if (normHandle.startsWith(normQuery) || (compactQuery && compactHandle.startsWith(compactQuery))) {
      score = 90;
    } else if (handleWords.some((word) => word.startsWith(normQuery))) {
      score = 80;
    } else if (
      allNormTerms.some((term) => term.startsWith(normQuery)) ||
      (compactQuery && allCompactTerms.some((term) => term.startsWith(compactQuery)))
    ) {
      score = 70;
    } else if (
      normHandle.includes(normQuery) ||
      (compactQuery && compactHandle.includes(compactQuery))
    ) {
      score = 60;
    } else if (
      allNormTerms.some((term) => term.includes(normQuery)) ||
      (compactQuery && allCompactTerms.some((term) => term.includes(compactQuery)))
    ) {
      score = 50;
    }

    if (score > 0) {
      scored.push({ candidate, score, order });
    }
  });

  scored.sort((left, right) => right.score - left.score || left.order - right.order);
  return scored.map((entry) => entry.candidate);
};

/**
 * Replaces the active `@query` range with `@${handle} ` and returns the updated text
 * and next caret index without duplicating adjacent trailing spaces.
 */
export const applyMentionReplacement = (
  text: string,
  range: { start: number; end: number },
  handle: string
): { text: string; cursor: number } => {
  const safeStart = Math.max(0, Math.min(range.start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(range.end, text.length));
  const before = text.slice(0, safeStart);
  const after = text.slice(safeEnd);
  const inserted = `@${handle} `;
  const trimmedAfter = after.startsWith(' ') ? after.slice(1) : after;
  const nextText = `${before}${inserted}${trimmedAfter}`;
  return {
    text: nextText,
    cursor: before.length + inserted.length,
  };
};

/**
 * Invoked when tapping the '@' toolbar button:
 * - If the caret is already right after a bare '@', removes that '@' (toggle close).
 * - If inside an active '@query', keeps text and leaves menu open.
 * - Otherwise inserts '@' (with a leading space when needed) and places the caret after '@'.
 */
export const triggerMentionAtCursor = (
  text: string,
  cursor: number
): { text: string; cursor: number; toggledClosed: boolean } => {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const active = detectMentionQuery(text, safeCursor);
  if (active) {
    if (active.query === '') {
      const removeStart =
        active.start > 0 && text[active.start - 1] === ' ' && (active.start === 1 || /\s/.test(text[active.start - 2] ?? ''))
          ? active.start
          : active.start;
      const nextText = text.slice(0, removeStart) + text.slice(active.end);
      return { text: nextText, cursor: removeStart, toggledClosed: true };
    }
    return { text, cursor: safeCursor, toggledClosed: false };
  }

  const before = text.slice(0, safeCursor);
  const after = text.slice(safeCursor);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const insert = needsLeadingSpace ? ' @' : '@';
  const nextText = `${before}${insert}${after}`;
  return {
    text: nextText,
    cursor: before.length + insert.length,
    toggledClosed: false,
  };
};

export type MentionTokenKind = 'text' | 'all' | 'user' | 'bot';

export interface MentionTokenSegment {
  kind: MentionTokenKind;
  text: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tokenizes a rendered chat message body into plain text and inline @mention pills
 * (`@BotName`, `@all`, `@everyone`, `@user`, `@you`), avoiding false matches inside emails.
 */
export const tokenizeMentions = (
  body: string,
  botNames: readonly string[] = []
): MentionTokenSegment[] => {
  if (!body) return [];

  const nameVariants = botNames
    .flatMap((name) => {
      const trimmed = name.trim();
      const withoutArticle = trimmed.replace(/^(the|a|an)\s+/i, '').trim();
      return [trimmed, withoutArticle];
    })
    .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);

  const branches = [
    ...nameVariants,
    'everyone',
    'all',
    'user',
    'you',
    '[\p{L}\p{N}][\p{L}\p{N}_-]*',
  ];

  const pattern = new RegExp(`(@(?:${branches.join('|')}))`, 'giu');
  const segments: MentionTokenSegment[] = [];
  let cursor = 0;

  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    const token = match[0];

    // Guard against matching inside email addresses or mid-word handles (e.g., dev@zerocouncil.local).
    if (index > 0 && /[\p{L}\p{N}._%+-]/u.test(body[index - 1])) {
      continue;
    }

    if (index > cursor) {
      segments.push({ kind: 'text', text: body.slice(cursor, index) });
    }

    const rawHandle = token.slice(1).trim();
    const norm = compactMentionKey(rawHandle);
    let kind: MentionTokenKind = 'bot';
    if (norm === 'all' || norm === 'everyone') {
      kind = 'all';
    } else if (norm === 'user' || norm === 'you') {
      kind = 'user';
    }

    segments.push({ kind, text: token });
    cursor = index + token.length;
  }

  if (cursor < body.length) {
    segments.push({ kind: 'text', text: body.slice(cursor) });
  }

  return segments;
};
