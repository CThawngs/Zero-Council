import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2 } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-surface border border-border shadow-lg rounded-md px-4 py-3 flex items-center gap-3 text-xs text-ink max-w-sm">
        <CheckCircle2 className="w-4 h-4 text-brass shrink-0" />
        <span className="leading-snug">{toastMessage}</span>
      </div>
    </div>
  );
};
