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

    const { bot, history, waiting, handoffTargets, isClosing } = request;
    const lang = request.language === 'vi' ? 'vi' : 'en';
    const rawLens = lensOf?.(bot)?.trim() ?? '';
    const resolvedLens = rawLens || DEFAULT_LENS[lang];
    const opener = OPENERS[lang](resolvedLens);
    const lastUser = [...history].reverse().find((message) => message.authorId === USER_HANDLE);
    const echo = lastUser ? ECHO_PREFIX[lang](lastUser.body.slice(0, 120)) : '';
    // `waiting` first (the round's own order), then anyone the engine will still accept a handoff to —
    // which is what lets two scripted advisors keep passing the floor back and forth.
    const next = waiting[0] ?? handoffTargets?.[0] ?? null;
    const nextName = displayName(roster, next?.id ?? null);

    // Closing hands back to the user: no handoff, and the prose names them so the UI can mark it.
    if (isClosing || !nextName) {
      return { text: `${echo}${opener} ${CLOSERS[lang]} @${USER_HANDLE}`, handoffs: [] };
    }
    // A STRUCTURED handoff. The `@name` in the prose is display only — the engine routes on the id.
    return {
      text: `${echo}${opener} ${HANDOFF_LINES[lang](nextName)}`,
      handoffs: [next.id],
    };
  };
