/**
 * Shared types, constants, and HTTP status mapping for strict BYOK key verification.
 *
 * Kept dependency-free and erasable-TypeScript-only so both Next.js route handlers and
 * `node --test` suites can import these contracts directly.
 */

import type { DnsLookupFn } from '../../security/ssrf.ts';

export type VerifyProtocol = 'openai' | 'anthropic' | 'google';

export type VerifyErrorCode =
  | 'EMPTY_KEY'
  | 'INVALID_KEY'
  | 'INVALID_BASE_URL'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_ACCESS_DENIED'
  | 'NO_MODELS'
  | 'NETWORK_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_CREDITS'
  | 'PROVIDER_ERROR';

/** Conditions under which an AUTHENTICATED key is still reported as connected. */
export type VerifyWarningCode = 'RATE_LIMITED' | 'INSUFFICIENT_CREDITS';

export interface VerifyTarget {
  /** Built-in provider id (`openai`, `openrouter`, …) or `custom:<protocol>:<slug>`. */
  providerId: string;
  protocol: VerifyProtocol;
  /** Normalized base URL without trailing slash, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
  /** Model probed first when the caller did not pick one. */
  defaultModel?: string;
}

export interface VerifyOptions {
  /** Exact model to verify. When set, ONLY this model is probed (no silent substitution). */
  model?: string;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Wall-clock budget for the whole verification (all requests together). */
  totalBudgetMs?: number;
  /** Injected DNS resolver for server SSRF tests. */
  lookupImpl?: DnsLookupFn;
  /** Explicit override for private-network allowance on custom endpoints. */
  allowPrivateNetwork?: boolean;
}

export type VerifySuccess = {
  ok: true;
  models: string[];
  verifiedModel: string;
  /** Set when the Base URL had to be adjusted (e.g. `/v1` appended) to reach the API. */
  resolvedBaseUrl?: string;
  /** Set when the key is authenticated but the probed model is temporarily unusable. */
  warning?: VerifyWarningCode;
};

export type VerifyResult = VerifySuccess | { ok: false; error: VerifyErrorCode };

export interface RequestContext {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  deadline: number;
}

export type ParsedBody =
  | { kind: 'json'; value: unknown; raw: string }
  | { kind: 'html'; raw: string }
  | { kind: 'text'; raw: string }
  | { kind: 'empty'; raw: '' };

export interface FailureVerdict {
  error: VerifyErrorCode;
  definitive: boolean;
}

export interface ClassifyContext {
  /** The Base URL already answered a JSON model list, so it is a real API. */
  apiReachable: boolean;
  /** The key was already accepted by an endpoint that rejects anonymous callers. */
  authProven: boolean;
}

export const ANTHROPIC_API_VERSION = '2023-06-01';
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_TOTAL_BUDGET_MS = 45_000;
export const MAX_PROBE_ATTEMPTS = 4;

/** Output budget of the probe. Large enough for reasoning models, still negligible in cost. */
export const PROBE_MAX_TOKENS = 16;
/** Raised budget for models that enforce a minimum output size. */
export const PROBE_RAISED_MAX_TOKENS = 64;

const ALL_ERROR_CODES: readonly VerifyErrorCode[] = [
  'EMPTY_KEY',
  'INVALID_KEY',
  'INVALID_BASE_URL',
  'MODEL_NOT_FOUND',
  'MODEL_ACCESS_DENIED',
  'NO_MODELS',
  'NETWORK_FAILED',
  'TIMEOUT',
  'RATE_LIMITED',
  'INSUFFICIENT_CREDITS',
  'PROVIDER_ERROR',
];

/** Type guard for stable verification error codes thrown across browser/server boundaries. */
export const isVerifyErrorCode = (value: unknown): value is VerifyErrorCode =>
  typeof value === 'string' && (ALL_ERROR_CODES as readonly string[]).includes(value);

/** Maps a verification error code to the HTTP status returned by `/api/providers/*`. */
export const httpStatusForVerifyError = (error: VerifyErrorCode): number => {
  switch (error) {
    case 'EMPTY_KEY':
    case 'INVALID_KEY':
    case 'INVALID_BASE_URL':
    case 'MODEL_NOT_FOUND':
    case 'MODEL_ACCESS_DENIED':
    case 'NO_MODELS':
      return 422;
    case 'RATE_LIMITED':
      return 429;
    case 'INSUFFICIENT_CREDITS':
      return 402;
    case 'TIMEOUT':
      return 504;
    default:
      return 502;
  }
};
