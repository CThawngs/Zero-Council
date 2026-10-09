/**
 * ============================================================================
 * DELEGATED — the one seam where a real deliberation engine drops in.
 * ============================================================================
 *
 * This file is the *contract*, not an engine. It owns the four guarantees any
 * provider has to keep, and nothing else:
 *
 *   1. a malformed request is refused before any work, so a bad call never
 *      reaches a paid provider
 *   2. every wait is bounded — the caller's cancel signal AND our own deadline
 *   3. a result that arrives after a cancel is discarded, not committed
 *   4. `onContribution` reports each advisor as it lands, in speaking order
 *
 * It deliberately imports nothing outside ./plan. That keeps it runnable under
 * plain `node --test`, which is what makes the guarantees above provable rather
 * than merely written down. The canned answers live in ./fixture because they
 * need the copy tables; swapping in a real engine means writing a producer and
 * changing one import in AppContext.
 *
 * The explicit `.ts` on that one import is what lets Node resolve it — ESM does
 * no extension guessing, and the alternative is an untestable contract.
 *
 * Same contract style as `authenticateFromSession` in lib/currentUser.ts.
 */

import { requestProblems, type CommunicationMode } from './plan.ts';

export type { CommunicationMode } from './plan.ts';

/** Owned here, not in the prototype types: the round records the language it was written in. */
export type Language = 'en' | 'vi';

export type AttachmentKind = 'image' | 'file' | 'link';

/**
 * Something the user pinned to their message, exactly like a Messenger
 * attachment. This is *transport only*: it says what was sent, never what is in
 * it. Reading the bytes — fetching a link, pulling text out of a PDF, looking at
 * an image — is the producer's job, because only the producer knows which
 * provider can be paid to do it.
 *
 * ponytail: `href` is whatever the UI can render. Today that is a blob URL for a
 * local pick, a storage path once uploads land. Swap it for a signed URL when a
 * real bucket exists; nothing else here has to change.
 */
export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** What the user sees: the filename, or the URL as typed. */
  name: string;
  href: string;
  mime?: string;
  bytes?: number;
}

export interface Contribution {
  advisorId: string;
  text: string;
  /** debate only — the advisor whose argument this one answers. */
  rebuts: string | null;
  /** chain only — the advisor whose output this one builds on. */
  buildsOn: string | null;
}

export interface Round {
  index: number;
  mode: CommunicationMode;
  prompt: string;
  /** What was pinned to this question. Carried, not read — see Attachment. */
  attachments: Attachment[];
  /** The language this round's answers were produced in. May differ from the UI language. */
  language: Language;
  contributions: Contribution[];
  chair: {
    summary: string;
    dissent: string;
    recommendation: string;
  };
}

/** What the engine knows at a point in time. Mirrors how a streaming engine reports. */
export interface RoundProgress {
  roundIndex: number;
  /** Contributed so far, in speaking order. */
  landed: Contribution[];
  /** Set only once the chair has spoken. */
  chair: Round['chair'] | null;
}

export interface DeliberationRequest {
  mode: CommunicationMode;
  prompt: string;
  language: Language;
  /** Every account that was added to *this* chat. Nobody outside this list is asked. */
  advisorIds: readonly string[];
  /** advisorId → stance, used to give each fixture voice its own colour. */
  advisorStances: Readonly<Record<string, string>>;
  /** Pinned to the message, passed through untouched. */
  attachments: readonly Attachment[];
  /** 1-based. A follow-up question becomes round 2, 3, … */
  roundIndex: number;
  signal?: AbortSignal;
  /** Called as each advisor lands, then once more when the chair has spoken. */
  onContribution?: (progress: RoundProgress) => void;
}

/** What a producer is handed: the request, plus the tools to stay inside the contract. */
export interface ProducerContext {
  signal: AbortSignal;
  /** Forwarded from the caller's `onContribution`. Call it as answers land. */
  report: (progress: RoundProgress) => void;
}

export type RoundProducer = (
  request: Omit<DeliberationRequest, 'signal' | 'onContribution'>,
  context: ProducerContext
) => Promise<Round>;

export class DeliberationCancelled extends Error {
  constructor() {
    super('DELIBERATION_CANCELLED');
    this.name = 'DeliberationCancelled';
  }
}

/** The request was refused before any work, or the engine ran out of time. */
export class DeliberationError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`DELIBERATION_FAILED:${problems.join('; ')}`);
    this.name = 'DeliberationError';
    this.problems = problems;
  }
}

/** ponytail: generous enough for a slow provider, short enough that a hang is visible. */
export const ENGINE_TIMEOUT_MS = 30_000;

/**
 * Resolves after `ms`, or rejects with the signal's reason if it aborts first.
 * The listener comes off on the success path too — a signal that outlives one
 * wait would otherwise hold every settled callback alive.
 */
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Folds the caller's cancel signal together with our own deadline, so a real
 * engine that stops responding becomes a visible error instead of a spinner
 * that never ends.
 */
const withDeadline = (signal: AbortSignal | undefined, timeoutMs: number) => {
  const controller = new AbortController();
  const forward = () => controller.abort(new DeliberationCancelled());
  const timer = setTimeout(
    () => controller.abort(new DeliberationError(['no answer within ' + String(timeoutMs) + 'ms'])),
    timeoutMs
  );
  // An already-aborted signal never fires a listener added afterwards, so a
  // cancel that landed before this call would otherwise be lost entirely.
  if (signal?.aborted) forward();
  else signal?.addEventListener('abort', forward, { once: true });
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
};

/**
 * Wraps a producer in the contract. This is the only thing the app calls.
 *
 * FIXME(engine): the app currently wires this to the fixture producer in
 * ./fixture. A real engine writes its own producer and changes one import —
 * no component moves, because every panel reads a `Round` and nothing else.
 */
export const createDeliberationEngine = (produce: RoundProducer, timeoutMs: number = ENGINE_TIMEOUT_MS) => {
  const runDeliberation = async (request: DeliberationRequest): Promise<Round> => {
    const problems = requestProblems(request);
    if (problems.length > 0) throw new DeliberationError(problems);

    const { signal, release } = withDeadline(request.signal, timeoutMs);
    try {
      // Spelled out rather than spread: a producer must never receive the
      // caller's signal or callback and mistake them for its own.
      const input = {
        mode: request.mode,
        prompt: request.prompt,
        language: request.language,
        advisorIds: request.advisorIds,
        advisorStances: request.advisorStances,
        attachments: request.attachments,
        roundIndex: request.roundIndex,
      };
      const round = await produce(input, {
        signal,
        report: (progress) => request.onContribution?.(progress),
      });
      // The caller may have cancelled while the producer was still working.
      // Returning anyway would commit a round the user already backed out of.
      if (signal.aborted) throw signal.reason;

      // Membership is the premise of the whole app: you added accounts to *this*
      // chat, so only those accounts may appear in its transcript. Only the
      // fixture builds rounds today, and it builds them from advisorIds, so this
      // cannot fire yet. The first real producer can — a model asked to speak for
      // three advisors may hand back a fourth voice nobody added to this chat,
      // and that answer would render in the thread like a member.
      //
      // Fail loudly rather than filtering it out. A silently dropped answer looks
      // like a bug nobody can find; this names the stray advisor and its id.
      const members = new Set(request.advisorIds);
      const outsiders = [
        ...new Set(round.contributions.map((c) => c.advisorId).filter((id) => !members.has(id))),
      ];
      if (outsiders.length > 0) {
        throw new DeliberationError(
          outsiders.map((id) => `advisor ${id} answered but is not in this chat`)
        );
      }

      return round;
    } finally {
      release();
    }
  };
  return runDeliberation;
};

/** A producer that answers one advisor per `stepMs`, then lets the chair close. */
export const pacedProducer =
  (build: (request: Omit<DeliberationRequest, 'signal' | 'onContribution'>) => Round, stepMs: number): RoundProducer =>
  async (request, context) => {
    const round = build(request);
    const landed: Contribution[] = [];
    for (const contribution of round.contributions) {
      await sleep(stepMs, context.signal);
      landed.push(contribution);
      context.report({ roundIndex: round.index, landed: [...landed], chair: null });
    }
    await sleep(stepMs, context.signal);
    context.report({ roundIndex: round.index, landed, chair: round.chair });
    return round;
  };
