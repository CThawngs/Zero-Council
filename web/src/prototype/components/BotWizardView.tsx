import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { planById } from '../data/plans';
import { Check, Loader2, Lock } from 'lucide-react';
import type { ModelProvider } from '../types';

export const BotWizardView: React.FC = () => {
  const {
    apiKeys,
    bots,
    botCap,
    canCreateBot,
    currentPlanId,
    goToPricing,
    createBot,
    openBotChat,
    setCurrentView,
    language,
    t,
  } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [provider, setProvider] = useState<ModelProvider | null>(null);
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const connected = apiKeys.filter((key) => key.connected);
  const selectedKey = provider ? connected.find((k) => k.provider === provider) : undefined;
  const availableModels = selectedKey
    ? selectedKey.models && selectedKey.models.length > 0
      ? selectedKey.models
      : [selectedKey.modelName].filter(Boolean)
    : [];
  const total = 3;
  const plan = planById(currentPlanId);
  const nextBotNumber = Math.min(bots.length + 1, botCap);
  const remainingBots = Math.max(0, botCap - bots.length);

  const nextFromIdentity = () => {
    if (!canCreateBot) {
      return setError(
        t.botCapReachedHint
          .replace('{plan}', plan.name)
          .replace('{cap}', String(botCap))
      );
    }
    if (!name.trim()) return setError(t.botErrorName);
    if (!instruction.trim()) return setError(t.botErrorInstruction);
    setError('');
    setStep(2);
  };

  const nextFromModel = () => {
    if (!provider || !model) return setError(t.botErrorModel);
    setError('');
    setStep(3);
  };

  const submit = async () => {
    if (!provider || !model || creating) return;
    setCreating(true);
    const bot = await createBot({
      name: name.trim(),
      instruction: instruction.trim(),
      provider,
      model,
    });
    setCreating(false);
    if (!bot) {
      setError(t.botErrorSave);
      return;
    }
    openBotChat(bot.id);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-7 py-4 sm:py-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
            {t.botWizardEyebrow} ·{' '}
            {t.botStepOf.replace('{step}', String(step)).replace('{total}', String(total))}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-muted">
            <span className="font-semibold text-ink">
              {language === 'vi' ? `Bot thứ ${nextBotNumber}` : `Bot #${nextBotNumber}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {language === 'vi'
                ? `Còn lại ${remainingBots}/${botCap}`
                : `${remainingBots}/${botCap} left`}
            </span>
          </span>
        </div>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{t.botWizardTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">{t.botWizardBody}</p>
      </header>

      {!canCreateBot && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-brass/40 bg-brass/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2 text-sm text-ink">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
            <span>
              {t.botCapReachedHint
                .replace('{plan}', plan.name)
                .replace('{cap}', String(botCap))}
            </span>
          </p>
          <button type="button" onClick={goToPricing} className="button-primary min-h-10 shrink-0">
            {t.pricingTitle}
          </button>
        </div>
      )}

      <div className="space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
        {step === 1 && (
          <div className="space-y-5">
            <label className="field">
              <span className="field-label">{t.botNameLabel}</span>
              <input
                id="bot-wizard-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.botNamePlaceholder}
                maxLength={80}
              />
              <span className="text-xs text-ink-muted">{t.botNameHint}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.botInstructionLabel}</span>
              <textarea
                id="bot-wizard-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder={t.botInstructionPlaceholder}
                rows={6}
                maxLength={4000}
              />
              <span className="text-xs text-ink-muted">{t.botInstructionHint}</span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-xl text-ink">{t.botStepModelTitle}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t.botStepModelBody}</p>
            </div>
            {connected.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-ink-muted">{t.botNoProvider}</p>
                <button
                  type="button"
                  onClick={() => setCurrentView('api-keys')}
                  className="button-primary min-h-11"
                >
                  {t.botConnectFirst}
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {connected.map((key) => {
                    const displayLabel = key.label || providerLabel(key.provider);
                    return (
                      <button
                        key={key.provider}
                        type="button"
                        onClick={() => {
                          setProvider(key.provider);
                          setModel(key.modelName || key.models?.[0] || '');
                        }}
                        aria-pressed={provider === key.provider}
                        className={`min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm font-semibold ${
                          provider === key.provider
                            ? 'border-brass bg-brass/10 text-ink'
                            : 'border-border text-ink-muted hover:text-ink'
                        }`}
                      >
                        <span className="block truncate">{displayLabel}</span>
                        <span className="block truncate text-xs font-normal text-ink-muted">
                          {modelLabel(key.modelName)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {provider && (
                  <label className="field">
                    <span className="field-label">{t.botModelLabel}</span>
                    <select
                      id="bot-wizard-model-select"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-ink-muted">{t.botSelectModelHint}</span>
                  </label>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && provider && (
          <div className="space-y-4">
            <h2 className="font-serif text-xl text-ink">{t.botReviewTitle}</h2>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">{t.botNameLabel}</dt>
                <dd className="font-semibold text-ink">{name.trim()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">{t.botModelLabel}</dt>
                <dd className="font-semibold text-ink">
                  {(selectedKey?.label || providerLabel(provider))} · {modelLabel(model)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.botInstructionLabel}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink">{instruction.trim()}</dd>
              </div>
            </dl>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-terracotta">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep(step - 1);
              }}
              className="button-secondary min-h-11"
            >
              {t.botBack}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              id="bot-wizard-next"
              onClick={step === 1 ? nextFromIdentity : nextFromModel}
              disabled={(step === 1 && !canCreateBot) || (step === 2 && connected.length === 0)}
              className="button-primary min-h-11 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t.botNext}
            </button>
          ) : (
            <button
              type="button"
              id="bot-wizard-submit"
              onClick={() => void submit()}
              disabled={creating || !canCreateBot}
              className="button-primary min-h-11 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {creating ? t.botCreating : t.botCreate}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
