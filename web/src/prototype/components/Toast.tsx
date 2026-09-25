import React from 'react';
import { useApp } from '../context/AppContext';
import { providerLabel } from '../data/mockData';
import { copy } from '../i18n';
import { ModelProvider } from '../types';
import { CheckCircle2 } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage, language } = useApp();
  const values = toastMessage?.values ? { ...toastMessage.values } : undefined;
  if (toastMessage?.key === 'toastPersona' && values?.name) {
    values.name = copy[language].samplePersonaName.replace('{name}', values.name);
  }
  if ((toastMessage?.key === 'toastProviderOn' || toastMessage?.key === 'toastProviderOff') && values?.provider) {
    values.provider = providerLabel(values.provider as ModelProvider, language);
  }
  const message = toastMessage
    ? copy[language][toastMessage.key].replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? '')
    : null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[60] flex justify-end sm:left-auto sm:right-6" role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div className="toast-enter flex max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-snug text-ink shadow-2xl">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
          <span className="min-w-0 break-words">{message}</span>
        </div>
      )}
    </div>
  );
};
