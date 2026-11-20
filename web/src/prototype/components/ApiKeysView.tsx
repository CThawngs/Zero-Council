import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModelProvider } from '../types';
import { providerLabel } from '../data/mockData';
import {
  builtinProviderById,
  fetchProviderModels,
  normalizeBaseUrl,
  resolveProviderEndpoint,
  testProviderModel,
  type ProviderProtocol,
} from '../chat/byok';
import { slugifyCustomProvider } from '@/lib/store/botValidation';
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  LockKeyhole,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';

type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'tested'; models: string[]; selected: string }
  | { phase: 'error'; message: string }
  | { phase: 'saving'; models: string[]; selected: string };

type CustomModelState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'verified'; modelId: string }
  | { phase: 'error'; message: string }
  | { phase: 'saving'; modelId: string };

const errorText = (t: Record<string, string>, message: string): string => {
  switch (message) {
    case 'INVALID_KEY':
      return t.keyTestInvalid;
    case 'EMPTY_KEY':
      return t.keyTestEmpty;
    case 'INVALID_BASE_URL':
      return t.keyTestInvalidUrl;
    case 'NETWORK_FAILED':
      return t.keyTestNetwork;
    default:
      return t.keyTestFailed;
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

  const activeItem = activeProvider
    ? apiKeys.find((key) => key.provider === activeProvider)
    : undefined;
  const builtin = activeProvider ? builtinProviderById(activeProvider) : undefined;

  const resetCustomModelBox = () => {
    setCustomModelInput('');
    setCustomModelState({ phase: 'idle' });
  };

  const openProvider = (next: ModelProvider) => {
    setActiveProvider(next);
    setDraftKey('');
    setTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const closeModal = () => {
    setActiveProvider(null);
    setDraftKey('');
    setTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const openCustomModal = () => {
    setIsCustomOpen(true);
    setCustomStandard('openai');
    setCustomName('');
    setCustomBaseUrl('');
    setCustomKey('');
    setCustomTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const closeCustomModal = () => {
    setIsCustomOpen(false);
    setCustomTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const testConnection = async () => {
    if (!activeProvider || test.phase === 'testing' || test.phase === 'saving') return;
    setTest({ phase: 'testing' });
    try {
      const endpoint = resolveProviderEndpoint({
        provider: activeProvider,
        protocol: (activeItem?.protocol ?? builtin?.protocol) as ProviderProtocol | undefined,
        baseUrl: builtin ? builtin.baseUrl : activeItem?.baseUrl,
      });
      const models = await fetchProviderModels(endpoint, draftKey);
      if (models.length === 0) throw new Error('NO_MODELS');
      setTest({ phase: 'tested', models, selected: models[0] });
    } catch (error) {
      setTest({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveConnection = async () => {
    if (!activeProvider || test.phase !== 'tested') return;
    setTest({ phase: 'saving', models: test.models, selected: test.selected });
    const ok = await connectApiKey(activeProvider, draftKey.trim(), test.selected, {
      models: test.models,
      label: activeItem?.label ?? builtin?.label,
      protocol: builtin?.protocol ?? activeItem?.protocol,
      baseUrl: builtin?.baseUrl ?? activeItem?.baseUrl,
      isCustom: Boolean(activeItem?.isCustom && !builtin),
    });
    if (!ok) {
      setTest({ phase: 'error', message: 'SAVE_FAILED' });
      return;
    }
    closeModal();
  };

  const testCustomConnection = async () => {
    if (customTest.phase === 'testing' || customTest.phase === 'saving') return;
    const trimmedName = customName.trim();
    const trimmedUrl = normalizeBaseUrl(customBaseUrl);
    const trimmedKey = customKey.trim();
    if (!trimmedName) {
      setCustomTest({ phase: 'error', message: 'INVALID_NAME' });
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setCustomTest({ phase: 'error', message: 'INVALID_BASE_URL' });
      return;
    }
    if (!trimmedKey) {
      setCustomTest({ phase: 'error', message: 'EMPTY_KEY' });
      return;
    }
    const providerId = slugifyCustomProvider(customStandard, trimmedName);
    setCustomTest({ phase: 'testing' });
    try {
      const models = await fetchProviderModels(
        { provider: providerId, protocol: customStandard, baseUrl: trimmedUrl },
        trimmedKey
      );
      if (models.length > 0) {
        setCustomTest({ phase: 'tested', models, selected: models[0] });
        return;
      }
      if (customModelInput.trim()) {
        await testProviderModel(
          { provider: providerId, apiKey: trimmedKey, protocol: customStandard, baseUrl: trimmedUrl },
          customModelInput.trim()
        );
        const m = customModelInput.trim();
        setCustomTest({ phase: 'tested', models: [m], selected: m });
        return;
      }
      throw new Error('NO_MODELS');
    } catch (error) {
      setCustomTest({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveCustomConnection = async () => {
    if (customTest.phase !== 'tested') return;
    const trimmedName = customName.trim();
    const trimmedUrl = normalizeBaseUrl(customBaseUrl);
    const providerId = slugifyCustomProvider(customStandard, trimmedName);
    setCustomTest({
      phase: 'saving',
      models: customTest.models,
      selected: customTest.selected,
    });
    const ok = await connectApiKey(providerId, customKey.trim(), customTest.selected, {
      models: customTest.models,
      label: trimmedName,
      protocol: customStandard,
      baseUrl: trimmedUrl,
      isCustom: true,
    });
    if (!ok) {
      setCustomTest({ phase: 'error', message: 'SAVE_FAILED' });
      return;
    }
    closeCustomModal();
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
  }) => {
    const candidate = customModelInput.trim();
    if (!candidate || customModelState.phase === 'testing' || customModelState.phase === 'saving') {
      return;
    }
    setCustomModelState({ phase: 'testing' });
    try {
      await testProviderModel(
        {
          provider: context.provider,
          apiKey: context.apiKey,
          protocol: context.protocol,
          baseUrl: context.baseUrl,
        },
        candidate
      );
      setCustomModelState({ phase: 'verified', modelId: candidate });
    } catch (error) {
      setCustomModelState({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveCustomModelToConnectDraft = (isCustomProviderModal: boolean) => {
    if (customModelState.phase !== 'verified') return;
    const verifiedModel = customModelState.modelId;
    if (isCustomProviderModal) {
      setCustomTest((prev) => {
        if (prev.phase !== 'tested') {
          return { phase: 'tested', models: [verifiedModel], selected: verifiedModel };
        }
        const merged = Array.from(new Set([verifiedModel, ...prev.models]));
        return { phase: 'tested', models: merged, selected: verifiedModel };
      });
    } else {
      setTest((prev) => {
        if (prev.phase !== 'tested') {
          return { phase: 'tested', models: [verifiedModel], selected: verifiedModel };
        }
        const merged = Array.from(new Set([verifiedModel, ...prev.models]));
        return { phase: 'tested', models: merged, selected: verifiedModel };
      });
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

  const tested = test.phase === 'tested' || test.phase === 'saving';
  const busy = test.phase === 'testing' || test.phase === 'saving';

  const customTested = customTest.phase === 'tested' || customTest.phase === 'saving';
  const customBusy = customTest.phase === 'testing' || customTest.phase === 'saving';

  const activeEndpointUrl = activeProvider
    ? builtin?.baseUrl ?? activeItem?.baseUrl ?? ''
    : '';
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
          const modelCount = item.models?.length ?? (item.connected && item.modelName ? 1 : 0);
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
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
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
                disabled={busy || !draftKey.trim()}
                className={
                  test.phase === 'error'
                    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-600 bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50'
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
              <label className="field">
                <span className="field-label">{t.keyModelLabel}</span>
                <select
                  id="connected-provider-model-select"
                  value={activeItem.modelName}
                  onChange={(event) => void changeConnectedDefaultModel(event.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                >
                  {(activeItem.models && activeItem.models.length > 0
                    ? activeItem.models
                    : [activeItem.modelName]
                  ).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              {!getProviderSecret(activeItem.provider) && (
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
              )}

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
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
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
                        })
                      }
                      disabled={
                        !customModelInput.trim() ||
                        !activeSecret ||
                        customModelState.phase === 'testing'
                      }
                      className={
                        customModelState.phase === 'error'
                          ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50'
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
                  <p role="status" className="text-xs font-medium text-emerald-500">
                    {t.providerModelTestOk}
                  </p>
                )}
                {customModelState.phase === 'error' && (
                  <p role="alert" className="text-xs font-medium text-red-500">
                    {t.providerModelTestFail}
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
                    setDraftKey(event.target.value);
                    setTest({ phase: 'idle' });
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                />
              </label>

              {test.phase === 'error' && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-500"
                >
                  {errorText(t as unknown as Record<string, string>, test.message)}
                </p>
              )}

              {(test.phase === 'tested' || test.phase === 'saving') && (
                <div className="space-y-4">
                  <p
                    role="status"
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-500"
                  >
                    {t.keyTestOk}
                  </p>

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
                          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
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
                              apiKey: draftKey.trim(),
                              protocol: builtin?.protocol ?? activeItem?.protocol,
                              baseUrl: activeEndpointUrl,
                            })
                          }
                          disabled={!customModelInput.trim() || customModelState.phase === 'testing'}
                          className={
                            customModelState.phase === 'error'
                              ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50'
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
                      <p role="status" className="text-xs font-medium text-emerald-500">
                        {t.providerModelTestOk}
                      </p>
                    )}
                    {customModelState.phase === 'error' && (
                      <p role="alert" className="text-xs font-medium text-red-500">
                        {t.providerModelTestFail}
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
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
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
                  customBusy || !customName.trim() || !customBaseUrl.trim() || !customKey.trim()
                }
                className={
                  customTest.phase === 'error'
                    ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-600 bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50'
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
                  setCustomTest({ phase: 'idle' });
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
                  setCustomTest({ phase: 'idle' });
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
                setCustomTest({ phase: 'idle' });
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
                setCustomTest({ phase: 'idle' });
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
            />
          </label>

          {customTest.phase === 'error' && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-500"
            >
              {errorText(t as unknown as Record<string, string>, customTest.message)}
            </p>
          )}

          {(customTest.phase === 'tested' || customTest.phase === 'saving') && (
            <div className="space-y-4">
              <p
                role="status"
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-500"
              >
                {t.keyTestOk}
              </p>
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
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
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
                      apiKey: customKey.trim(),
                      protocol: customStandard,
                      baseUrl: normalizeBaseUrl(customBaseUrl),
                    });
                  }}
                  disabled={
                    !customModelInput.trim() ||
                    !customBaseUrl.trim() ||
                    !customKey.trim() ||
                    customModelState.phase === 'testing'
                  }
                  className={
                    customModelState.phase === 'error'
                      ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50'
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
              <p role="status" className="text-xs font-medium text-emerald-500">
                {t.providerModelTestOk}
              </p>
            )}
            {customModelState.phase === 'error' && (
              <p role="alert" className="text-xs font-medium text-red-500">
                {t.providerModelTestFail}
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
