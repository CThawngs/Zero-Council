import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Globe, Moon, Sun, Trash2, Receipt, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    toggleTheme,
    purgeSessions,
    revokeAllKeys,
    setCurrentView,
    openCheckoutDrawer,
  } = useApp();

  const handlePurge = () => {
    if (window.confirm('Reset all sample sessions in this browser prototype? This cannot be undone.')) {
      purgeSessions();
    }
  };

  const handleRevokeKeys = () => {
    if (window.confirm('Clear all simulated provider connection states? No real key is stored.')) {
      revokeAllKeys();
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8 text-left">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brass" />
          <span className="text-xs font-mono text-brass font-medium">Chamber Configuration</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl text-ink font-normal mt-1">
          Settings & Preferences
        </h1>
        <p className="text-xs text-ink-muted">
          Preview sample identity, language, provider, and billing states. No production account is connected.
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="p-6 rounded-lg bg-surface border border-border space-y-4">
        <h3 className="font-serif text-base text-ink font-normal flex items-center gap-2">
          <User className="w-4 h-4 text-brass" />
          <span>Operator Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <label htmlFor="sample-operator" className="block text-ink-muted mb-1">
              Sample Operator
            </label>
            <input
              id="sample-operator"
              name="sample-operator"
              type="text"
              readOnly
              value="sample.operator@example.test"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-ink font-mono focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sample-chamber-label" className="block text-ink-muted mb-1">
              Sample Chamber Label
            </label>
            <input
              id="sample-chamber-label"
              name="sample-chamber-label"
              type="text"
              readOnly
              value="Sample Council Vault #882"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-ink font-mono focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Membership & Billing Status */}
      <div className="p-6 rounded-lg bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base text-ink font-normal flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brass" />
            <span>Sample Membership & Billing</span>
          </h3>
          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-background border border-brass text-brass font-medium">
            Mock Sovereign Concept
          </span>
        </div>

        <div className="p-4 rounded-md bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <p className="text-ink font-medium">Monthly Renewal</p>
            <p className="text-ink-muted">
              Sample renewal date: April 28, 2026. No payment or auto-clearing is scheduled.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('billing-history')}
              type="button"
              className="px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-background text-xs text-ink transition-colors"
            >
              View Sample Billing
            </button>
            <button
              onClick={openCheckoutDrawer}
              type="button"
              className="px-3.5 py-1.5 rounded-md bg-brass text-background font-medium text-xs hover:bg-brass/90 transition-colors shadow-xs"
            >
              Preview Renewal
            </button>
          </div>
        </div>
      </div>

      {/* Localization & Visuals */}
      <div className="p-6 rounded-lg bg-surface border border-border space-y-5">
        <h3 className="font-serif text-base text-ink font-normal flex items-center gap-2">
          <Globe className="w-4 h-4 text-brass" />
          <span>Localization & Appearance</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Language Switch */}
          <fieldset className="space-y-2">
            <legend className="text-ink-muted">Interface Language</legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
                className={`flex-1 py-2 px-3 rounded-md border text-xs transition-colors flex items-center justify-center gap-2 ${
                  language === 'en'
                    ? 'border-brass bg-background text-ink font-medium'
                    : 'border-border text-ink-muted hover:text-ink'
                }`}
              >
                <span>English</span>
                {language === 'en' && <Check className="w-3.5 h-3.5 text-brass" />}
              </button>
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                aria-pressed={language === 'vi'}
                className={`flex-1 py-2 px-3 rounded-md border text-xs transition-colors flex items-center justify-center gap-2 ${
                  language === 'vi'
                    ? 'border-brass bg-background text-ink font-medium'
                    : 'border-border text-ink-muted hover:text-ink'
                }`}
              >
                <span>Tiếng Việt</span>
                {language === 'vi' && <Check className="w-3.5 h-3.5 text-brass" />}
              </button>
            </div>
          </fieldset>

          {/* Theme Switch */}
          <fieldset className="space-y-2">
            <legend className="text-ink-muted">Visual Theme</legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full py-2 px-3 rounded-md border border-border bg-background hover:bg-surface text-xs text-ink transition-colors flex items-center justify-center gap-2"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-brass" />
                    <span>Dark sample theme</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-brass" />
                    <span>Light sample theme</span>
                  </>
                )}
              </button>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-lg bg-surface border border-terracotta/40 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-terracotta" />
          <h3 className="font-serif text-base text-terracotta font-normal">
            Danger Zone
          </h3>
        </div>

        <div className="space-y-3 pt-1">
          <div className="p-4 rounded-md bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
                <p className="text-ink font-medium">Reset Sample Deliberation State</p>
              <p className="text-ink-muted text-[11px] mt-0.5">
                Resets current in-memory sample sessions, scenarios, and trade-off matrices. Reload already clears this state.
              </p>
            </div>
            <button
              onClick={handlePurge}
              type="button"
              className="px-3.5 py-2 rounded-md border border-terracotta/50 text-terracotta hover:bg-terracotta hover:text-background text-xs font-medium transition-colors shrink-0"
            >
              Reset Sample State
            </button>
          </div>

          <div className="p-4 rounded-md bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <p className="text-ink font-medium">Clear Simulated Provider States</p>
              <p className="text-ink-muted text-[11px] mt-0.5">
                Clears simulated connection states only. This prototype stores no credentials.
              </p>
            </div>
            <button
              onClick={handleRevokeKeys}
              type="button"
              className="px-3.5 py-2 rounded-md border border-terracotta/50 text-terracotta hover:bg-terracotta hover:text-background text-xs font-medium transition-colors shrink-0"
            >
              Clear Mock States
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
