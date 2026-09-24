import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Lock, FileText, HelpCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setCurrentView, t } = useApp();

  return (
    <footer className="border-t border-border bg-surface text-ink-muted text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-border">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-brass" />
              <span className="font-serif text-base text-ink font-normal">{t.brand}</span>
            </div>
            <p className="text-xs text-ink-muted max-w-sm leading-relaxed">
              UI-only product prototype for multi-model decision deliberation. All views use local sample data; no AI, account, billing, or storage service is connected.
            </p>
            <div className="flex items-center gap-4 pt-1 text-ink-muted text-[11px]">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sage" />
                Local sample only
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-brass" />
                No provider requests
              </span>
            </div>
          </div>

          {/* Council Views */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-medium text-ink">Chamber Navigation</h2>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setCurrentView('overview')}
                  type="button"
                  className="hover:text-ink transition-colors text-left"
                >
                  {t.nav.overview}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('empty-chamber')}
                  type="button"
                  className="hover:text-ink transition-colors text-left"
                >
                  {t.nav.newDeliberation}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('personas')}
                  type="button"
                  className="hover:text-ink transition-colors text-left"
                >
                  {t.nav.personas}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('api-keys')}
                  type="button"
                  className="hover:text-ink transition-colors text-left"
                >
                  {t.nav.apiKeys}
                </button>
              </li>
            </ul>
          </div>

          {/* Governance & Privacy */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-medium text-ink">Prototype Boundaries</h2>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setCurrentView('pricing')}
                  type="button"
                  className="hover:text-ink transition-colors text-left"
                >
                  {t.nav.pricing}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('privacy')}
                  type="button"
                  className="hover:text-ink transition-colors flex items-center gap-1.5 text-left"
                >
                  <FileText className="w-3 h-3 text-ink-muted" />
                  Privacy boundary
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('settings')}
                  type="button"
                  className="hover:text-ink transition-colors flex items-center gap-1.5 text-left"
                >
                  <HelpCircle className="w-3 h-3 text-ink-muted" />
                  Mock settings
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-ink-muted">
          <p>© 2026 Zero Council. Sample syntheses are local UI fixtures, not advice or generated results.</p>
          <div className="flex items-center gap-4">
            <span>Mode: local mock</span>
            <span>·</span>
            <span>AI calls: disabled</span>
            <span>·</span>
            <span>Prototype UI</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
