'use client';

/**
 * Per-bot configuration form inside BotSettingsPanel (name, instruction, provider, model, 2-step delete).
 */

import React, { useMemo, useState } from 'react';
import { Check, KeyRound, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { modelLabel, providerLabel } from '../../data/catalog';
import type { UserBot } from '../../types';
import {
  buildProviderOptions,
  draftFromBot,
  fill,
  isDraftDirty,
  normalizeDraft,
  pickModelOnProviderChange,
  validateDraft,
  type BotDraft,
  type DraftError,
} from '../../bot-settings-panel-logic';
import { draftErrorLabel } from './useBotSettingsStore';

export const BotEditor: React.FC<{ bot: UserBot; onDeleted: (botId: string) => void }> = ({
  bot,
  onDeleted,
}) => {
  const { apiKeys, updateBot, deleteBot, setCurrentView, t } = useApp();
  const [draft, setDraft] = useState<BotDraft>(() => draftFromBot(bot));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<DraftError | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const providerOptions = useMemo(
    () => buildProviderOptions(apiKeys, { provider: draft.provider, model: draft.model }, providerLabel),
    [apiKeys, draft.provider, draft.model]
  );
  const activeOption = providerOptions.find((option) => option.provider === draft.provider);
  const hasConnected = providerOptions.some((option) => option.connected);
  const dirty = isDraftDirty(bot, draft);

  const patch = (next: Partial<BotDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus('idle');
    setError(null);
  };

  const resetDraft = () => {
    setDraft(draftFromBot(bot));
    setStatus('idle');
    setError(null);
  };

  const onProviderChange = (provider: string) => {
    const option = providerOptions.find((item) => item.provider === provider);
    patch({ provider, model: pickModelOnProviderChange(option, draft.model) });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'saving') return;
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setStatus('saving');
    const next = normalizeDraft(draft);
    const saved = await updateBot(bot.id, next);
    if (saved) {
      setDraft(draftFromBot(saved));
      setStatus('saved');
    } else {
      setStatus('error');
    }
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    await deleteBot(bot.id);
    setDeleting(false);
    setConfirmingDelete(false);
    onDeleted(bot.id);
  };

  const idBase = `bot-settings-${bot.id}`;

  return (
    <form
      onSubmit={(event) => void save(event)}
      data-bot-settings-form={bot.id}
      className="space-y-5"
      noValidate
    >
      <label className="field">
        <span className="field-label">{t.wsNameLabel}</span>
        <input
          id={`${idBase}-name`}
          data-bot-settings-name
          value={draft.name}
          maxLength={80}
          onChange={(event) => patch({ name: event.target.value })}
          aria-invalid={error === 'name'}
          className="!min-h-11 !rounded-xl !px-3 !py-2 !text-sm"
        />
      </label>

      <label className="field">
        <span className="field-label">{t.wsInstructionLabel}</span>
        <textarea
          id={`${idBase}-instruction`}
          data-bot-settings-instruction
          value={draft.instruction}
          rows={6}
          maxLength={4000}
          onChange={(event) => patch({ instruction: event.target.value })}
          aria-invalid={error === 'instruction'}
          className="!min-h-32 !rounded-xl !px-3 !py-2 !text-sm leading-relaxed"
        />
      </label>

      {hasConnected ? (
        <div className="grid gap-4">
          <label className="field">
            <span className="field-label">{t.wsProviderLabel}</span>
            <select
              id={`${idBase}-provider`}
              data-bot-settings-provider
              value={draft.provider}
              onChange={(event) => onProviderChange(event.target.value)}
              className="!min-h-11 !rounded-xl !px-3 !py-2 !text-sm"
            >
              {providerOptions.map((option) => (
                <option key={option.provider} value={option.provider}>
                  {option.connected
                    ? option.label
                    : fill(t.wsProviderDisconnected, { label: option.label })}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t.wsModelLabel}</span>
            <select
              id={`${idBase}-model`}
              data-bot-settings-model
              value={draft.model}
              onChange={(event) => patch({ model: event.target.value })}
              className="!min-h-11 !rounded-xl !px-3 !py-2 !text-sm"
            >
              {(activeOption?.models ?? [draft.model]).map((model) => (
                <option key={model} value={model}>
                  {modelLabel(model)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-sm leading-relaxed text-ink-muted">{t.wsNoProviders}</p>
          <button
            type="button"
            onClick={() => setCurrentView('api-keys')}
            className="button-secondary min-h-11 w-full !px-4 !py-2 text-sm"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t.wsGoToKeys}
          </button>
        </div>
      )}

      <div aria-live="polite" className="min-h-5 text-sm">
        {error ? (
          <p role="alert" className="font-medium text-terracotta">
            {draftErrorLabel(t, error)}
          </p>
        ) : status === 'error' ? (
          <p role="alert" className="font-medium text-terracotta">
            {t.wsSaveFailed}
          </p>
        ) : status === 'saved' && !dirty ? (
          <p className="inline-flex items-center gap-1.5 font-medium text-sage">
            <Check className="h-4 w-4" aria-hidden="true" />
            {t.wsSaved}
          </p>
        ) : dirty ? (
          <p className="text-ink-muted">{t.wsUnsaved}</p>
        ) : null}
      </div>

      <div className={dirty ? 'grid grid-cols-[1fr_auto] gap-2' : ''}>
        <button
          type="submit"
          data-bot-settings-save
          disabled={!dirty || status === 'saving'}
          className="button-primary min-h-11 w-full !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
        >
          {status === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {status === 'saving' ? t.wsSaving : t.wsSave}
        </button>
        {dirty && (
          <button
            type="button"
            data-bot-settings-reset
            disabled={status === 'saving'}
            onClick={resetDraft}
            aria-label={t.wsReset}
            title={t.wsReset}
            className="button-secondary min-h-11 shrink-0 !px-3 !py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>{t.wsReset}</span>
          </button>
        )}
      </div>

      <div className="border-t border-border pt-4">
        {confirmingDelete ? (
          <div
            role="alertdialog"
            aria-label={t.wsDeleteBot}
            data-bot-settings-delete-confirm
            className="space-y-3 rounded-xl border border-terracotta/40 bg-terracotta/10 p-3"
          >
            <p className="text-sm leading-relaxed text-ink">
              {fill(t.wsDeleteConfirmBody, { name: bot.name })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="button-secondary min-h-11 !px-3 !py-2 text-sm"
              >
                {t.wsDeleteCancel}
              </button>
              <button
                type="button"
                data-bot-settings-delete-yes
                onClick={() => void remove()}
                disabled={deleting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-terracotta px-3 py-2 text-sm font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {deleting ? t.wsDeleting : t.wsDeleteConfirm}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-bot-settings-delete
            onClick={() => setConfirmingDelete(true)}
            className="button-danger min-h-11 w-full !px-4 !py-2 text-sm"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t.wsDeleteBot}
          </button>
        )}
      </div>
    </form>
  );
};
