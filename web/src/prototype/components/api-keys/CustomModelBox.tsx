/**
 * Reusable custom model ID live-verification ("Test -> Save") input box for BYOK modals.
 */

import React from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { errorText, type CustomModelState } from './helpers';

interface CustomModelBoxProps {
  inputId: string;
  testBtnId: string;
  saveBtnId: string;
  value: string;
  state: CustomModelState;
  allowSavingPhase?: boolean;
  testDisabled: boolean;
  onChange: (next: string) => void;
  onTest: () => void;
  onSave: () => void;
}

export const CustomModelBox: React.FC<CustomModelBoxProps> = ({
  inputId,
  testBtnId,
  saveBtnId,
  value,
  state,
  allowSavingPhase = false,
  testDisabled,
  onChange,
  onTest,
  onSave,
}) => {
  const { t } = useApp();
  const showSave =
    state.phase === 'verified' || (allowSavingPhase && state.phase === 'saving');

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-background/60 p-3.5">
      <label htmlFor={inputId} className="field-label block">
        {t.providerCustomModelLabel}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="text"
          value={value}
          placeholder={t.providerCustomModelPlaceholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brass"
        />
        {showSave ? (
          <button
            type="button"
            id={saveBtnId}
            onClick={onSave}
            disabled={state.phase === 'saving'}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {state.phase === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {t.providerModelSave}
          </button>
        ) : (
          <button
            type="button"
            id={testBtnId}
            onClick={onTest}
            disabled={testDisabled}
            className={
              state.phase === 'error'
                ? 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-700 bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50'
                : 'button-secondary min-h-10 shrink-0 justify-center text-xs disabled:opacity-50'
            }
          >
            {state.phase === 'testing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : state.phase === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {t.providerModelTest}
          </button>
        )}
      </div>
      {state.phase === 'verified' && (
        <p role="status" className="text-xs font-medium text-sage">
          {t.providerModelTestOk}
        </p>
      )}
      {state.phase === 'error' && (
        <p role="alert" className="text-xs font-medium text-terracotta">
          {errorText(t, state.message, t.providerModelTestFail)}
        </p>
      )}
    </div>
  );
};
