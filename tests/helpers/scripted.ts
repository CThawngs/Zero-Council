import type {
  BotGenerator,
  BotTurn,
  ChatBot,
  ChatTurnRequest,
} from '../../web/src/prototype/chat/engine.ts';
import { SILENT_TOKEN, USER_HANDLE } from '../../web/src/prototype/chat/engine.ts';

/**
 * Test-only deterministic generator for exercising structured `BotTurn.handoffs` routing
 * and bilingual ('en' | 'vi') turn mechanics without network calls.
 */

const DEFAULT_LENS = {
  en: 'the decision at hand',
  vi: 'quyết định đang bàn',
} as const;

const ECHO_PREFIX = {
  en: (snippet: string) => `On "${snippet}" — `,
  vi: (snippet: string) => `Về "${snippet}" — `,
} as const;

const OPENERS = {
  en: (lens: string) => `From my lens — ${lens} — here is what I would hold the council to.`,
  vi: (lens: string) => `Từ góc nhìn của tôi — ${lens} — đây là điều tôi muốn hội đồng giữ lại.`,
} as const;

const HANDOFF_LINES = {
  en: (nextName: string) => `@${nextName}, this is your side of it.`,
  vi: (nextName: string) => `@${nextName}, góc nhìn của bạn về điểm này thế nào?`,
} as const;

const CLOSERS = {
  en: 'What would change your read on this?',
  vi: 'Bạn nghĩ sao về điều đó?',
} as const;

export interface ScriptedOptions {
  /** Stance text per advisor, used as the visible lens in the reply. */
  lensOf?: (bot: ChatBot) => string;
  /** Return true to pass instead of answering. This is how a silent room settles on demand. */
  alwaysSilent?: (request: ChatTurnRequest) => boolean;
}

const displayName = (roster: ChatBot[], id: string | null): string | null =>
  id ? roster.find((bot) => bot.id === id)?.name ?? null : null;

/** Builds a generator bound to a roster, so it can hand off to a real advisor id. */
export const scriptedGenerator =
  (
    roster: ChatBot[],
    { lensOf, alwaysSilent }: ScriptedOptions = {}
  ): BotGenerator =>
  (request: ChatTurnRequest): BotTurn => {
    if (alwaysSilent?.(request)) return { text: SILENT_TOKEN, handoffs: [], silent: true };

    const { bot, history, waiting, handoffTargets, isClosing, mode } = request;
    const lang = request.language === 'vi' ? 'vi' : 'en';
    const rawLens = lensOf?.(bot)?.trim() ?? '';
    const resolvedLens = rawLens || DEFAULT_LENS[lang];
    const opener = OPENERS[lang](resolvedLens);
    const lastUserIndex = history.map((message) => message.authorId).lastIndexOf(USER_HANDLE);
    const lastUser = lastUserIndex >= 0 ? history[lastUserIndex] : undefined;
    const echo = lastUser ? ECHO_PREFIX[lang](lastUser.body.slice(0, 120)) : '';
    const lastBotInRound =
      lastUserIndex >= 0
        ? [...history.slice(lastUserIndex + 1)].reverse().find((message) => message.authorId !== USER_HANDLE)
        : undefined;
    const prevName = displayName(roster, lastBotInRound?.authorId ?? null);

    if (mode === 'panel') {
      const body = `${echo}${opener}`;
      return {
        text: isClosing ? `${body} ${CLOSERS[lang]} @${USER_HANDLE}` : body,
        handoffs: [],
      };
    }

    const debatePrefix = prevName
      ? lang === 'vi'
        ? `Phản biện lại góc nhìn của ${prevName}, `
        : `Countering ${prevName}'s angle, `
      : '';

    const next = waiting[0] ?? handoffTargets?.[0] ?? null;
    const nextName = displayName(roster, next?.id ?? null);

    if (isClosing || !nextName) {
      return { text: `${echo}${debatePrefix}${opener} ${CLOSERS[lang]} @${USER_HANDLE}`, handoffs: [] };
    }
    return {
      text: `${echo}${debatePrefix}${opener} ${HANDOFF_LINES[lang](nextName)}`,
      handoffs: [next.id],
    };
  };
