import React from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { MessageSquareText, Plus, Settings, Sparkles, UsersRound } from 'lucide-react';

const items: { view: ViewType; icon: React.ElementType; key: 'sessions' | 'personas' | 'apiKeys' | 'settings' }[] = [
  { view: 'sessions', icon: MessageSquareText, key: 'sessions' },
  { view: 'personas', icon: UsersRound, key: 'personas' },
  { view: 'api-keys', icon: Sparkles, key: 'apiKeys' },
  { view: 'settings', icon: Settings, key: 'settings' },
];

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, language, t } = useApp();
  const labels = translations[language];

  return (
    <aside className="sticky top-[76px] hidden h-[calc(100vh-76px)] w-64 shrink-0 border-r border-border/70 bg-surface/35 p-4 lg:flex lg:flex-col">
      <button type="button" onClick={() => setCurrentView('empty-chamber')} className="button-primary mb-6 min-h-11 w-full justify-center">
        <Plus className="h-4 w-4" /> {labels.nav.newDeliberation}
      </button>
      <nav className="space-y-1" aria-label={t.workspaceNavigation}>
        {items.map(({ view, icon: Icon, key }) => (
          <button key={view} type="button" onClick={() => setCurrentView(view)} aria-current={currentView === view ? 'page' : undefined} className={`sidebar-link ${currentView === view ? 'sidebar-link-active' : ''}`}>
            <Icon className="h-4 w-4" aria-hidden="true" /> {labels.nav[key]}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-xl border border-border bg-background/70 p-3 text-[11px] leading-relaxed text-ink-muted">
        <p className="font-medium text-ink">{t.localBadge}</p>
        <p className="mt-1">{t.boundaryShort}</p>
      </div>
    </aside>
  );
};
