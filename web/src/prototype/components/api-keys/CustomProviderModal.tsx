/**
 * Modal for connecting a custom OpenAI-compatible or Anthropic-compatible BYOK gateway.
 */

import React from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { sanitizeApiKey } from '@/lib/byok/verify';
import { useApp } from '../../context/AppContext';
import { normalizeBaseUrl } from '../../chat/byok';
import { Modal } from '../Modal';
import { CustomModelBox } from './CustomModelBox';
import { errorText, warningText, type CustomModelState, type TestState } from './helpers';

interface CustomProviderModalProps {
  isOpen: boolean;
  customStandard: 'openai' | 'anthropic';
  customName: string;
  customBaseUrl: string;
  customKey: string;
  customTest: TestState;
  customTested: boolean;
  customBusy: boolean;
  customModelInput: string;
  customModelState: CustomModelState;
  onClose: () => void;
  onChangeStandard: (next: 'openai' | 'anthropic') => void;
  onChangeName: (next: string) => void;
  onChangeBaseUrl: (next: string) => void;
  onChangeKey: (next: string) => void;
  onTest: () => void;
  onBackFromTest: () => void;
  onSave: () => void;
  onSelectModel: (model: string) => void;
  onCustomModelInputChange: (next: string) => void;
  onTestCustomModel: () => void;
  onSaveCustomModel: () => void;
}

export const CustomProviderModal: React.FC<CustomProviderModalProps> = ({
  isOpen,
  customStandard,
  customName,
  customBaseUrl,
  customKey,
  customTest,
  customTested,
  customBusy,
  customModelInput,
  customModelState,
  onClose,
  onChangeStandard,
  onChangeName,
  onChangeBaseUrl,
  onChangeKey,
  onTest,
  onBackFromTest,
  onSave,
  onSelectModel,
  onCustomModelInputChange,
  onTestCustomModel,
  onSaveCustomModel,
}) => {
  const { t } = useApp();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.providerCustomTitle}
      description={t.providerCustomBody}
      closeLabel={t.close}
      footer={
        customTested ? (
          <>
            <button
              type="button"
              onClick={onBackFromTest}
              disabled={customBusy}
              className="button-secondary min-h-11 justify-center"
            >
              {t.keyBack}
            </button>
            <button
              type="button"
              id="custom-provider-save-btn"
              onClick={onSave}
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
              onClick={onClose}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              id="custom-provider-test-btn"
              onClick={onTest}
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
              onClick={() => onChangeStandard('openai')}
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
              onClick={() => onChangeStandard('anthropic')}
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
            onChange={(event) => onChangeName(event.target.value)}
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
            onChange={(event) => onChangeBaseUrl(event.target.value)}
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
            onChange={(event) => onChangeKey(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
          />
        </label>

        {customTest.phase === 'error' && (
          <p
            role="alert"
            className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
          >
            {errorText(t, customTest.message)}
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
            {warningText(t, customTest.warning) && (
              <p
                id="custom-provider-test-warning"
                className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-medium text-ink"
              >
                {warningText(t, customTest.warning)}
              </p>
            )}
            {customTest.phase === 'tested' && customTest.saveError && (
              <p
                role="alert"
                id="custom-provider-save-error"
                className="rounded-lg border border-terracotta/50 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta"
              >
                {errorText(t, customTest.saveError, t.apiVerifySaveFailed)}
              </p>
            )}
            <label className="field">
              <span className="field-label">{t.keyModelLabel}</span>
              <select
                id="custom-provider-model-select"
                value={customTest.selected}
                disabled={customTest.phase === 'saving'}
                onChange={(event) => onSelectModel(event.target.value)}
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

        <CustomModelBox
          inputId="custom-provider-model-input"
          testBtnId="custom-provider-model-test-btn"
          saveBtnId="custom-provider-model-save-btn"
          value={customModelInput}
          state={customModelState}
          testDisabled={
            !customModelInput.trim() ||
            !normalizeBaseUrl(customBaseUrl) ||
            !sanitizeApiKey(customKey) ||
            customModelState.phase === 'testing'
          }
          onChange={onCustomModelInputChange}
          onTest={onTestCustomModel}
          onSave={onSaveCustomModel}
        />
      </div>
    </Modal>
  );
};
