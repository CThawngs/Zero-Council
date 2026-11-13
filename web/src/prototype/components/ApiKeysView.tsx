import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModelProvider } from '../types';
import { modelLabel, providerLabel } from '../data/mockData';
import { Provider, fetchProviderModels, providerById } from '../chat/byok';
import { Check, Loader2, Eye, EyeOff, LockKeyhole, RotateCcw } from 'lucide-react';
import { Modal } from './Modal';
import { createClient } from '@/lib/supabase/client';

type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'tested'; models: string[]; selected: string }
  | { phase: 'error'; message: string }
  | { phase: 'saving'; models: string[]; selected: string };

const errorText = (t: Record<string, string>, state: TestState): string => {
  if (state.phase !== 'error') return '';
  switch (state.message) {
    case 'INVALID_KEY':
      return t.keyTestInvalid;
    case 'EMPTY_KEY':
      return t.keyTestEmpty;
    case 'NETWORK_FAILED':
      return t.keyTestNetwork;
    default:
      return t.keyTestFailed;
  }
};

export const ApiKeysView: React.FC = () => {
  const { apiKeys, connectApiKey, removeApiKey, revokeAllKeys, t } = useApp();

  const [activeProviderId, setActiveProviderId] = useState<ModelProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [test, setTest] = useState<TestState>({ phase: 'idle' });
  const activeItem = activeProviderId ? apiKeys.find((key) => key.provider === activeProviderId) : undefined;
  const provider = activeProviderId ? providerById(activeProviderId) : undefined;

  const openProvider = (next: ModelProvider) => {
    setActiveProvider(next);
    setDraftKey('');
    setTest({ phase: 'idle' });
  };

  const closeModal = () => {
    setActiveProvider(null);
    setDraftKey('');
    setTest({ phase: 'idle' });
  };

  const testConnection = async () => {
    if (!activeProviderId || test.phase === 'testing' || test.phase === 'saving') return;
    setTest({ phase: 'testing' });
    try {
      const models = await fetchProviderModels(activeProviderId, draftKey);
      if (models.length === 0) throw new Error('NO_MODELS');
      setTest({ phase: 'tested', models, selected: models[0] });
    } catch (error) {
      setTest({ phase: 'error', message: (error as Error).message });
    }
  };

  const save = async () => {
    if (!activeProviderId || test.phase !== 'tested') return;
    setTest({ phase: 'saving', models: test.models, selected: test.selected });
    const ok = await connectApiKey(activeProviderId, draftKey.trim(), test.selected);
    if (!ok) {
      setTest({ phase: 'error', message: 'SAVE_FAILED' });
      return;
    }
    closeModal();
  };

  const disconnect = async () => {
    if (!activeProviderId) return;
    await removeApiKey(activeProviderId);
    closeModal();
  };

  const tested = test.phase === 'tested' || test.phase === 'saving';
  const busy = test.phase === 'testing' || test.phase === 'saving';

  return (
    <div className="content-shell space-y-7">

      {/* Phần header luôn hiên ở trang này */}
      <header className="page-header flex-col items-start sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="status-dot" />
            {t.providersEyebrow}
          </p>
          <h1>{t.providersTitle}</h1>
          <p>{t.providersBody}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsClearOpen(true)}
          className="button-secondary min-h-11 shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          {t.clearStates}
        </button>
      </header>

      <div className="panel flex gap-3 p-4 sm:p-5"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brass" /><div><h2 className="font-medium text-ink">{t.noCredentialTitle}</h2><p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.noCredentialBody}</p></div></div>

      <div className="grid gap-4">
        {apiKeys.map((item) => (
          <article key={item.provider} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-lg text-ink">{providerLabel(item.provider)}</h2><span className="badge-neutral">{item.connected ? item.modelName : t.stateOff}</span><span className={item.connected ? 'badge-success' : 'badge-muted'}>{item.connected ? t.stateOn : t.stateOff}</span></div><p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.connected ? t.stateOnBody : t.stateOffBody}</p></div>
            <button type="button" onClick={() => openProvider(item.provider)} className={item.connected ? 'button-secondary min-h-11 shrink-0 justify-center' : 'button-primary min-h-11 shrink-0 justify-center'} aria-label={`${item.connected ? t.clearState : t.toggleState}: ${providerLabel(item.provider)}`}>{item.connected ? <><RotateCcw className="h-4 w-4" />{t.clearState}</> : <><Check className="h-4 w-4" />{t.toggleState}</>}</button>
          </article>
        ))}
      </div>

      {/* Danh sách các providers */}
      {loading ? (
        <p className="text-sm text-ink-muted">Loading providers...</p>
      ) : (
        <div className="grid gap-4">
          {providers.map((item) => {
            const connected = apiKeys.some(
              (key) => key.provider === item.id && key.connected
            );

            return (
              <article
                key={item.id}
                className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-lg text-ink">
                      {item.label}
                    </h2>

                    <span className={connected ? 'badge-success' : 'badge-muted'}>
                      {connected ? t.stateOn : t.stateOff}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {connected ? t.stateOnBody : t.stateOffBody}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveProviderId(item.id as ModelProvider);
                    setError('');
                    setMessage('');
                  }}
                  className={
                    connected
                      ? 'button-secondary min-h-11 shrink-0 justify-center'
                      : 'button-primary min-h-11 shrink-0 justify-center'
                  }
                >
                  {connected ? (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      {t.clearState}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {t.toggleState}
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/** Pop up hiện đ */}
      <Modal
        isOpen={activeProviderId !== null}
        onClose={closeModal}
        title={t.dialogTitle}
        description={t.dialogBody}
        closeLabel={t.close}
        footer={
          activeItem?.connected ? (
            <>
              <button type="button" onClick={closeModal} className="button-secondary min-h-11 justify-center">{t.cancel}</button>
              <button type="button" onClick={() => void disconnect()} className="button-danger min-h-11 justify-center">{t.clearState}</button>
            </>
          ) : tested ? (
            <>
              <button type="button" onClick={() => setTest({ phase: 'idle' })} disabled={busy} className="button-secondary min-h-11 justify-center">{t.keyBack}</button>
              <button type="button" onClick={() => void save()} disabled={busy} className="button-primary min-h-11 justify-center">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t.save}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={closeModal} className="button-secondary min-h-11 justify-center">{t.cancel}</button>
              <button type="button" onClick={() => void testConnection()} disabled={busy || !draftKey.trim()} className="button-primary min-h-11 justify-center">
                {test.phase === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t.keyTest}
              </button>
            </>
          )
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{activeItem?.connected ? t.stateOnBody : t.stateOffBody}</p>
        {!activeItem?.connected && !tested && (
          <label className="field mt-4">
            <span className="field-label">{t.keyLabel}</span>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                value={draftKey}
                placeholder={provider?.keyPrefix ?? ''}
                disabled={busy}
                onChange={(event) => { setDraftKey(event.target.value); setTest({ phase: 'idle' }); }}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2"
                aria-label={
                  showPassword ? t.authHidePassword : t.authShowPassword
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>
        )}
        {test.phase === 'error' && (
          <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {errorText(t as unknown as Record<string, string>, test)}
          </p>
        )}
        {(test.phase === 'tested' || test.phase === 'saving') && (
          <div className="mt-4">
            <p role="status" className="text-sm text-success">{t.keyTestOk}</p>
            <label className="field mt-3">
              <span className="field-label">{t.keyModelLabel}</span>
              <select
                value={test.selected}
                disabled={test.phase === 'saving'}
                onChange={(event) => setTest((current) => (current.phase === 'tested' ? { ...current, selected: event.target.value } : current))}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
              >
                {test.models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title={t.clearStates}
        description={t.clearStatesConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button type="button" onClick={() => setIsClearOpen(false)} className="button-secondary min-h-11 justify-center">{t.cancel}</button>
            <button type="button" onClick={() => { setIsClearOpen(false); void revokeAllKeys(); }} className="button-danger min-h-11 justify-center">{t.clearStates}</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          {t.clearStatesConfirm}
        </p>
      </Modal>
    </div>
  );
};
