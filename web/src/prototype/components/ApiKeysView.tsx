import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModelProvider } from '../types';
import { getProviders, Provider } from '../chat/byok';
import { Check, Eye, EyeOff, LockKeyhole, RotateCcw } from 'lucide-react';
import { Modal } from './Modal';

export const ApiKeysView: React.FC = () => {
  const { apiKeys, removeApiKey, revokeAllKeys, t } = useApp();

  const [activeProvider, setActiveProvider] = useState<ModelProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load providers from Supabase
  useEffect(() => {
    let cancelled = false;

    const loadProviders = async () => {
      try {
        const data = await getProviders();

        if (!cancelled) {
          setProviders(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load providers.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeItem = activeProvider
  ? apiKeys.find((key) => key.provider === activeProvider)
  : undefined;

  const provider = activeProvider
  ? providers.find((p) => p.id === activeProvider)
  : undefined;

  // Reset modal state
  const closeModal = () => {
    setActiveProvider(null)
    setDraftKey('')
    setError('')
    setMessage('')
    setShowPassword(false)
  }

  /**
   * 
   */
  const toggle = async () => {
    if (!activeProvider || !activeItem) return

    if (activeItem.connected) {
      removeApiKey(activeProvider)
      closeModal()
      return
    }

    await saveAPIKey()
  };

  // Save and verify API key
  const saveAPIKey = async () => {
    if (!activeProvider || !provider || !draftKey.trim()) {
      setError('Please enter an API key.');
      return;
    }

    // Basic prefix validation
    if (
      provider.keyPrefix &&
      !draftKey.trim().startsWith(provider.keyPrefix)
    ) {
      setError(`Invalid API key format. Expected prefix: ${provider.keyPrefix}`);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/user/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: activeProvider,
          apiKey: draftKey.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to save API key.');
      }

      setMessage('API key saved successfully.');

      // Close modal after successful save
      closeModal();

      // If AppContext was to stores key connection state,
      // refresh its state here instead of relying on local state.

    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.'
      );
    } finally {
      setSaving(false);
    }
  };
  

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

      <div className="panel flex gap-3 p-4 sm:p-5">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brass" />
        <div>
          <h2 className="font-medium text-ink">{t.noCredentialTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {t.noCredentialBody}
          </p>
        </div>
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
                    setActiveProvider(item.id as ModelProvider);
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

      <Modal
        isOpen={activeProvider !== null}
        onClose={closeModal}
        title={t.dialogTitle}
        description={t.dialogBody}
        closeLabel={t.close}
        footer={
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
              onClick={toggle}
              disabled={saving}
              className="button-primary min-h-11 justify-center"
            >
              {saving ? 'Saving...' : t.toggle}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          {activeItem?.connected ? t.stateOnBody : t.stateOffBody}
        </p>

        {!activeItem?.connected && (
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
                onChange={(event) => setDraftKey(event.target.value)}
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

        {message && (
          <p className="mt-3 text-sm text-green-600">{message}</p>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
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
                revokeAllKeys();
              }}
              className="button-danger min-h-11 justify-center"
            >
              {t.clearStates}
            </button>
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
