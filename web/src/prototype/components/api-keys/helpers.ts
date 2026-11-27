/**
 * Shared verification state machines, input fingerprinting, and localized error mapping for ApiKeysView.
 */

import { isVerifyErrorCode, sanitizeApiKey } from '@/lib/byok/verify';
import { normalizeBaseUrl } from '../../chat/byok';
import type { Copy } from '../../i18n';

/**
 * What a successful connection test proved. Save is offered only while the CURRENT inputs are
 * exactly the ones that passed: any edit to the key or the Base URL invalidates it.
 */
export type TestedConnection = {
  models: string[];
  selected: string;
  /** The sanitized key that passed the live test. */
  testedKey: string;
  /** `protocol|normalized Base URL` that passed the live test. */
  testedTarget: string;
  /** Base URL to persist: normalized, with `/v1` appended when the API needed it. */
  saveBaseUrl: string;
  /** Key verified, but the provider reported a temporary quota / rate limit. */
  warning?: string;
  /** Save was refused by the server for a reason unrelated to the key (configuration, storage). */
  saveError?: string;
};

export type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | ({ phase: 'tested' } & TestedConnection)
  | { phase: 'error'; message: string }
  | ({ phase: 'saving' } & TestedConnection);

export type CustomModelState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | {
      phase: 'verified';
      modelId: string;
      testedKey: string;
      testedTarget: string;
      saveBaseUrl: string;
    }
  | { phase: 'error'; message: string }
  | { phase: 'saving'; modelId: string };

export type RetestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'ok'; model: string }
  | { phase: 'error'; message: string };

/** Identifies the endpoint a test ran against; a different value means the test no longer applies. */
export const targetFingerprint = (
  protocol: string | undefined,
  baseUrl: string | undefined
): string => `${protocol ?? ''}|${normalizeBaseUrl(baseUrl ?? '')}`;

/** True only when `state` is a passed test for exactly this key and endpoint. */
export const testMatchesInput = (state: TestState, rawKey: string, target: string): boolean =>
  (state.phase === 'tested' || state.phase === 'saving') &&
  state.testedKey.length > 0 &&
  state.testedKey === sanitizeApiKey(rawKey) &&
  state.testedTarget === target;

/**
 * Applies a failed save: a verification verdict (the server re-tested the key and it failed)
 * sends the user back to Test; a server-side problem keeps the passed test so Save can be retried.
 */
export const savedOrError = (passed: TestedConnection, error: string): TestState =>
  isVerifyErrorCode(error) || error === 'EMPTY_KEY'
    ? { phase: 'error', message: error }
    : { phase: 'tested', ...passed, saveError: error };

export const errorText = (t: Copy, message: string, fallback?: string): string => {
  switch (message) {
    case 'INVALID_KEY':
      return t.keyTestInvalid;
    case 'EMPTY_KEY':
      return t.keyTestEmpty;
    case 'BAD_URL_FORMAT':
      return t.keyTestInvalidUrl;
    case 'INVALID_BASE_URL':
      return t.apiVerifyInvalidEndpoint;
    case 'NETWORK_FAILED':
    case 'TIMEOUT':
      return t.keyTestNetwork;
    case 'MODEL_NOT_FOUND':
    case 'EMPTY_MODEL':
      return t.apiVerifyModelNotFound;
    case 'NO_MODELS':
      return t.apiVerifyNoModels;
    case 'RATE_LIMITED':
      return t.apiVerifyRateLimited;
    case 'INSUFFICIENT_CREDITS':
      return t.apiVerifyInsufficientCredits;
    case 'PROVIDER_ERROR':
      return t.apiVerifyProviderError;
    case 'MODEL_ACCESS_DENIED':
      return t.apiVerifyModelAccessDenied;
    case 'SAVE_FAILED':
      return t.apiVerifySaveFailed;
    case 'MISSING_PROVIDER_KEY_SECRET':
      return t.apiSaveSecretMissing;
    case 'INVALID_PROVIDER_KEY_SECRET':
      return t.apiSaveSecretInvalid;
    case 'STORE_NOT_CONFIGURED':
      return t.apiSaveStoreNotConfigured;
    case 'STORE_SCHEMA_OUTDATED':
      return t.apiSaveStoreSchemaOutdated;
    case 'NEED_LOGIN':
      return t.apiSaveNeedLogin;
    case 'INVALID_NAME':
      return t.apiSaveInvalidName;
    default:
      return fallback ?? t.keyTestFailed;
  }
};

export const warningText = (t: Copy, warning: string | undefined): string | null => {
  if (warning === 'RATE_LIMITED') return t.apiVerifyWarningRateLimited;
  if (warning === 'INSUFFICIENT_CREDITS') return t.apiVerifyWarningCredits;
  return null;
};
