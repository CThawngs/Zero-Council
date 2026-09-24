import React from 'react';
import { useApp } from '../context/AppContext';
import { ViewType } from '../types';
import {
  Compass,
  Scroll,
  Users,
  KeyRound,
  CreditCard,
  Settings,
  PlusCircle,
  ShieldCheck,
  Receipt,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, t, sessions } = useApp();

  const navItems: { view: ViewType; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      view: 'empty-chamber',
      label: t.nav.newDeliberation,
      icon: <PlusCircle className="w-4 h-4 text-brass" />,
    },
    {
      view: 'session-concluded',
      label: t.nav.currentSession,
      icon: <Compass className="w-4 h-4 text-ink-muted" />,
    },
    {
      view: 'sessions',
      label: t.nav.sessions,
      icon: <Scroll className="w-4 h-4 text-ink-muted" />,
      badge: `${sessions.length}`,
    },
    {
      view: 'personas',
      label: t.nav.personas,
      icon: <Users className="w-4 h-4 text-ink-muted" />,
    },
    {
      view: 'api-keys',
      label: t.nav.apiKeys,
      icon: <KeyRound className="w-4 h-4 text-ink-muted" />,
    },
    {
      view: 'pricing',
      label: t.nav.pricing,
      icon: <CreditCard className="w-4 h-4 text-ink-muted" />,
    },
    {
      view: 'billing-history',
      label: 'Billing History',
      icon: <Receipt className="w-4 h-4 text-ink-muted" />,
    },
    {
      view: 'settings',
      label: t.nav.settings,
      icon: <Settings className="w-4 h-4 text-ink-muted" />,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-surface shrink-0 min-h-[calc(100vh-100px)]">
      {/* Chamber Status Bar */}
      <div className="p-4 border-b border-border bg-background/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sage animate-pulse" />
            <span className="text-xs font-medium text-ink">Local UI Prototype</span>
          </div>
          <span className="text-[11px] text-ink-muted font-mono">No AI calls</span>
        </div>
      </div>

      {/* Main Nav Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              type="button"
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-background text-ink border border-border shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-background/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-brass' : 'text-ink-muted'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface border border-border text-ink-muted font-mono">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Security & Verification Card */}
      <div className="p-3 border-t border-border mt-auto">
        <div className="p-3 rounded-md bg-background/50 border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-sage shrink-0" />
            <span className="text-xs font-medium text-ink">Mock-Only Mode</span>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            Sample data stays in transient browser state. Reload resets the prototype.
          </p>
        </div>
      </div>

      {/* User Session Footer */}
      <div className="p-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-brass/20 text-brass flex items-center justify-center font-serif text-xs font-semibold shrink-0 border border-brass/30">
            Z
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink truncate">Sample Operator</p>
            <p className="text-[10px] text-ink-muted font-mono truncate">Mock Concept Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
