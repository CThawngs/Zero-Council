/**
 * Zero Council multi-agent conversation loop (`runTurn`) and public engine barrel.
 *
 * Key invariant: bot-to-bot handoffs use the structured `BotTurn.handoffs` array, never regexes
 * over model prose. User `@` mentions are parsed only to select opening speakers (`planSpeakers`).
 * Submodules in `./engine/*` hold types, mention/speaker planning, and timeout/retry resilience.
 */

import {
  CONTEXT_MAX_CHARS,
  CONTEXT_MAX_MESSAGES,
  CONTEXT_SINGLE_EXCERPT,
  COUNCIL_ROUNDS,
  DEFAULT_MAX_TURNS,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_ROOM_BUDGET,
  DEFAULT_TURN_TIMEOUT_MS,
  RESUME_ALIASES,
  RESUME_ALL,
  SILENT_TOKEN,
  USER_ALIASES,
  USER_HANDLE,
  type AttachmentKind,
  type BotGenerator,
  type BotTurn,
  type ChatAttachment,
  type ChatBot,
  type ChatMessage,
  type ChatMode,
  type ChatTurnRequest,
  type RunTurnInput,
  type RunTurnResult,
  type TurnError,
  type TurnFailure,
  type TurnFailureReason,
  type WhyStop,
} from './engine/types.ts';
import {
  aliasTable,
  buildContext,
  dedupe,
  findMentions,
  isResumeDirective,
  isStopDirective,
  parseMentions,
  planSpeakers,
  rosterProblems,
} from './engine/mentions-and-plan.ts';
import {
  classifyTurnFailureReason,
  executeBoundedAttempt,
  isClientTimeoutError,
  isTransient,
  sleepWithJitterAndAbort,
} from './engine/resilience.ts';

export {
  CONTEXT_MAX_CHARS,
  CONTEXT_MAX_MESSAGES,
  CONTEXT_SINGLE_EXCERPT,
  COUNCIL_ROUNDS,
  DEFAULT_MAX_TURNS,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_ROOM_BUDGET,
  DEFAULT_TURN_TIMEOUT_MS,
  RESUME_ALIASES,
  RESUME_ALL,
  SILENT_TOKEN,
  USER_ALIASES,
  USER_HANDLE,
  aliasTable,
  buildContext,
  classifyTurnFailureReason,
  findMentions,
  isResumeDirective,
  isStopDirective,
  isTransient,
  parseMentions,
  planSpeakers,
  rosterProblems,
};

export type {
  AttachmentKind,
  BotGenerator,
  BotTurn,
  ChatAttachment,
  ChatBot,
  ChatMessage,
  ChatMode,
  ChatTurnRequest,
  RunTurnInput,
  RunTurnResult,
  TurnError,
  TurnFailure,
  TurnFailureReason,
  WhyStop,
};

/**
 * Runs one user message through the council queue.
 *
 * Structured peer handoffs enqueue the named advisor; `USER_HANDLE` closes the round; `[SILENT]`
 * passes cleanly without adding a bubble; transient upstream blips retry once with jitter; and
 * timeouts or cancellations abort the in-flight generator immediately.
 */
export const runTurn = async ({
  roster,
  mode,
  history,
  userMessage,
  generate,
  maxTurns = DEFAULT_MAX_TURNS,
  rounds = 1,
  roomBudget = DEFAULT_ROOM_BUDGET,
  language = 'en',
  turnsUsed = 0,
  roundIndex = 1,
  signal,
  onTurn,
  turnTimeoutMs = DEFAULT_TURN_TIMEOUT_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  soloMode = false,
}: RunTurnInput): Promise<RunTurnResult> => {
  const messages = [...history, userMessage];

  const problems = rosterProblems({
    prompt: userMessage.body,
    advisorIds: roster.map((bot) => bot.id),
    attachments: userMessage.attachments ?? [],
    roundIndex,
  });
  if (problems.length > 0) {
    return {
      messages,
      stoppedBy: 'failed',
      speakers: [],
      failures: problems.map((detail) => ({ kind: 'fatal' as const, detail })),
    };
  }

  const { speakers } = planSpeakers({ roster, mode, history, userMessage });
  const queue = [...speakers];
  const effectiveRounds = soloMode || mode === 'panel' ? 1 : Math.max(1, Math.floor(rounds));
  const turnsBy = new Map<string, number>();
  const countTurn = (id: string) => turnsBy.set(id, (turnsBy.get(id) ?? 0) + 1);
  const turnBudget = Math.min(maxTurns, roster.length * effectiveRounds, roomBudget - turnsUsed);
  const failures: TurnFailure[] = [];
  const spoken: string[] = [];
  let produced = 0;
  let stoppedBy: WhyStop = 'max-turns';
  let failureReason: TurnFailureReason | undefined;
  let turnError: TurnError | undefined;

  const recordTurnError = (botId: string, detail: string, isTimeout = false) => {
    const reason = classifyTurnFailureReason(detail, isTimeout);
    const providerMatch = /\[provider=([^\]]+)\]/.exec(detail);
    failureReason = reason;
    turnError = {
      reason,
      botId,
      ...(providerMatch?.[1] ? { provider: providerMatch[1] } : {}),
      detail,
      retryable: reason === 'rate-limit' || reason === 'provider-error' || reason === 'timeout',
    };
  };

  while (queue.length > 0) {
    if (signal?.aborted) {
      stoppedBy = 'cancelled';
      break;
    }
    if (spoken.length >= maxTurns) {
      stoppedBy = 'max-turns';
      break;
    }
    if (turnsUsed + spoken.length >= roomBudget) {
      stoppedBy = 'budget';
      break;
    }

    const bot = queue.shift() as ChatBot;
    const isIndependent = !soloMode && mode === 'panel';
    const isClosing =
      (mode === 'panel' && queue.length === 0) ||
      (effectiveRounds > 1 && spoken.length + 1 >= turnBudget);
    const fromHere = roster.findIndex((other) => other.id === bot.id);
    const handoffTargets =
      isClosing || isIndependent
        ? []
        : effectiveRounds > 1
          ? [...roster.slice(fromHere + 1), ...roster.slice(0, fromHere)].filter(
              (other) => other.id !== bot.id && (turnsBy.get(other.id) ?? 0) < effectiveRounds
            )
          : [...queue].filter((other) => other.id !== bot.id);
    const visibleHistory = isIndependent ? [...history, userMessage] : messages;
    const request: ChatTurnRequest = {
      bot,
      roster: [...roster],
      history: buildContext(visibleHistory),
      waiting: isIndependent ? [] : [...queue],
      handoffTargets,
      isClosing,
      prompt: userMessage.body,
      language,
      attachments: userMessage.attachments ?? [],
      signal,
      soloMode,
      mode: soloMode ? undefined : mode,
    };

    let turn: BotTurn | null = null;
    try {
      const raced = await executeBoundedAttempt(signal, turnTimeoutMs, (attemptSignal) =>
        generate({ ...request, signal: attemptSignal })
      );
      if ('timedOut' in raced) {
        if (signal?.aborted) {
          stoppedBy = 'cancelled';
          break;
        }
        failures.push({ kind: 'timeout', after: turnTimeoutMs });
        recordTurnError(bot.id, `Turn timed out after ${turnTimeoutMs}ms`, true);
        stoppedBy = 'failed';
        break;
      }
      turn = raced.value;
    } catch (error) {
      if (signal?.aborted) {
        stoppedBy = 'cancelled';
        break;
      }
      const detail = error instanceof Error ? error.message : String(error);
      if (isTransient(error)) {
        await sleepWithJitterAndAbort(retryDelayMs, signal);
        if (signal?.aborted) {
          stoppedBy = 'cancelled';
          break;
        }
        try {
          const retried = await executeBoundedAttempt(signal, turnTimeoutMs, (attemptSignal) =>
            generate({ ...request, signal: attemptSignal })
          );
          if ('timedOut' in retried) {
            if (signal?.aborted) {
              stoppedBy = 'cancelled';
              break;
            }
            failures.push({ kind: 'timeout', after: turnTimeoutMs });
            recordTurnError(bot.id, `Turn timed out after ${turnTimeoutMs}ms`, true);
            stoppedBy = 'failed';
            break;
          }
          turn = retried.value;
        } catch (retry) {
          if (signal?.aborted) {
            stoppedBy = 'cancelled';
            break;
          }
          const retryDetail = retry instanceof Error ? retry.message : String(retry);
          failures.push({ kind: 'transient', detail: retryDetail });
          recordTurnError(bot.id, retryDetail, false);
          stoppedBy = 'failed';
          break;
        }
      } else {
        const isTimeout = isClientTimeoutError(error, detail);
        if (isTimeout) {
          failures.push({ kind: 'timeout', after: turnTimeoutMs });
          recordTurnError(bot.id, detail, true);
        } else {
          failures.push({ kind: 'fatal', detail });
          recordTurnError(bot.id, detail, false);
        }
        stoppedBy = 'failed';
        break;
      }
    }

    if (!turn) break;

    if (signal?.aborted) {
      stoppedBy = 'cancelled';
      break;
    }

    const isSilentTurn = turn.silent || turn.text.trim() === SILENT_TOKEN || !turn.text.trim();
    if (isSilentTurn) {
      spoken.push(bot.id);
      countTurn(bot.id);
    } else {
      const message: ChatMessage = {
        id: `${messages.length}`,
        authorId: bot.id,
        body: turn.text.trim(),
        mentioned: [],
      };
      messages.push(message);
      onTurn?.(message);
      spoken.push(bot.id);
      countTurn(bot.id);
      produced += 1;
    }

    let hasPeerHandoff = false;
    for (const id of dedupe(turn.handoffs)) {
      if (id === bot.id || id === USER_HANDLE || (turnsBy.get(id) ?? 0) >= effectiveRounds) continue;
      const target = roster.find((other) => other.id === id);
      if (!target) continue;
      hasPeerHandoff = true;
      if (!queue.some((waiting) => waiting.id === id)) queue.push(target);
    }

    if (isSilentTurn) continue;

    if (!isIndependent && !hasPeerHandoff) {
      const explicitUserHandoff = turn.handoffs.includes(USER_HANDLE);
      const proseUserFallback =
        turn.handoffs.length === 0 && parseMentions(turn.text, roster).includes(USER_HANDLE);
      if (explicitUserHandoff || proseUserFallback) {
        stoppedBy = 'user';
        break;
      }
    }
  }

  if (queue.length === 0 && stoppedBy === 'max-turns') stoppedBy = produced === 0 ? 'silent' : 'user';
  return {
    messages,
    stoppedBy,
    speakers: spoken,
    failures,
    ...(failureReason ? { failureReason } : {}),
    ...(turnError ? { turnError } : {}),
  };
};
