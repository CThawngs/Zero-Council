import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, Globe2, RotateCcw } from 'lucide-react';
import { PLANS, planPrice } from '../data/plans';
import { Modal } from './Modal';
import { translations } from '../i18n';
import { WORKSPACE_NAV } from '../navigation';
import { ViewType } from '../types';
import { ApiKeysView } from './ApiKeysView';
import { BillingHistoryView } from './BillingHistoryView';
import AccountView from './AccountView';

export const SettingsView: React.FC = () => {
  const {
    language,
    t,
  } = useApp();

  
  const [activeWorkspacetab, setActiveWorkspaceTab] = useState<ViewType>('account');
  const workspaceTabs = WORKSPACE_NAV.flatMap((group) => group.items);
  const labels = translations[language];

  return (
    <div className="content-shell">
      <header className="page-header">
        <p className="eyebrow">
          <span className="status-dot" />
          {t.settingsEyebrow}
        </p>
        <h1>{t.settingsTitle}</h1>
        <p>{t.settingsBody}</p>
      </header>
      
      {/* Workspace Navigation Tabs */}
      <nav
        className="flex mt-7 items-center gap-2 border-b border-border overflow-x-auto"
        aria-label={t.workspaceNavigation}
        role="tablist"
      >
        {workspaceTabs.map(({ view, labelKey, icon: Icon }) => {
          const isActive = activeWorkspacetab === view;

          return (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveWorkspaceTab(view)}
              className={`
                relative flex min-h-11 items-center gap-2
                border-b-2 px-4 text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'border-brass text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink hover:border-border'
                }
              `}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className='whitespace-nowrap'>{labels.nav[labelKey]}</span>
            </button>
          );
        })}
      </nav>

      {activeWorkspacetab === 'api-keys' && <ApiKeysView />}
      {activeWorkspacetab === 'billing' && <BillingHistoryView />}
      {activeWorkspacetab === 'account' && <AccountView />}
    </div>
  );
};
