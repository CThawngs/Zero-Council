import React from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { Plus } from 'lucide-react';
import { WORKSPACE_NAV } from '../navigation';

/**
 * The single desktop navigation surface. It renders `WORKSPACE_NAV`, which the
 * mobile panel in Header.tsx also renders — one array, two presentations, no
 * second hand-maintained copy to drift.
 */
export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, language, t, openJoinRoom } = useApp();
  const labels = translations[language];

  const go = (view: ViewType) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  return (
    <aside className="sticky top-[76px] hidden h-[calc(100dvh-76px)] w-72 shrink-0 border-r border-border bg-surface-2/50 p-4 lg:flex lg:flex-col">
      <button type="button" onClick={openJoinRoom} className="button-primary mb-5 w-full justify-center">
        <Plus className="h-4 w-4" aria-hidden="true" /> {labels.nav.newDeliberation}
      </button>
      <nav className="grid gap-1 overflow-y-auto" aria-label={t.workspaceNavigation}>
        {WORKSPACE_NAV.map((group) => (
          <div key={group.labelKey}>
            <p className="nav-group-label">{labels.navGroup[group.labelKey]}</p>
            <div className="grid gap-1">
              {group.items.map(({ view, labelKey, icon: Icon }) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => go(view)}
                  aria-current={currentView === view ? 'page' : undefined}
                  className={`sidebar-link ${currentView === view ? 'sidebar-link-active' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{labels.nav[labelKey]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-border bg-surface p-3.5 text-[11px] leading-relaxed text-ink-muted">
        <p className="font-bold text-ink">{t.localBadge}</p>
        <p className="mt-1">{t.boundaryShort}</p>
      </div>
    </aside>
  );
};