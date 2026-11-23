import type { BotGenerator, BotTurn, ChatBot, ChatTurnRequest } from './engine.ts';
import { SILENT_TOKEN, USER_HANDLE } from './engine.ts';

/**
 * Offline preview generator that needs no model and no network.
 *
 * Exercises the exact structured `BotTurn.handoffs` routing rules end-to-end and keeps
 * preview replies 100% localized in both English ('en') and Vietnamese ('vi').
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

    const { bot, history, waiting, handoffTargets, isClosing, language, mode } = request;
    const opener = OPENERS[language](lensOf(bot));
    // Scope peer lookup to the current round (messages after the latest user turn) so debate
    // prefixes reference the advisor who just spoke rather than someone from an earlier round.
    const lastUserIndex = history.map((message) => message.authorId).lastIndexOf(USER_HANDLE);
    const lastUser = lastUserIndex >= 0 ? history[lastUserIndex] : undefined;
    const echo = lastUser ? `On "${lastUser.body.slice(0, 120)}" — ` : '';
    const lastBotInRound =
      lastUserIndex >= 0
        ? [...history.slice(lastUserIndex + 1)].reverse().find((message) => message.authorId !== USER_HANDLE)
        : undefined;
    const prevName = displayName(roster, lastBotInRound?.authorId ?? null);

    // Independent (`panel`): never hand off or mention peers, and only append `@user` on the final
    // advisor (`isClosing`) so `runTurn` lets every seated advisor finish their turn.
    if (mode === 'panel') {
      const body = `${echo}${opener}`;
      return {
        text: isClosing ? `${body} ${CLOSERS[language]} @${USER_HANDLE}` : body,
        handoffs: [],
      };
    }

    const debatePrefix = prevName
      ? language === 'vi'
        ? `Phản biện lại góc nhìn của ${prevName}, `
        : `Countering ${prevName}'s angle, `
      : '';

    // `waiting` first (the round's own order), then anyone the engine will still accept a handoff to —
    // which is what lets two scripted advisors keep passing the floor back and forth.
    const next = waiting[0] ?? handoffTargets?.[0] ?? null;
    const nextName = displayName(roster, next?.id ?? null);

    // Closing hands back to the user: no handoff, and the prose names them so the UI can mark it.
    if (isClosing || !nextName) {
      return { text: `${echo}${debatePrefix}${opener} ${CLOSERS[language]} @${USER_HANDLE}`, handoffs: [] };
    }
    // A STRUCTURED handoff. The `@name` in the prose is display only — the engine routes on the id.
    return {
      text: `${echo}${debatePrefix}${opener} @${nextName}, this is your side of it.`,
      handoffs: [next.id],
    };
  };
