/**
 * Connect and Manage modal for built-in or previously saved BYOK providers.
 */

import React from 'react';
import { AlertCircle, Check, Loader2, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { sanitizeApiKey } from '@/lib/byok/verify';
import { useApp } from '../../context/AppContext';
import { providerLabel } from '../../data/catalog';
import { builtinProviderById } from '../../chat/byok';
import { visibleModelsForProvider } from '../../chat/modelAllowList';
import type { ApiKeyConfig, ModelProvider } from '../../types';
import { Modal } from '../Modal';
import { CustomModelBox } from './CustomModelBox';
import {
  errorText,
  warningText,
  type CustomModelState,
  type RetestState,
  type TestState,
} from './helpers';

interface ProviderManageModalProps {
  activeProvider: ModelProvider | null;
  activeItem: ApiKeyConfig | undefined;
  activeEndpointUrl: string;
  activeSecret: string;
  draftKey: string;
  test: TestState;
  tested: boolean;
  busy: boolean;
  retest: RetestState;
  customModelInput: string;
  customModelState: CustomModelState;
  onClose: () => void;
  onDraftKeyChange: (next: string, resetTest: boolean) => void;
  onTestConnection: () => void;
  onBackFromTest: () => void;
  onSaveConnection: () => void;
  onSelectTestedModel: (model: string) => void;
  onRetestConnection: () => void;
  onDisconnect: () => void;
  onChangeConnectedModel: (model: string) => void;
  onCustomModelInputChange: (next: string) => void;
  onTestConnectedCustomModel: () => void;
  onSaveConnectedCustomModel: () => void;
  onTestConnectDraftCustomModel: () => void;
  onSaveConnectDraftCustomModel: () => void;
}

export const ProviderManageModal: React.FC<ProviderManageModalProps> = ({
  activeProvider,
  activeItem,
  activeEndpointUrl,
  activeSecret,
  draftKey,
  test,
  tested,
  busy,
  retest,
  customModelInput,
  customModelState,
  onClose,
  onDraftKeyChange,
  onTestConnection,
  onBackFromTest,
  onSaveConnection,
  onSelectTestedModel,
  onRetestConnection,
  onDisconnect,
  onChangeConnectedModel,
  onCustomModelInputChange,
  onTestConnectedCustomModel,
  onSaveConnectedCustomModel,
  onTestConnectDraftCustomModel,
  onSaveConnectDraftCustomModel,
}) => {
  const { getProviderSecret, t } = useApp();
  const builtin = activeProvider ? builtinProviderById(activeProvider) : undefined;
  const hasStoredSecret = activeItem ? Boolean(getProviderSecret(activeItem.provider)) : false;

  return (
    <Modal
      isOpen={activeProvider !== null}
      onClose={onClose}
      title={activeItem?.label || (activeProvider ? providerLabel(activeProvider) : t.dialogTitle)}
      description={t.dialogBody}
      closeLabel={t.close}
      footer={
        activeItem?.connected ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="button-secondary min-h-11 justify-center"
            >
              {t.close}
            </button>
            <button
              type="button"
              id="provider-retest-btn"
              onClick={onRetestConnection}
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
              onClick={onDisconnect}
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
              onClick={onBackFromTest}
              disabled={busy}
              className="button-secondary min-h-11 justify-center"
            >
              {t.keyBack}
            </button>
            <button
              type="button"
              id="provider-save-btn"
              onClick={onSaveConnection}
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
              onClick={onClose}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              id="provider-test-btn"
              onClick={onTestConnection}
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
                {errorText(t, retest.message)}
              </p>
            )}
            <label className="field">
              <span className="field-label">{t.keyModelLabel}</span>
              <select
                id="connected-provider-model-select"
                value={activeItem.modelName}
                onChange={(event) => onChangeConnectedModel(event.target.value)}
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

            {activeItem.hasKey && !hasStoredSecret ? (
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
            ) : !hasStoredSecret ? (
              <label className="field">
                <span className="field-label">{t.keyLabel}</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={draftKey}
                  placeholder={builtin?.keyHint ?? 'sk-…'}
                  onChange={(e) => onDraftKeyChange(e.target.value, false)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                />
              </label>
            ) : null}

            <CustomModelBox
              inputId="custom-model-input"
              testBtnId="custom-model-test-btn"
              saveBtnId="custom-model-save-btn"
              value={customModelInput}
              state={customModelState}
              allowSavingPhase
              testDisabled={
                !customModelInput.trim() ||
                (!activeSecret && !activeItem.hasKey) ||
                customModelState.phase === 'testing'
              }
              onChange={onCustomModelInputChange}
              onTest={onTestConnectedCustomModel}
              onSave={onSaveConnectedCustomModel}
            />
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
                onChange={(event) => onDraftKeyChange(event.target.value, true)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
              />
            </label>

            {test.phase === 'error' && (
              <p
                role="alert"
                className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
              >
                {errorText(t, test.message)}
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
                {warningText(t, test.warning) && (
                  <p
                    id="provider-test-warning"
                    className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-medium text-ink"
                  >
                    {warningText(t, test.warning)}
                  </p>
                )}
                {test.phase === 'tested' && test.saveError && (
                  <p
                    role="alert"
                    id="provider-save-error"
                    className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
                  >
                    {errorText(t, test.saveError, t.apiVerifySaveFailed)}
                  </p>
                )}

                <label className="field">
                  <span className="field-label">{t.keyModelLabel}</span>
                  <select
                    id="provider-model-select"
                    value={test.selected}
                    disabled={test.phase === 'saving'}
                    onChange={(event) => onSelectTestedModel(event.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                  >
                    {test.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>

                <CustomModelBox
                  inputId="connect-custom-model-input"
                  testBtnId="connect-custom-model-test-btn"
                  saveBtnId="connect-custom-model-save-btn"
                  value={customModelInput}
                  state={customModelState}
                  testDisabled={
                    !customModelInput.trim() ||
                    !sanitizeApiKey(draftKey) ||
                    customModelState.phase === 'testing'
                  }
                  onChange={onCustomModelInputChange}
                  onTest={onTestConnectDraftCustomModel}
                  onSave={onSaveConnectDraftCustomModel}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
