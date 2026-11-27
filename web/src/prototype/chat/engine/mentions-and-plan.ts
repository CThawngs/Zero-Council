/**
 * Roster validation, diacritic-insensitive `@mention` resolution, context windowing, and speaker
 * order planning for the Zero Council chat engine.
 */

import {
  CONTEXT_MAX_CHARS,
  CONTEXT_MAX_MESSAGES,
  CONTEXT_SINGLE_EXCERPT,
  RESUME_ALIASES,
  RESUME_ALL,
  USER_ALIASES,
  USER_HANDLE,
  type ChatBot,
  type ChatMessage,
  type RunTurnInput,
} from './types.ts';

/** Validates a turn request before any provider call is attempted. */
export const rosterProblems = (request: {
  prompt: string;
  advisorIds: readonly string[];
  attachments?: readonly { id: string; kind: string; name: string; href: string }[];
  roundIndex: number;
}): string[] => {
  const problems: string[] = [];
  if (typeof request.prompt !== 'string' || !request.prompt.trim()) {
    problems.push('prompt is empty');
  }
  const ids = request.advisorIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    problems.push('no advisors to ask');
  } else {
    if (ids.some((id) => typeof id !== 'string' || !id.trim())) problems.push('advisor id is empty');
    if (new Set(ids).size !== ids.length) problems.push('advisor ids repeat');
  }
  if (!Number.isInteger(request.roundIndex) || request.roundIndex < 1) {
    problems.push(`round index ${String(request.roundIndex)} is not a whole round`);
  }
  const attachments = request.attachments ?? [];
  if (!Array.isArray(attachments)) {
    problems.push('attachments is not a list');
  } else {
    attachments.forEach((attachment, index) => {
      if (!attachment?.id?.trim()) problems.push(`attachment ${index + 1} has no id`);
      if (!attachment?.name?.trim()) problems.push(`attachment ${index + 1} has no name`);
      if (!attachment?.href?.trim()) problems.push(`attachment ${index + 1} has nothing to open`);
    });
  }
  return problems;
};

/**
 * Strips diacritics and non-alphanumeric characters so `@The Pragmatist`, `@the-pragmatist`,
 * and Vietnamese accented names resolve consistently.
 */
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const STOP_WORDS = ['stop', 'halt', 'pause', 'dung', 'ngung', 'dừng', 'ngừng', 'tạm dừng'];

const aliasesOf = (bot: ChatBot): string[] => {
  const words = bot.name.split(/\s+/).filter(Boolean);
  const withoutArticle = /^(the|a|an)\s+/i.test(bot.name) ? words.slice(1) : words;
  const candidates = [normalize(bot.name), normalize(withoutArticle.join(' ')), ...withoutArticle.map(normalize)];
  return candidates.filter((alias, index) => alias && candidates.indexOf(alias) === index);
};

export interface MentionHit {
  id: string;
  /** Index just past the consumed mention, so callers can inspect adjacent directive words. */
  end: number;
}

/** Builds the normalized alias-to-bot-id lookup map for a room roster. */
export const aliasTable = (roster: ChatBot[]): Map<string, string> => {
  const byAlias = new Map<string, string>();
  for (const bot of roster) {
    for (const alias of aliasesOf(bot)) if (!byAlias.has(alias)) byAlias.set(alias, bot.id);
  }
  for (const alias of USER_ALIASES) {
    const key = normalize(alias);
    if (!byAlias.has(key)) byAlias.set(key, USER_HANDLE);
  }
  for (const alias of RESUME_ALIASES) byAlias.set(normalize(alias), RESUME_ALL);
  return byAlias;
};

/** Resolves every `@` mention with its end offset in `body`. */
export const findMentions = (body: string, byAlias: Map<string, string>): MentionHit[] => {
  const hits: MentionHit[] = [];
  const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;
  for (const at of body.matchAll(/@/gu)) {
    const start = (at.index ?? 0) + 1;
    const words = [...body.slice(start).matchAll(wordPattern)].slice(0, 3).map((match) => match[0]);
    for (let width = words.length; width >= 1; width -= 1) {
      const id = byAlias.get(normalize(words.slice(0, width).join(' ')));
      if (id) {
        hits.push({ id, end: start + words.slice(0, width).join(' ').length });
        break;
      }
    }
  }
  return hits;
};

export const dedupe = (ids: string[]): string[] => ids.filter((id, index, all) => all.indexOf(id) === index);

export const parseMentions = (body: string, roster: ChatBot[]): string[] =>
  dedupe(findMentions(body, aliasTable(roster)).map((hit) => hit.id));

/**
 * True when the user placed a stop word directly beside a mention (`stop @bot`, `@bot stop`,
 * `dừng @bot`). Mid-sentence prose ("@bot please stop now") is treated as a message, not a hold.
 */
export const isStopDirective = (body: string, roster: ChatBot[]): boolean => {
  const byAlias = aliasTable(roster);
  const hits = findMentions(body, byAlias).filter((hit) => hit.id !== USER_HANDLE && hit.id !== RESUME_ALL);
  if (hits.length === 0) return false;
  return hits.some((hit) => {
    const before = body.slice(0, body.lastIndexOf('@', hit.end - 1));
    return STOP_WORDS.some((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return (
        new RegExp(`${escaped}\\s*$`, 'iu').test(before) ||
        new RegExp(`^\\s*${escaped}\\b`, 'iu').test(body.slice(hit.end))
      );
    });
  });
};

/** `@all` / `@everyone` brings held advisors back into the active roster. */
export const isResumeDirective = (body: string, roster: ChatBot[]): boolean =>
  parseMentions(body, roster).includes(RESUME_ALL);

/**
 * Trims the transcript to the context budget, preserving recent messages whole and excerpting
 * oversized messages rather than silently dropping them.
 */
export const buildContext = (
  history: ChatMessage[],
  { maxMessages = CONTEXT_MAX_MESSAGES, maxChars = CONTEXT_MAX_CHARS } = {}
): ChatMessage[] => {
  const recent: ChatMessage[] = [];
  let used = 0;
  for (let index = history.length - 1; index >= 0 && recent.length < maxMessages; index -= 1) {
    const message = history[index];
    const size = message.body.length;
    if (size > maxChars) {
      recent.unshift({ ...message, body: message.body.slice(0, CONTEXT_SINGLE_EXCERPT) });
      used += CONTEXT_SINGLE_EXCERPT;
      continue;
    }
    if (used + size > maxChars && recent.length > 0) break;
    used += size;
    recent.unshift(message);
  }
  return recent;
};

/**
 * Computes which advisors speak for this user message and in what order:
 * - `panel` (Independent): everyone in join order, closing on the final speaker.
 * - `round-robin` (Debate): named `@mention`s first, else round-robin from the last speaker.
 */
export const planSpeakers = ({
  roster,
  mode,
  history,
  userMessage,
}: Pick<RunTurnInput, 'roster' | 'mode' | 'history' | 'userMessage'>): { speakers: ChatBot[]; closes: boolean } => {
  if (roster.length === 0) return { speakers: [], closes: false };

  const hasAll = userMessage.mentioned.includes(RESUME_ALL);
  const mentioned = userMessage.mentioned.filter((id) => id !== USER_HANDLE && id !== RESUME_ALL);
  if (mode === 'panel') return { speakers: [...roster], closes: true };

  if (hasAll) {
    const namedFirst = mentioned
      .map((id) => roster.find((bot) => bot.id === id))
      .filter((bot): bot is ChatBot => Boolean(bot));
    const remaining = roster.filter((bot) => !namedFirst.some((n) => n.id === bot.id));
    return {
      speakers: [...namedFirst, ...remaining],
      closes: false,
    };
  }

  if (mentioned.length > 0) {
    return {
      speakers: mentioned.map((id) => roster.find((bot) => bot.id === id)).filter((bot): bot is ChatBot => Boolean(bot)),
      closes: false,
    };
  }

  const lastBotTurn = [...history].reverse().find((message) => message.authorId !== USER_HANDLE);
  const start = lastBotTurn ? (roster.findIndex((bot) => bot.id === lastBotTurn.authorId) + 1) % roster.length : 0;
  return {
    speakers: [...roster.slice(start), ...roster.slice(0, start)],
    closes: false,
  };
};
