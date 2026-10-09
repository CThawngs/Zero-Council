/**
 * The council conversation loop — the foundation of this product.
 *
 * Everything here is pure and synchronous except `runTurn`, which awaits a caller-supplied
 * generator. Nothing touches React, storage, or the network: the UI drives it and the tests drive
 * it through the same entry point.
 *
 * THE ONE THING NOT TO BREAK
 * --------------------------
 * Bot-to-bot handoff is a STRUCTURED field (`BotTurn.handoffs`), never a regex over prose.
 * Parsing "@name" out of a bot's free text looks like it works — it does, against a scripted
 * generator that obeys — and then breaks in production four ways: a quoted "@dreamer" in a code
 * block triggers a handoff; a quoted third word never resolves; a model that forgets the convention
 * produces silence instead of an error; and there is no way to distinguish addressing someone from
 * quoting them. `@` in user text IS parsed (that is the convention and the model composes it), but
 * it decides WHO OPENS, and even that degrades to round-robin rather than failing.
 *
 * `generate` is the only seam. The scripted provider satisfies it today; BYOK satisfies it later by
 * mapping its own tool call onto `handoffs`. Neither the routing rules nor their tests change.
 */

export const USER_HANDLE = 'user';

/** Announced as a single token so a pass is a decision, not an empty string. */
export const SILENT_TOKEN = '[SILENT]';

/** Mentions that address every held advisor at once, for a resume. */
export const RESUME_ALIASES = ['all', 'everyone'];

/** Context window per advisor turn, matching the Hermes budget rather than an unbounded transcript. */
export const CONTEXT_MAX_MESSAGES = 200;
export const CONTEXT_MAX_CHARS = 32_000;
export const CONTEXT_SINGLE_EXCERPT = 8_000;

/**
 * How many advisor turns one user message may buy before the room parks itself.
 *
 * Not a suggestion: an unbounded chain of model calls is the one failure mode in this design that
 * costs money and cannot be undone. Raise it only alongside real billing, never by deleting it.
 */
export const DEFAULT_MAX_TURNS = 12;

/** Total advisor turns for the whole room, independent of how many messages the user sends. */
export const DEFAULT_ROOM_BUDGET = 200;

export type ChatMode = 'round-robin' | 'panel';

export interface ChatBot {
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  /** `USER_HANDLE` or a bot id. */
  authorId: string;
  body: string;
  /** Ids resolved from `@` in the body — display and "who opens" only, never bot-to-bot routing. */
  mentioned: string[];
}

/** What one advisor produced. Routing is this shape; the prose is incidental. */
export interface BotTurn {
  /** Shown in the room. A silent turn is not shown at all. */
  text: string;
  /** Advisor ids this turn hands the floor to. Structured, so it cannot be spoofed by prose. */
  handoffs: string[];
  /** The advisor deliberately passes. Distinct from "returned nothing", which is a failure. */
  silent?: boolean;
}

export type WhyStop = 'user' | 'silent' | 'max-turns' | 'budget' | 'failed';

/** Why a turn produced nothing. Typed so the UI can say something true instead of "error". */
export type TurnFailure =
  | { kind: 'silent'; messageId: string }
  | { kind: 'timeout'; after: number }
  | { kind: 'transient'; detail: string }
  | { kind: 'fatal'; detail: string };

export interface ChatTurnRequest {
  bot: ChatBot;
  /** Everything said before this turn, already trimmed to the context budget. */
  history: ChatMessage[];
  /** Advisors still queued this round. The generator may address any of them. */
  waiting: ChatBot[];
  /** True when this is the last scheduled turn: the advisor is expected to close back to the user. */
  isClosing: boolean;
  /** The user's words this round, for adapters that build a separate instruction block. */
  prompt: string;
  language: 'en' | 'vi';
}

export type BotGenerator = (request: ChatTurnRequest) => Promise<BotTurn> | BotTurn;

export interface RunTurnInput {
  roster: ChatBot[];
  mode: ChatMode;
  /** Transcript before this user message. `runTurn` appends `userMessage` itself. */
  history: ChatMessage[];
  userMessage: ChatMessage;
  generate: BotGenerator;
  maxTurns?: number;
  roomBudget?: number;
  language?: 'en' | 'vi';
  /** Advisors already spent in this room; drives the `budget` stop reason. */
  turnsUsed?: number;
}

export interface RunTurnResult {
  messages: ChatMessage[];
  stoppedBy: WhyStop;
  /** Advisor ids that spoke or passed, in order. */
  speakers: string[];
  /** Surfaced to the room instead of being swallowed, so a dead advisor is visibly dead. */
  failures: TurnFailure[];
}

/**
 * Strips diacritics and every non-alphanumeric character so `@The Pragmatist`, `@the-pragmatist`
 * and `@pragmatist` all reach the same advisor. Vietnamese names would otherwise need three
 * spellings from the user.
 */
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** `stop @bot` holds that bot; the same word in the middle of a sentence is just prose. */
const STOP_WORDS = ['stop', 'halt', 'pause', 'dung', 'ngung', 'dừng', 'ngừng', 'tạm dừng'];

/** Normalized aliases per bot: full name, name without a leading article, and each word. */
const aliasesOf = (bot: ChatBot): string[] => {
  const words = bot.name.split(/\s+/).filter(Boolean);
  const withoutArticle = /^(the|a|an)\s+/i.test(bot.name) ? words.slice(1) : words;
  const candidates = [normalize(bot.name), normalize(withoutArticle.join(' ')), ...withoutArticle.map(normalize)];
  return candidates.filter((alias, index) => alias && candidates.indexOf(alias) === index);
};

interface MentionHit {
  id: string;
  /** Index just past the consumed mention, so the caller can read what follows it. */
  end: number;
}

/** Builds the alias table once per call site pass — cheap, and keeps the resolver a pure function. */
const aliasTable = (roster: ChatBot[]): Map<string, string> => {
  const byAlias = new Map<string, string>();
  for (const bot of roster) {
    for (const alias of aliasesOf(bot)) if (!byAlias.has(alias)) byAlias.set(alias, bot.id);
  }
  byAlias.set(normalize(USER_HANDLE), USER_HANDLE);
  for (const alias of RESUME_ALIASES) byAlias.set(normalize(alias), RESUME_ALL);
  return byAlias;
};

/** Sentinel id for `@all` / `@every` — never a real advisor. */
export const RESUME_ALL = '__all__';

/** Resolves every `@` mention with its end offset. `parseMentions` is this without the offsets. */
const findMentions = (body: string, byAlias: Map<string, string>): MentionHit[] => {
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

const dedupe = (ids: string[]): string[] => ids.filter((id, index, all) => all.indexOf(id) === index);

export const parseMentions = (body: string, roster: ChatBot[]): string[] =>
  dedupe(findMentions(body, aliasTable(roster)).map((hit) => hit.id));

/**
 * True when the user put a stop word directly beside a mention — `stop @bot`, `@bot stop`,
 * `dừng @bot`. The same word further into the sentence is prose: "@bot please just stop now" is a
 * message TO that bot, not a command about it, so it must not silence the advisor.
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

/** `@all` puts every held advisor back in the room. */
export const isResumeDirective = (body: string, roster: ChatBot[]): boolean =>
  parseMentions(body, roster).includes(RESUME_ALL);

/**
 * Trims the transcript to the context budget. Keeps the most recent messages whole, then spends the
 * remaining budget on one older excerpt so a compacted history still carries the original question.
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
    // Oversized messages are excerpted, never dropped. This check must come FIRST: a message that
    // cannot fit also fails the budget test below, and testing the budget first silently discarded
    // the one message that was too big to fit.
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
 * Which advisors speak for this user message, in order.
 *
 * `round-robin`: a mentioned advisor goes first and nobody else joins this round; with no mention
 * the roster speaks in join order starting from whoever spoke last time. `panel`: the whole roster
 * answers in join order and the last one is told to close.
 */
export const planSpeakers = ({
  roster,
  mode,
  history,
  userMessage,
}: Pick<RunTurnInput, 'roster' | 'mode' | 'history' | 'userMessage'>): { speakers: ChatBot[]; closes: boolean } => {
  if (roster.length === 0) return { speakers: [], closes: false };

  const mentioned = userMessage.mentioned.filter((id) => id !== USER_HANDLE && id !== RESUME_ALL);
  if (mode === 'panel') return { speakers: [...roster], closes: true };

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

const isTransient = (error: unknown): boolean => {
  const detail = error instanceof Error ? error.message : String(error);
  return /\b(429|5\d\d|timeout|timed out|overloaded|rate limit|ECONNRESET|EAI_AGAIN)\b/i.test(detail);
};

/**
 * Runs one user message through the council.
 *
 * A turn that hands off enqueues the named advisor even when the round did not schedule them — that
 * is the whole point of A2A. A turn that mentions the user closes the round. A silent round, the
 * turn cap, and the room budget each park the loop with a reason the UI can show.
 *
 * A generator that throws is retried exactly once and only when the failure looks transient;
 * anything else is surfaced as a typed failure rather than silently swallowed.
 */
export const runTurn = async ({
  roster,
  mode,
  history,
  userMessage,
  generate,
  maxTurns = DEFAULT_MAX_TURNS,
  roomBudget = DEFAULT_ROOM_BUDGET,
  language = 'en',
  turnsUsed = 0,
}: RunTurnInput): Promise<RunTurnResult> => {
  const messages = [...history, userMessage];
  const { speakers } = planSpeakers({ roster, mode, history, userMessage });

  // A queue rather than an index into `speakers`: an advisor pulled in by a handoff is not
  // necessarily one this round had scheduled, and dropping that reply would lose the A2A handoff.
  const queue = [...speakers];
  const failures: TurnFailure[] = [];
  const spoken: string[] = [];
  let produced = 0;
  let stoppedBy: WhyStop = 'max-turns';

  while (queue.length > 0) {
    if (spoken.length >= maxTurns) {
      stoppedBy = 'max-turns';
      break;
    }
    if (turnsUsed + spoken.length >= roomBudget) {
      stoppedBy = 'budget';
      break;
    }

    const bot = queue.shift() as ChatBot;
    const isClosing = mode === 'panel' && queue.length === 0;
    const request: ChatTurnRequest = {
      bot,
      history: buildContext(messages),
      waiting: [...queue],
      isClosing,
      prompt: userMessage.body,
      language,
    };

    let turn: BotTurn | null = null;
    try {
      turn = await generate(request);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (isTransient(error)) {
        try {
          turn = await generate(request);
        } catch (retry) {
          failures.push({ kind: 'transient', detail: retry instanceof Error ? retry.message : String(retry) });
          stoppedBy = 'failed';
          break;
        }
      } else {
        failures.push({ kind: 'fatal', detail });
        stoppedBy = 'failed';
        break;
      }
    }

    if (!turn) break;

    if (turn.silent || turn.text.trim() === SILENT_TOKEN || !turn.text.trim()) {
      // A pass is a decision: it consumes a turn and adds nobody to the transcript, but the
      // scheduled advisor still gave up their place. The round is not judged until the queue
      // drains, so one silent advisor does not cut off the advisors behind them.
      spoken.push(bot.id);
      continue;
    }
    messages.push({ id: `${messages.length}`, authorId: bot.id, body: turn.text.trim(), mentioned: [] });
    spoken.push(bot.id);
    produced += 1;

    for (const id of dedupe(turn.handoffs)) {
      if (id === bot.id || id === USER_HANDLE || spoken.includes(id)) continue;
      const target = roster.find((other) => other.id === id);
      if (target && !queue.some((waiting) => waiting.id === id)) queue.push(target);
    }

    if (parseMentions(turn.text, roster).includes(USER_HANDLE)) {
      stoppedBy = 'user';
      break;
    }
  }

  // A drained queue with nothing in it means the whole round passed. That is a distinct outcome
  // from "answered the user", and the UI must be able to tell the user that nobody replied.
  if (queue.length === 0 && stoppedBy === 'max-turns') stoppedBy = produced === 0 ? 'silent' : 'user';
  return { messages, stoppedBy, speakers: spoken, failures };
};

export { aliasTable, findMentions };