import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModelProvider } from '../types';
import { ShieldCheck, Check, Trash2 } from 'lucide-react';

export const ApiKeysView: React.FC = () => {
  const { apiKeys, connectApiKey, removeApiKey, revokeAllKeys } = useApp();

  const [activeProvider, setActiveProvider] = useState<ModelProvider | null>(null);

  const handleOpenEnroll = (provider: ModelProvider) => {
    setActiveProvider(provider);
  };

  const handleSimulateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    connectApiKey(activeProvider);
    setActiveProvider(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <span className="text-xs font-mono text-brass font-medium">Provider slot preview</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-normal mt-1">
            Mock Provider Slots
          </h1>
          <p className="text-xs text-ink-muted">
            Provider slots and simulated connection states for a future BYOK design. No inference or provider request is connected.
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Clear all simulated provider connection states?')) {
              revokeAllKeys();
            }
          }}
          type="button"
          className="text-xs text-terracotta hover:underline flex items-center gap-1 self-start"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Mock States</span>
        </button>
      </div>

      {/* Security Enclave Note */}
      <div className="p-4 rounded-lg bg-surface border border-border flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-sage mt-0.5 shrink-0" />
        <div className="space-y-1 text-xs text-ink-muted">
          <p className="text-ink font-medium">Credential Safety</p>
          <p className="leading-relaxed">
            UI-only mock. This prototype has no credential input, persistence, transmission, or validation.
          </p>
        </div>
      </div>

      {/* 3 Provider Cards (OpenAI, Anthropic, Google Gemini) */}
      <div className="space-y-4">
        {apiKeys.map((item) => {
          return (
            <div
              key={item.provider}
              className="p-5 rounded-lg bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h3 className="font-serif text-base text-ink font-normal">{item.provider}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border font-mono text-brass">
                    {item.modelName}
                  </span>
                  {item.connected ? (
                    <span className="flex items-center gap-1 text-[11px] text-sage font-medium">
                      <Check className="w-3 h-3" />
                      Mock Connected
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-muted">Not Enrolled</span>
                  )}
                </div>

                <p className="text-xs text-ink-muted">
                  {item.connected
                    ? 'Simulated connection state only; no key is stored or sent'
                    : `Future design slot for ${item.provider} / ${item.modelName}. No key is requested.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {item.connected ? (
                  <button
                    onClick={() => removeApiKey(item.provider)}
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-border text-xs text-ink-muted hover:text-terracotta hover:border-terracotta/50 transition-colors"
                  >
                    Clear Mock State
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenEnroll(item.provider)}
                    type="button"
                    className="px-4 py-2 rounded-md bg-brass text-background font-medium text-xs hover:bg-brass/90 transition-colors shadow-xs"
                  >
                    Simulate Connection
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Enroll Modal Dialog */}
      {activeProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-xl p-6 space-y-4">
            <div>
              <h3 className="font-serif text-lg text-ink font-normal">
                Simulate {activeProvider} Connection
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                No key field, credential validation, storage, or provider request exists. This only flips local UI state.
              </p>
            </div>

            <form onSubmit={handleSimulateConnection} className="space-y-4">
              <p className="text-xs text-ink-muted">
                This action changes only a local “mock connected” badge. It cannot enter, read, save, or send a key.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveProvider(null)}
                  className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors shadow-xs"
                >
                  Simulate connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
