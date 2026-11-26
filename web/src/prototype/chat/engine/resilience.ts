/**
 * Timeout racing, AbortSignal propagation, transient error detection, and failure classification
 * for individual advisor turns.
 */

import type { TurnFailureReason } from './types.ts';

/** Categorizes raw provider/network failure messages into actionable UI failure reasons. */
export const classifyTurnFailureReason = (
  detail: string,
  isTimeout = false
): TurnFailureReason => {
  if (isTimeout) return 'timeout';
  if (!/\b504\b/.test(detail) && /\b(timed?\s*out|timeout|ETIMEDOUT|TimeoutError)\b/i.test(detail)) {
    return 'timeout';
  }
  if (
    /\b(PROVIDER_NOT_CONNECTED|KEY_NOT_FOUND|EMPTY_KEY|missing[_ -]?api[_ -]?key|no[_ -]?api[_ -]?key)\b/i.test(
      detail
    )
  ) {
    return 'missing-key';
  }
  if (
    /\b(401|403|INVALID_KEY|API_KEY_INVALID|invalid[_ -]?api[_ -]?key|incorrect[_ -]?api[_ -]?key|unauthori[sz]ed|unauthenticated|authentication[_ -]?failed)\b/i.test(
      detail
    )
  ) {
    return 'provider-auth';
  }
  if (
    /\b(429|RATE_LIMITED|rate[_ -]?limit|too many requests|INSUFFICIENT_CREDITS|quota)\b/i.test(
      detail
    )
  ) {
    return 'rate-limit';
  }
  return 'provider-error';
};

export const isClientTimeoutError = (error: unknown, detail: string): boolean => {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'TimeoutError') return true;
  if (/\b504\b/.test(detail)) return false;
  return /\b(timed?\s*out|timeout|ETIMEDOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT)\b/i.test(
    detail
  );
};

/**
 * True ONLY for fast-failing transient upstream blips (HTTP 429/502/503/504 or TCP/DNS reset).
 * Client/turn timeouts NEVER auto-retry because re-sending a slow reasoning prompt doubles spend.
 */
export const isTransient = (error: unknown): boolean => {
  const detail = error instanceof Error ? error.message : String(error);
  if (isClientTimeoutError(error, detail)) return false;
  return /\b(429|502|503|504|overloaded|rate[_ -]?limit|RATE_LIMITED|ECONNRESET|EAI_AGAIN|ECONNABORTED|socket hang up)\b/i.test(
    detail
  );
};

const createChildTurnAbort = (
  parentSignal?: AbortSignal
): { controller: AbortController; dispose: () => void } => {
  const controller = new AbortController();
  if (!parentSignal) return { controller, dispose: () => {} };
  if (parentSignal.aborted) {
    controller.abort(parentSignal.reason);
    return { controller, dispose: () => {} };
  }
  const forwardAbort = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener('abort', forwardAbort, { once: true });
  return {
    controller,
    dispose: () => parentSignal.removeEventListener('abort', forwardAbort),
  };
};

export const sleepWithJitterAndAbort = (baseMs: number, signal?: AbortSignal): Promise<void> => {
  if (baseMs <= 0 || signal?.aborted) return Promise.resolve();
  const jittered = Math.max(1, Math.round(baseMs * (0.8 + Math.random() * 0.4)));
  return new Promise<void>((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, jittered);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

/** Runs `runAttempt` with a dedicated child AbortSignal bounded by `timeoutMs`. */
export const executeBoundedAttempt = async <T>(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  runAttempt: (attemptSignal: AbortSignal) => Promise<T> | T
): Promise<{ value: T } | { timedOut: true }> => {
  const { controller, dispose } = createChildTurnAbort(parentSignal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new DOMException('Turn timed out', 'TimeoutError'));
      resolve({ timedOut: true });
    }, timeoutMs);
  });
  try {
    const work = Promise.resolve().then(() => runAttempt(controller.signal));
    const raced = await Promise.race([work.then((value) => ({ value })), expiry]);
    if ('timedOut' in raced) {
      work.catch(() => undefined);
    }
    return raced;
  } finally {
    clearTimeout(timer);
    controller.abort();
    dispose();
  }
};
