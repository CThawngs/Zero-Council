import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, Copy } from 'lucide-react';
import { Modal } from './Modal';

export const CounterDraftModal: React.FC = () => {
  const { isCounterDraftModalOpen, closeCounterDraftModal, showToast, t } = useApp();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(t.sampleContent);
      setCopied(true);
      showToast('toastCopied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('toastCopyFailed');
    }
  };
  return (
    <Modal
      isOpen={isCounterDraftModalOpen}
      onClose={closeCounterDraftModal}
      title={t.draftTitle}
      description={t.draftBody}
      closeLabel={t.close}
      footer={<><button type="button" onClick={closeCounterDraftModal} className="button-secondary min-h-11">{t.close}</button><button type="button" onClick={copy} className="button-primary min-h-11">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t.copied : t.copyDraft}</button></>}
    >
      <div className="space-y-4"><div className="rounded-lg border border-border bg-background/60 p-4"><p className="field-label">{t.purpose}</p><p className="mt-1 text-sm text-ink">{t.purposeValue}</p></div><div><label htmlFor="counter-draft-preview" className="field-label">{t.previewDraft}</label><textarea id="counter-draft-preview" readOnly rows={8} value={t.sampleContent} className="field mt-2 resize-none leading-relaxed" /></div><p className="text-xs leading-relaxed text-ink-muted">{t.draftWarning}</p></div>
    </Modal>
  );
};
