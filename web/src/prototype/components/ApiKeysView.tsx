import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModelProvider } from '../types';
import { providerLabel } from '../data/catalog';
import {
  builtinProviderById,
  normalizeBaseUrl,
  resolveProviderEndpoint,
  verifyProviderConnection,
  type ProviderProtocol,
} from '../chat/byok';
import { slugifyCustomProvider } from '@/lib/store/botValidation';
import { isVerifyErrorCode, sanitizeApiKey } from '@/lib/byok/verify';
import { visibleModelsForProvider } from '../chat/modelAllowList';
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';

/**
 * What a successful connection test proved. Save is offered only while the CURRENT inputs are
 * exactly the ones that passed: any edit to the key or the Base URL invalidates it.
 */
type TestedConnection = {
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

type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | ({ phase: 'tested' } & TestedConnection)
  | { phase: 'error'; message: string }
  | ({ phase: 'saving' } & TestedConnection);

type CustomModelState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'verified'; modelId: string; testedKey: string; testedTarget: string; saveBaseUrl: string }
  | { phase: 'error'; message: string }
  | { phase: 'saving'; modelId: string };

/** Identifies the endpoint a test ran against; a different value means the test no longer applies. */
const targetFingerprint = (protocol: string | undefined, baseUrl: string | undefined): string =>
  `${protocol ?? ''}|${normalizeBaseUrl(baseUrl ?? '')}`;

/** True only when `state` is a passed test for exactly this key and endpoint. */
const testMatchesInput = (state: TestState, rawKey: string, target: string): boolean =>
  (state.phase === 'tested' || state.phase === 'saving') &&
  state.testedKey.length > 0 &&
  state.testedKey === sanitizeApiKey(rawKey) &&
  state.testedTarget === target;

type RetestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'ok'; model: string }
  | { phase: 'error'; message: string };

/**
 * Copy for verification outcomes that have no entry in the shared i18n table yet. Kept next to the
 * only view that uses it; English and Vietnamese always ship together so the language toggle covers it.
 */
const errorText = (
  t: Record<string, string>,
  message: string,
  fallback?: string
): string => {
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

export const ApiKeysView: React.FC = () => {
  const {
    apiKeys,
    connectApiKey,
    updateProviderModels,
    getProviderSecret,
    removeApiKey,
    revokeAllKeys,
    t,
  } = useApp();

  const describeError = (message: string, fallback?: string) =>
    errorText(t as unknown as Record<string, string>, message, fallback);
  const [retest, setRetest] = useState<RetestState>({ phase: 'idle' });

  const [activeProvider, setActiveProvider] = useState<ModelProvider | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);

  // Built-in / existing provider connect & manage state
  const [draftKey, setDraftKey] = useState('');
  const [test, setTest] = useState<TestState>({ phase: 'idle' });

  // Custom provider modal state
  const [customStandard, setCustomStandard] = useState<'openai' | 'anthropic'>('openai');
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customTest, setCustomTest] = useState<TestState>({ phase: 'idle' });

  // Custom model Test -> Save state (shared across connect & manage modals)
  const [customModelInput, setCustomModelInput] = useState('');
  const [customModelState, setCustomModelState] = useState<CustomModelState>({ phase: 'idle' });

  // Monotonic run ids: a test result is applied only if no newer test / edit / close happened since.
  const builtinTestRun = useRef(0);
  const customTestRun = useRef(0);
  const customModelTestRun = useRef(0);

  const activeItem = activeProvider
    ? apiKeys.find((key) => key.provider === activeProvider)
    : undefined;
  const builtin = activeProvider ? builtinProviderById(activeProvider) : undefined;

  const resetCustomModelBox = () => {
    customModelTestRun.current += 1;
    setCustomModelInput('');
    setCustomModelState({ phase: 'idle' });
  };

  /** Any edit to the key / Base URL / standard sends the custom modal back to "Test". */
  const invalidateCustomTest = () => {
    customTestRun.current += 1;
    customModelTestRun.current += 1;
    setCustomTest({ phase: 'idle' });
    setCustomModelState((current) => (current.phase === 'idle' ? current : { phase: 'idle' }));
  };

  const openProvider = (next: ModelProvider) => {
    builtinTestRun.current += 1;
    setActiveProvider(next);
    setDraftKey('');
    setTest({ phase: 'idle' });
    setRetest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const closeModal = () => {
    builtinTestRun.current += 1;
    setActiveProvider(null);
    setDraftKey('');
    setTest({ phase: 'idle' });
    setRetest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const openCustomModal = () => {
    customTestRun.current += 1;
    setIsCustomOpen(true);
    setCustomStandard('openai');
    setCustomName('');
    setCustomBaseUrl('');
    setCustomKey('');
    setCustomTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const closeCustomModal = () => {
    customTestRun.current += 1;
    setIsCustomOpen(false);
    setCustomTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const activeProtocol = (builtin?.protocol ?? activeItem?.protocol) as ProviderProtocol | undefined;
  const activeEndpointUrl = activeProvider
    ? builtin?.baseUrl ?? activeItem?.baseUrl ?? ''
    : '';
  const builtinTarget = targetFingerprint(activeProtocol, activeEndpointUrl);
  const customTarget = targetFingerprint(customStandard, customBaseUrl);

  const testConnection = async () => {
    if (!activeProvider || test.phase === 'testing' || test.phase === 'saving') return;
    const key = sanitizeApiKey(draftKey);
    if (!key) {
      setTest({ phase: 'error', message: 'EMPTY_KEY' });
      return;
    }
    const runId = ++builtinTestRun.current;
    const testedTarget = builtinTarget;
    setTest({ phase: 'testing' });
    try {
      const endpoint = resolveProviderEndpoint({
        provider: activeProvider,
        protocol: activeProtocol,
        baseUrl: activeEndpointUrl,
      });
      const result = await verifyProviderConnection(endpoint, key);
      if (runId !== builtinTestRun.current) return;
      setTest({
        phase: 'tested',
        models: result.models,
        selected: result.verifiedModel,
        testedKey: key,
        testedTarget,
        saveBaseUrl: result.resolvedBaseUrl ?? endpoint.baseUrl,
        ...(result.warning ? { warning: result.warning } : {}),
      });
    } catch (error) {
      if (runId !== builtinTestRun.current) return;
      setTest({ phase: 'error', message: (error as Error).message });
    }
  };

  /**
   * Applies a failed save: a verification verdict (the server re-tested the key and it failed)
   * sends the user back to Test; a server-side problem keeps the passed test so Save can be retried.
   */
  const savedOrError = (passed: TestedConnection, error: string): TestState =>
    isVerifyErrorCode(error) || error === 'EMPTY_KEY'
      ? { phase: 'error', message: error }
      : { phase: 'tested', ...passed, saveError: error };

  const saveConnection = async () => {
    if (!activeProvider || test.phase !== 'tested') return;
    if (!testMatchesInput(test, draftKey, builtinTarget)) return;
    const passed: TestedConnection = { ...test, saveError: undefined };
    setTest({ ...passed, phase: 'saving' });
    const result = await connectApiKey(activeProvider, passed.testedKey, passed.selected, {
      models: passed.models,
      label: activeItem?.label ?? builtin?.label,
      protocol: activeProtocol,
      baseUrl: builtin?.baseUrl ?? passed.saveBaseUrl,
      isCustom: Boolean(activeItem?.isCustom && !builtin),
    });
    if (!result.ok) {
      setTest(savedOrError(passed, result.error));
      return;
    }
    closeModal();
  };

  const testCustomConnection = async () => {
    if (customTest.phase === 'testing' || customTest.phase === 'saving') return;
    const trimmedName = customName.trim();
    const normalizedUrl = normalizeBaseUrl(customBaseUrl);
    const key = sanitizeApiKey(customKey);
    if (!trimmedName) {
      setCustomTest({ phase: 'error', message: 'INVALID_NAME' });
      return;
    }
    if (!/^https?:\/\/[^\s/]+/i.test(normalizedUrl)) {
      setCustomTest({ phase: 'error', message: 'BAD_URL_FORMAT' });
      return;
    }
    if (!key) {
      setCustomTest({ phase: 'error', message: 'EMPTY_KEY' });
      return;
    }
    const providerId = slugifyCustomProvider(customStandard, trimmedName);
    const runId = ++customTestRun.current;
    const testedTarget = customTarget;
    setCustomTest({ phase: 'testing' });
    try {
      const typedModel = customModelInput.trim();
      const result = await verifyProviderConnection(
        { provider: providerId, protocol: customStandard, baseUrl: normalizedUrl },
        key,
        typedModel ? { model: typedModel } : {}
      );
      if (runId !== customTestRun.current) return;
      setCustomTest({
        phase: 'tested',
        models: result.models,
        selected: result.verifiedModel,
        testedKey: key,
        testedTarget,
        saveBaseUrl: result.resolvedBaseUrl ?? normalizedUrl,
        ...(result.warning ? { warning: result.warning } : {}),
      });
    } catch (error) {
      if (runId !== customTestRun.current) return;
      setCustomTest({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveCustomConnection = async () => {
    if (customTest.phase !== 'tested') return;
    if (!testMatchesInput(customTest, customKey, customTarget)) return;
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setCustomTest({ phase: 'error', message: 'INVALID_NAME' });
      return;
    }
    const providerId = slugifyCustomProvider(customStandard, trimmedName);
    const passed: TestedConnection = { ...customTest, saveError: undefined };
    setCustomTest({ ...passed, phase: 'saving' });
    const result = await connectApiKey(providerId, passed.testedKey, passed.selected, {
      models: passed.models,
      label: trimmedName,
      protocol: customStandard,
      baseUrl: passed.saveBaseUrl,
      isCustom: true,
    });
    if (!result.ok) {
      setCustomTest(savedOrError(passed, result.error));
      return;
    }
    closeCustomModal();
  };

  const retestConnection = async () => {
    if (!activeProvider || retest.phase === 'testing') return;
    setRetest({ phase: 'testing' });
    try {
      const response = await fetch('/api/providers/test', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: activeProvider }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: unknown;
        verifiedModel?: unknown;
      } | null;
      if (payload?.ok === true && typeof payload.verifiedModel === 'string') {
        setRetest({ phase: 'ok', model: payload.verifiedModel });
        return;
      }
      setRetest({
        phase: 'error',
        message: typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR',
      });
    } catch {
      setRetest({ phase: 'error', message: 'NETWORK_FAILED' });
    }
  };

  const disconnect = async () => {
    if (!activeProvider) return;
    await removeApiKey(activeProvider);
    closeModal();
  };

  const runCustomModelTest = async (context: {
    provider: ModelProvider;
    apiKey: string;
    protocol?: ProviderProtocol;
    baseUrl?: string;
    useStoredKey?: boolean;
  }) => {
    const candidate = customModelInput.trim();
    if (!candidate || customModelState.phase === 'testing' || customModelState.phase === 'saving') {
      return;
    }
    const runId = ++customModelTestRun.current;
    setCustomModelState({ phase: 'testing' });
    try {
      if (context.useStoredKey) {
        const response = await fetch('/api/providers/test', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: context.provider, model: candidate }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: unknown;
          resolvedBaseUrl?: unknown;
        } | null;
        if (runId !== customModelTestRun.current) return;
        if (payload?.ok !== true) {
          setCustomModelState({
            phase: 'error',
            message: typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR',
          });
          return;
        }
        setCustomModelState({
          phase: 'verified',
          modelId: candidate,
          testedKey: '',
          testedTarget: targetFingerprint(context.protocol, context.baseUrl),
          saveBaseUrl:
            typeof payload.resolvedBaseUrl === 'string'
              ? payload.resolvedBaseUrl
              : normalizeBaseUrl(context.baseUrl ?? ''),
        });
        return;
      }
      const key = sanitizeApiKey(context.apiKey);
      const result = await verifyProviderConnection(
        { provider: context.provider, protocol: context.protocol, baseUrl: context.baseUrl },
        key,
        { model: candidate }
      );
      if (runId !== customModelTestRun.current) return;
      setCustomModelState({
        phase: 'verified',
        modelId: candidate,
        testedKey: key,
        testedTarget: targetFingerprint(context.protocol, context.baseUrl),
        saveBaseUrl: result.resolvedBaseUrl ?? normalizeBaseUrl(context.baseUrl ?? ''),
      });
    } catch (error) {
      if (runId !== customModelTestRun.current) return;
      setCustomModelState({ phase: 'error', message: (error as Error).message });
    }
  };

  /**
   * A model test is a full live connection test for its key + endpoint, so it may mark the draft
   * as tested — but only for the exact inputs it ran with.
   */
  const saveCustomModelToConnectDraft = (isCustomProviderModal: boolean) => {
    if (customModelState.phase !== 'verified') return;
    const verified = customModelState;
    const currentKey = isCustomProviderModal ? customKey : draftKey;
    const currentTarget = isCustomProviderModal ? customTarget : builtinTarget;
    if (verified.testedKey !== sanitizeApiKey(currentKey) || verified.testedTarget !== currentTarget) {
      setCustomModelState({ phase: 'idle' });
      return;
    }
    const merge = (prev: TestState): TestState => {
      const previousModels = prev.phase === 'tested' ? prev.models : [];
      return {
        phase: 'tested',
        models: Array.from(new Set([verified.modelId, ...previousModels])),
        selected: verified.modelId,
        testedKey: verified.testedKey,
        testedTarget: verified.testedTarget,
        saveBaseUrl: prev.phase === 'tested' ? prev.saveBaseUrl : verified.saveBaseUrl,
      };
    };
    if (isCustomProviderModal) {
      setCustomTest(merge);
    } else {
      setTest(merge);
    }
    resetCustomModelBox();
  };

  const saveCustomModelToConnectedProvider = async () => {
    if (!activeProvider || !activeItem || customModelState.phase !== 'verified') return;
    const verifiedModel = customModelState.modelId;
    setCustomModelState({ phase: 'saving', modelId: verifiedModel });
    const existing = activeItem.models && activeItem.models.length > 0
      ? activeItem.models
      : [activeItem.modelName].filter(Boolean);
    const merged = Array.from(new Set([verifiedModel, ...existing]));
    const ok = await updateProviderModels(activeProvider, verifiedModel, merged);
    if (!ok) {
      setCustomModelState({ phase: 'error', message: 'SAVE_FAILED' });
      return;
    }
    resetCustomModelBox();
  };

  const changeConnectedDefaultModel = async (nextModel: string) => {
    if (!activeProvider || !activeItem || !nextModel) return;
    const existing = activeItem.models && activeItem.models.length > 0
      ? activeItem.models
      : [activeItem.modelName].filter(Boolean);
    const merged = Array.from(new Set([nextModel, ...existing]));
    await updateProviderModels(activeProvider, nextModel, merged);
  };

  // Save is shown ONLY while the last passed test matches the exact current key + Base URL.
  const tested = testMatchesInput(test, draftKey, builtinTarget);
  const busy = test.phase === 'testing' || test.phase === 'saving';

  const customTested = testMatchesInput(customTest, customKey, customTarget);
  const customBusy = customTest.phase === 'testing' || customTest.phase === 'saving';

  const warningText = (warning: string | undefined): string | null => {
    if (warning === 'RATE_LIMITED') return t.apiVerifyWarningRateLimited;
    if (warning === 'INSUFFICIENT_CREDITS') return t.apiVerifyWarningCredits;
    return null;
  };

  const activeSecret =
    (activeProvider ? getProviderSecret(activeProvider) : undefined) || draftKey.trim();

  return (
    <div className="content-shell w-full min-w-0 max-w-full space-y-7">
      <header className="page-header flex w-full min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="page-header w-full min-w-0 sm:flex-1">
          <h2 className="break-words text-3xl">{t.providersTitle}</h2>
          <p className="break-words">{t.providersBody}</p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            id="add-custom-provider-btn"
            onClick={openCustomModal}
            className="button-primary min-h-11 w-full min-w-0 justify-center sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.providerAddCustom}
          </button>

          <button
            type="button"
            onClick={() => setIsClearOpen(true)}
            className="button-secondary min-h-11 w-full min-w-0 justify-center sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t.clearStates}
          </button>
        </div>
      </header>

      <div className="min-w-0 flex-1">
        <h2 className="font-medium text-ink">{t.noCredentialTitle}</h2>
        <p className="mt-1 break-words text-sm leading-relaxed text-ink-muted">
          {t.noCredentialBody}
        </p>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {apiKeys.map((item) => {
          const itemBuiltin = builtinProviderById(item.provider);
          const displayLabel = item.label || providerLabel(item.provider);
          const displayBaseUrl = itemBuiltin?.baseUrl ?? item.baseUrl ?? '';
          const modelCount = visibleModelsForProvider(
            item.provider,
            item.models,
            item.connected ? item.modelName : undefined
          ).length;
          return (
            <article
              key={item.provider}
              data-provider-card={item.provider}
              className="panel flex w-full min-w-0 max-w-full flex-col justify-between gap-4 p-5"
            >
              <div className="min-w-0 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 break-words font-serif text-lg text-ink">
                    {displayLabel}
                  </h2>
                  {itemBuiltin ? (
                    <span className="badge-neutral inline-flex max-w-full items-center gap-1 whitespace-normal break-words">
                      <ShieldCheck className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.providerVerifiedBadge}
                    </span>
                  ) : (
                    <span className="badge-neutral inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.providerCustomBadge}
                    </span>
                  )}
                </div>

                {displayBaseUrl && (
                  <p className="flex items-center gap-1.5 truncate font-mono text-xs text-ink-muted">
                    {itemBuiltin && <Lock className="h-3 w-3 shrink-0 text-brass" aria-hidden="true" />}
                    <span className="truncate">{displayBaseUrl}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="badge-neutral">
                    {item.connected ? item.modelName : t.stateOff}
                  </span>
                  {item.connected && modelCount > 0 && (
                    <span>
                      {t.providerModelsCount.replace('{count}', String(modelCount))}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  id={`provider-connect-${item.provider}`}
                  data-provider-connect={item.provider}
                  onClick={() => openProvider(item.provider)}
                  className={
                    item.connected
                      ? 'button-secondary min-h-11 w-full justify-center sm:w-auto'
                      : 'button-primary min-h-11 w-full justify-center sm:w-auto'
                  }
                  aria-label={`${item.connected ? t.providerManage : t.toggleState}: ${displayLabel}`}
                >
                  {item.connected ? (
                    <>
                      <Settings2 className="h-4 w-4" aria-hidden="true" />
                      {t.providerManage}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {t.toggleState}
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Built-in or Existing Provider Connect / Manage Modal */}
      <Modal
        isOpen={activeProvider !== null}
        onClose={closeModal}
        title={activeItem?.label || (activeProvider ? providerLabel(activeProvider) : t.dialogTitle)}
        description={t.dialogBody}
        closeLabel={t.close}
        footer={
          activeItem?.connected ? (
            <>
              <button
                type="button"
                onClick={closeModal}
                className="button-secondary min-h-11 justify-center"
              >
                {t.close}
              </button>
              <button
                type="button"
                id="provider-retest-btn"
                onClick={() => void retestConnection()}
                disabled={retest.phase === 'testing'}
                className={
                  retest.phase === 'error'
                    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                    : retest.phase === 'ok'
                      ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50'
                      : 'button-secondary min-h-11 justify-center'
                }
              >
                {retest.phase === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : retest.phase === 'error' ? (
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {t.apiVerifyRetest}
              </button>
              <button
                type="button"
                id="provider-disconnect-btn"
                onClick={() => void disconnect()}
                className="button-danger min-h-11 justify-center"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t.providerDisconnect}
              </button>
            </>
          ) : tested ? (
            <>
              <button
                type="button"
                onClick={() => setTest({ phase: 'idle' })}
                disabled={busy}
                className="button-secondary min-h-11 justify-center"
              >
                {t.keyBack}
              </button>
              <button
                type="button"
                id="provider-save-btn"
                onClick={() => void saveConnection()}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {t.save}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={closeModal}
                className="button-secondary min-h-11 justify-center"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="provider-test-btn"
                onClick={() => void testConnection()}
                disabled={busy || !sanitizeApiKey(draftKey)}
                className={
                  test.phase === 'error'
                    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                    : 'button-primary min-h-11 justify-center'
                }
              >
                {test.phase === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : test.phase === 'error' ? (
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {t.keyTest}
              </button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {/* Base URL field — ALWAYS locked & disabled for built-in verified providers */}
          <label className="field">
            <span className="flex items-center justify-between gap-2">
              <span className="field-label">{t.providerBaseUrlLabel}</span>
              {builtin && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brass">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {t.providerBaseUrlLocked}
                </span>
              )}
            </span>
            <input
              id="provider-base-url"
              type="url"
              value={activeEndpointUrl}
              disabled
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-border bg-surface-2/70 px-3 py-2.5 font-mono text-xs text-ink-muted opacity-80"
            />
          </label>

          {activeItem?.connected ? (
            <>
              {retest.phase === 'ok' && (
                <p
                  role="status"
                  id="provider-retest-status"
                  className="rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-sm font-medium text-sage"
                >
                  {t.apiVerifyRetestOk} ({retest.model})
                </p>
              )}
              {retest.phase === 'error' && (
                <p
                  role="alert"
                  id="provider-retest-status"
                  className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
                >
                  {describeError(retest.message)}
                </p>
              )}
              <label className="field">
                <span className="field-label">{t.keyModelLabel}</span>
                <select
                  id="connected-provider-model-select"
                  value={activeItem.modelName}
                  onChange={(event) => void changeConnectedDefaultModel(event.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                >
                  {visibleModelsForProvider(
                    activeItem.provider,
                    activeItem.models,
                    activeItem.modelName
                  ).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              {activeItem.hasKey && !getProviderSecret(activeItem.provider) ? (
                <label className="field">
                  <span className="field-label">{t.keyLabel}</span>
                  <input
                    id="provider-masked-key"
                    type="text"
                    value={activeItem.maskedKey ?? '••••'}
                    disabled
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-border bg-surface-2/70 px-3 py-2.5 font-mono text-xs text-ink-muted opacity-80"
                  />
                </label>
              ) : !getProviderSecret(activeItem.provider) ? (
                <label className="field">
                  <span className="field-label">{t.keyLabel}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={draftKey}
                    placeholder={builtin?.keyHint ?? 'sk-…'}
                    onChange={(e) => setDraftKey(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                  />
                </label>
              ) : null}

              {/* Add Custom Model ID -> Test (Red/Green) -> Save */}
              <div className="rounded-xl border border-border bg-background/60 p-3.5 space-y-2.5">
                <label htmlFor="custom-model-input" className="field-label block">
                  {t.providerCustomModelLabel}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="custom-model-input"
                    type="text"
                    value={customModelInput}
                    placeholder={t.providerCustomModelPlaceholder}
                    onChange={(event) => {
                      setCustomModelInput(event.target.value);
                      if (customModelState.phase !== 'idle') {
                        setCustomModelState({ phase: 'idle' });
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brass"
                  />
                  {customModelState.phase === 'verified' || customModelState.phase === 'saving' ? (
                    <button
                      type="button"
                      id="custom-model-save-btn"
                      onClick={() => void saveCustomModelToConnectedProvider()}
                      disabled={customModelState.phase === 'saving'}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {customModelState.phase === 'saving' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t.providerModelSave}
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="custom-model-test-btn"
                      onClick={() =>
                        void runCustomModelTest({
                          provider: activeItem.provider,
                          apiKey: activeSecret,
                          protocol: builtin?.protocol ?? activeItem.protocol,
                          baseUrl: activeEndpointUrl,
                          useStoredKey: !activeSecret && Boolean(activeItem.hasKey),
                        })
                      }
                      disabled={
                        !customModelInput.trim() ||
                        (!activeSecret && !activeItem.hasKey) ||
                        customModelState.phase === 'testing'
                      }
                      className={
                        customModelState.phase === 'error'
                          ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-700 bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                          : 'button-secondary min-h-10 shrink-0 justify-center text-xs disabled:opacity-50'
                      }
                    >
                      {customModelState.phase === 'testing' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : customModelState.phase === 'error' ? (
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t.providerModelTest}
                    </button>
                  )}
                </div>
                {customModelState.phase === 'verified' && (
                  <p role="status" className="text-xs font-medium text-sage">
                    {t.providerModelTestOk}
                  </p>
                )}
                {customModelState.phase === 'error' && (
                  <p role="alert" className="text-xs font-medium text-terracotta">
                    {describeError(customModelState.message, t.providerModelTestFail)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">{t.keyLabel}</span>
                <input
                  id="provider-api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  value={draftKey}
                  placeholder={builtin?.keyHint ?? 'sk-…'}
                  disabled={busy}
                  onChange={(event) => {
                    builtinTestRun.current += 1;
                    setDraftKey(event.target.value);
                    setTest({ phase: 'idle' });
                    setCustomModelState((current) => (current.phase === 'idle' ? current : { phase: 'idle' }));
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                />
              </label>

              {test.phase === 'error' && (
                <p
                  role="alert"
                  className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
                >
                  {describeError(test.message)}
                </p>
              )}

              {tested && (test.phase === 'tested' || test.phase === 'saving') && (
                <div className="space-y-4">
                  <p
                    role="status"
                    id="provider-test-status"
                    className="rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-sm font-medium text-sage"
                  >
                    {t.keyTestOk}
                  </p>
                  {warningText(test.warning) && (
                    <p
                      id="provider-test-warning"
                      className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-medium text-ink"
                    >
                      {warningText(test.warning)}
                    </p>
                  )}
                  {test.phase === 'tested' && test.saveError && (
                    <p
                      role="alert"
                      id="provider-save-error"
                      className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
                    >
                      {describeError(test.saveError, t.apiVerifySaveFailed)}
                    </p>
                  )}

                  <label className="field">
                    <span className="field-label">{t.keyModelLabel}</span>
                    <select
                      id="provider-model-select"
                      value={test.selected}
                      disabled={test.phase === 'saving'}
                      onChange={(event) =>
                        setTest((current) =>
                          current.phase === 'tested'
                            ? { ...current, selected: event.target.value }
                            : current
                        )
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                    >
                      {test.models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Custom model Test -> Save right during initial Connect */}
                  <div className="rounded-xl border border-border bg-background/60 p-3.5 space-y-2.5">
                    <label htmlFor="connect-custom-model-input" className="field-label block">
                      {t.providerCustomModelLabel}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="connect-custom-model-input"
                        type="text"
                        value={customModelInput}
                        placeholder={t.providerCustomModelPlaceholder}
                        onChange={(event) => {
                          setCustomModelInput(event.target.value);
                          if (customModelState.phase !== 'idle') {
                            setCustomModelState({ phase: 'idle' });
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brass"
                      />
                      {customModelState.phase === 'verified' ? (
                        <button
                          type="button"
                          id="connect-custom-model-save-btn"
                          onClick={() => saveCustomModelToConnectDraft(false)}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          {t.providerModelSave}
                        </button>
                      ) : (
                        <button
                          type="button"
                          id="connect-custom-model-test-btn"
                          onClick={() =>
                            activeProvider &&
                            void runCustomModelTest({
                              provider: activeProvider,
                              apiKey: draftKey,
                              protocol: builtin?.protocol ?? activeItem?.protocol,
                              baseUrl: activeEndpointUrl,
                            })
                          }
                          disabled={
                            !customModelInput.trim() ||
                            !sanitizeApiKey(draftKey) ||
                            customModelState.phase === 'testing'
                          }
                          className={
                            customModelState.phase === 'error'
                              ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-700 bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                              : 'button-secondary min-h-10 shrink-0 justify-center text-xs disabled:opacity-50'
                          }
                        >
                          {customModelState.phase === 'testing' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : customModelState.phase === 'error' ? (
                            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {t.providerModelTest}
                        </button>
                      )}
                    </div>
                    {customModelState.phase === 'verified' && (
                      <p role="status" className="text-xs font-medium text-sage">
                        {t.providerModelTestOk}
                      </p>
                    )}
                    {customModelState.phase === 'error' && (
                      <p role="alert" className="text-xs font-medium text-terracotta">
                        {describeError(customModelState.message, t.providerModelTestFail)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Add Custom Provider Modal (OpenAI-compatible & Anthropic-compatible standards) */}
      <Modal
        isOpen={isCustomOpen}
        onClose={closeCustomModal}
        title={t.providerCustomTitle}
        description={t.providerCustomBody}
        closeLabel={t.close}
        footer={
          customTested ? (
            <>
              <button
                type="button"
                onClick={() => setCustomTest({ phase: 'idle' })}
                disabled={customBusy}
                className="button-secondary min-h-11 justify-center"
              >
                {t.keyBack}
              </button>
              <button
                type="button"
                id="custom-provider-save-btn"
                onClick={() => void saveCustomConnection()}
                disabled={customBusy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {customBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {t.save}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={closeCustomModal}
                className="button-secondary min-h-11 justify-center"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="custom-provider-test-btn"
                onClick={() => void testCustomConnection()}
                disabled={
                  customBusy ||
                  !customName.trim() ||
                  !normalizeBaseUrl(customBaseUrl) ||
                  !sanitizeApiKey(customKey)
                }
                className={
                  customTest.phase === 'error'
                    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                    : 'button-primary min-h-11 justify-center'
                }
              >
                {customTest.phase === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : customTest.phase === 'error' ? (
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {t.keyTest}
              </button>
            </>
          )
        }
      >
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="field-label">{t.providerStandardLabel}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                id="custom-standard-openai"
                onClick={() => {
                  setCustomStandard('openai');
                  invalidateCustomTest();
                }}
                aria-pressed={customStandard === 'openai'}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                  customStandard === 'openai'
                    ? 'border-brass bg-brass/10 text-ink'
                    : 'border-border text-ink-muted hover:text-ink'
                }`}
              >
                {t.providerStandardOpenai}
              </button>
              <button
                type="button"
                id="custom-standard-anthropic"
                onClick={() => {
                  setCustomStandard('anthropic');
                  invalidateCustomTest();
                }}
                aria-pressed={customStandard === 'anthropic'}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                  customStandard === 'anthropic'
                    ? 'border-brass bg-brass/10 text-ink'
                    : 'border-border text-ink-muted hover:text-ink'
                }`}
              >
                {t.providerStandardAnthropic}
              </button>
            </div>
          </fieldset>

          <label className="field">
            <span className="field-label">{t.providerCustomNameLabel}</span>
            <input
              id="custom-provider-name"
              type="text"
              value={customName}
              placeholder={t.providerCustomNamePlaceholder}
              disabled={customBusy}
              onChange={(event) => {
                setCustomName(event.target.value);
                setCustomTest({ phase: 'idle' });
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
            />
          </label>

          <label className="field">
            <span className="field-label">{t.providerBaseUrlLabel}</span>
            <input
              id="custom-provider-url"
              type="url"
              value={customBaseUrl}
              placeholder={t.providerCustomUrlPlaceholder}
              disabled={customBusy}
              onChange={(event) => {
                setCustomBaseUrl(event.target.value);
                invalidateCustomTest();
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-xs text-ink outline-none focus:border-brass"
            />
          </label>

          <label className="field">
            <span className="field-label">{t.keyLabel}</span>
            <input
              id="custom-provider-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={customKey}
              placeholder={customStandard === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              disabled={customBusy}
              onChange={(event) => {
                setCustomKey(event.target.value);
                invalidateCustomTest();
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
            />
          </label>

          {customTest.phase === 'error' && (
            <p
              role="alert"
              className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
            >
              {describeError(customTest.message)}
            </p>
          )}

          {customTested && (customTest.phase === 'tested' || customTest.phase === 'saving') && (
            <div className="space-y-4">
              <p
                role="status"
                id="custom-provider-test-status"
                className="rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-sm font-medium text-sage"
              >
                {t.keyTestOk}
              </p>
              {customTest.saveBaseUrl !== normalizeBaseUrl(customBaseUrl) && (
                <p id="custom-provider-url-adjusted" className="text-xs font-medium text-ink-muted">
                  {t.apiVerifyBaseUrlAdjusted.replace('{url}', customTest.saveBaseUrl)}
                </p>
              )}
              {warningText(customTest.warning) && (
                <p
                  id="custom-provider-test-warning"
                  className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-medium text-ink"
                >
                  {warningText(customTest.warning)}
                </p>
              )}
              {customTest.phase === 'tested' && customTest.saveError && (
                <p
                  role="alert"
                  id="custom-provider-save-error"
                  className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
                >
                  {describeError(customTest.saveError, t.apiVerifySaveFailed)}
                </p>
              )}
              <label className="field">
                <span className="field-label">{t.keyModelLabel}</span>
                <select
                  id="custom-provider-model-select"
                  value={customTest.selected}
                  disabled={customTest.phase === 'saving'}
                  onChange={(event) =>
                    setCustomTest((current) =>
                      current.phase === 'tested'
                        ? { ...current, selected: event.target.value }
                        : current
                    )
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                >
                  {customTest.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Custom Model ID Test -> Save inside Custom Provider Modal */}
          <div className="rounded-xl border border-border bg-background/60 p-3.5 space-y-2.5">
            <label htmlFor="custom-provider-model-input" className="field-label block">
              {t.providerCustomModelLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="custom-provider-model-input"
                type="text"
                value={customModelInput}
                placeholder={t.providerCustomModelPlaceholder}
                onChange={(event) => {
                  setCustomModelInput(event.target.value);
                  if (customModelState.phase !== 'idle') {
                    setCustomModelState({ phase: 'idle' });
                  }
                }}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brass"
              />
              {customModelState.phase === 'verified' ? (
                <button
                  type="button"
                  id="custom-provider-model-save-btn"
                  onClick={() => saveCustomModelToConnectDraft(true)}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.providerModelSave}
                </button>
              ) : (
                <button
                  type="button"
                  id="custom-provider-model-test-btn"
                  onClick={() => {
                    const providerId = slugifyCustomProvider(customStandard, customName.trim() || 'gateway');
                    void runCustomModelTest({
                      provider: providerId,
                      apiKey: customKey,
                      protocol: customStandard,
                      baseUrl: normalizeBaseUrl(customBaseUrl),
                    });
                  }}
                  disabled={
                    !customModelInput.trim() ||
                    !normalizeBaseUrl(customBaseUrl) ||
                    !sanitizeApiKey(customKey) ||
                    customModelState.phase === 'testing'
                  }
                  className={
                    customModelState.phase === 'error'
                      ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-700 bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                      : 'button-secondary min-h-10 shrink-0 justify-center text-xs disabled:opacity-50'
                  }
                >
                  {customModelState.phase === 'testing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : customModelState.phase === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {t.providerModelTest}
                </button>
              )}
            </div>
            {customModelState.phase === 'verified' && (
              <p role="status" className="text-xs font-medium text-sage">
                {t.providerModelTestOk}
              </p>
            )}
            {customModelState.phase === 'error' && (
              <p role="alert" className="text-xs font-medium text-terracotta">
                {describeError(customModelState.message, t.providerModelTestFail)}
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title={t.clearStates}
        description={t.clearStatesConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsClearOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsClearOpen(false);
                void revokeAllKeys();
              }}
              className="button-danger min-h-11 justify-center"
            >
              {t.clearStates}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearStatesConfirm}</p>
      </Modal>
    </div>
  );
};
