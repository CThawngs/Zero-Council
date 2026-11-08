import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { Check, Loader2 } from 'lucide-react';
import type { ModelProvider } from '../types';

export const BotWizardView: React.FC = () => {
  const { apiKeys, createBot, openBotChat, setCurrentView, t } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [provider, setProvider] = useState<ModelProvider | null>(null);
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const connected = apiKeys.filter((key) => key.connected);
  const total = 3;

  const nextFromIdentity = () => {
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
    const bot = await createBot({ name: name.trim(), instruction: instruction.trim(), provider, model });
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
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
          <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
          {t.botWizardEyebrow} · {t.botStepOf.replace('{step}', String(step)).replace('{total}', String(total))}
        </p>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{t.botWizardTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">{t.botWizardBody}</p>
      </header>

      <div className="space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
        {step === 1 && (
          <div className="space-y-5">
            <label className="field">
              <span className="field-label">{t.botNameLabel}</span>
              <input
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
                <button type="button" onClick={() => setCurrentView('api-keys')} className="button-primary min-h-11">
                  {t.botConnectFirst}
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {connected.map((key) => (
                    <button
                      key={key.provider}
                      type="button"
                      onClick={() => {
                        setProvider(key.provider);
                        setModel(key.modelName);
                      }}
                      aria-pressed={provider === key.provider}
                      className={`min-h-11 rounded-xl border px-4 text-left text-sm font-semibold ${provider === key.provider ? 'border-brass bg-brass/10 text-ink' : 'border-border text-ink-muted hover:text-ink'}`}
                    >
                      {providerLabel(key.provider)} · {modelLabel(key.modelName)}
                    </button>
                  ))}
                </div>
                {provider && (
                  <label className="field">
                    <span className="field-label">{t.botModelLabel}</span>
                    <input value={model} readOnly />
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
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">{t.botNameLabel}</dt><dd className="font-semibold text-ink">{name.trim()}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">{t.botModelLabel}</dt><dd className="font-semibold text-ink">{providerLabel(provider)} · {modelLabel(model)}</dd></div>
              <div><dt className="text-ink-muted">{t.botInstructionLabel}</dt><dd className="mt-1 whitespace-pre-wrap text-ink">{instruction.trim()}</dd></div>
            </dl>
          </div>
        )}

        {error && <p role="alert" className="text-sm font-medium text-terracotta">{error}</p>}

        <div className="flex gap-3">
          {step > 1 && (
            <button type="button" onClick={() => { setError(''); setStep(step - 1); }} className="button-secondary min-h-11">
              {t.botBack}
            </button>
          )}
          {step < 3 ? (
            <button type="button" onClick={step === 1 ? nextFromIdentity : nextFromModel} disabled={step === 2 && connected.length === 0} className="button-primary min-h-11 flex-1 justify-center">
              {t.botNext}
            </button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={creating} className="button-primary min-h-11 flex-1 justify-center">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{creating ? t.botCreating : t.botCreate}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
