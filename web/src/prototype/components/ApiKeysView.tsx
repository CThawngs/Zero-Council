import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModelProvider } from '../types';
import { modelLabel, providerLabel } from '../data/mockData';
import { Check, LockKeyhole, RotateCcw } from 'lucide-react';
import { Modal } from './Modal';

export const ApiKeysView: React.FC = () => {
  const { apiKeys, connectApiKey, removeApiKey, revokeAllKeys, language, t } = useApp();
  const [activeProvider, setActiveProvider] = useState<ModelProvider | null>(null);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const activeItem = activeProvider ? apiKeys.find((key) => key.provider === activeProvider) : undefined;
  const toggle = () => {
    if (!activeProvider || !activeItem) return;
    if (activeItem.connected) removeApiKey(activeProvider); else connectApiKey(activeProvider);
    setActiveProvider(null);
  };

  return (
    <div className="content-shell space-y-7">
      <header className="page-header flex-col items-start sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow"><span className="status-dot" />{t.providersEyebrow}</p><h1>{t.providersTitle}</h1><p>{t.providersBody}</p></div>
        <button type="button" onClick={() => setIsClearOpen(true)} className="button-secondary min-h-11 shrink-0"><RotateCcw className="h-4 w-4" />{t.clearStates}</button>
      </header>

      <div className="panel flex gap-3 p-4 sm:p-5"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brass" /><div><h2 className="font-medium text-ink">{t.noCredentialTitle}</h2><p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.noCredentialBody}</p></div></div>

      <div className="grid gap-4">
        {apiKeys.map((item) => (
          <article key={item.provider} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-lg text-ink">{providerLabel(item.provider, language)}</h2><span className="badge-neutral">{modelLabel(item.modelName, language)}</span><span className={item.connected ? 'badge-success' : 'badge-muted'}>{item.connected ? t.stateOn : t.stateOff}</span></div><p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.connected ? t.stateOnBody : t.stateOffBody}</p></div>
            <button type="button" onClick={() => setActiveProvider(item.provider)} className={item.connected ? 'button-secondary min-h-11 shrink-0 justify-center' : 'button-primary min-h-11 shrink-0 justify-center'} aria-label={`${item.connected ? t.clearState : t.toggleState}: ${providerLabel(item.provider, language)}`}>{item.connected ? <><RotateCcw className="h-4 w-4" />{t.clearState}</> : <><Check className="h-4 w-4" />{t.toggleState}</>}</button>
          </article>
        ))}
      </div>

      <Modal
        isOpen={activeProvider !== null}
        onClose={() => setActiveProvider(null)}
        title={t.dialogTitle}
        description={t.dialogBody}
        closeLabel={t.close}
        footer={
          <>
            <button type="button" onClick={() => setActiveProvider(null)} className="button-secondary min-h-11 justify-center">{t.cancel}</button>
            <button type="button" onClick={toggle} className="button-primary min-h-11 justify-center">{t.toggle}</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{activeItem?.connected ? t.stateOnBody : t.stateOffBody}</p>
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
            <button type="button" onClick={() => { setIsClearOpen(false); revokeAllKeys(); }} className="button-danger min-h-11 justify-center">{t.clearStates}</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearStatesConfirm}</p>
      </Modal>
    </div>
  );
};
