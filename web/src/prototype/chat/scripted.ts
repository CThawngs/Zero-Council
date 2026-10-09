import type { BotGenerator, BotTurn, ChatBot, ChatTurnRequest } from './engine.ts';
import { SILENT_TOKEN, USER_HANDLE } from './engine.ts';

/**
 * A generator that needs no model and no network.
 *
 * It exists so the routing rules can be exercised end to end — every turn returns a STRUCTURED
 * handoff, never a string for the engine to parse back out — and so the UI can be driven without a
 * key. When BYOK lands it replaces this one export: map the provider's tool call onto `BotTurn` and
 * `runTurn` does not change.
 */

const OPENERS = {
  en: (lens: string) => `From my lens — ${lens} — here is what I would hold the council to.`,
  vi: (lens: string) => `Từ góc nhìn của tôi — ${lens} — đây là điều tôi muốn hội đồng giữ lại.`,
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
    { lensOf = () => 'the decision at hand', alwaysSilent }: ScriptedOptions = {}
  ): BotGenerator =>
  (request: ChatTurnRequest): BotTurn => {
    if (alwaysSilent?.(request)) return { text: SILENT_TOKEN, handoffs: [], silent: true };

    const { bot, history, waiting, isClosing, language } = request;
    const opener = OPENERS[language](lensOf(bot));
    const lastUser = [...history].reverse().find((message) => message.authorId === USER_HANDLE);
    const echo = lastUser ? `On "${lastUser.body.slice(0, 120)}" — ` : '';
    const next = waiting[0] ?? null;
    const nextName = displayName(roster, next?.id ?? null);

    // Closing hands back to the user: no handoff, and the prose names them so the UI can mark it.
    if (isClosing || !nextName) {
      return { text: `${echo}${opener} ${CLOSERS[language]} @${USER_HANDLE}`, handoffs: [] };
    }
    // A STRUCTURED handoff. The `@name` in the prose is display only — the engine routes on the id.
    return {
      text: `${echo}${opener} @${nextName}, this is your side of it.`,
      handoffs: [next.id],
    };
  };