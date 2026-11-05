import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { WORKSPACE_NAV } from '../navigation';

/**
 * The single desktop navigation surface. It renders `WORKSPACE_NAV`, which the
 * mobile panel in Header.tsx also renders — one array, two presentations, no
 * second hand-maintained copy to drift.
 *
 * Below the nav sits the Grok-style council list: every session the account
 * has made, open / rename / delete from the bar itself. Rename is inline
 * (Enter commits, Escape cancels), delete is a two-step inline confirm so a
 * hover-speed click cannot wipe a council.
 */
export const Sidebar: React.FC = () => {
  const { bots, currentSessionId, currentView, deleteSession, isAdmin, language, openBotChat, openJoinRoom, renameSession, setCurrentSessionId, setCurrentView, sessions, t } = useApp();
  const labels = translations[language];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const go = (view: ViewType) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const openSession = (id: string) => {
    setCurrentSessionId(id);
    go('session-active');
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
    setConfirmingId(null);
  };

  const commitRename = (id: string) => {
    renameSession(id, draftTitle);
    setEditingId(null);
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

        <div className="mt-3">
          <p className="nav-group-label">{t.botsTitle}</p>
          {bots.length === 0 ? (
            <p className="px-3 py-1 text-xs leading-relaxed text-ink-muted">{t.botsEmpty}</p>
          ) : (
            <ul className="grid gap-1">
              {bots.map((bot) => (
                <li key={bot.id}>
                  <button
                    type="button"
                    onClick={() => openBotChat(bot.id)}
                    className="min-h-9 w-full truncate rounded-md px-2 text-left text-sm text-ink-muted hover:text-ink"
                  >
                    {bot.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => go('bot-wizard')}
            className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-brass hover:text-ink"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t.newBot}
          </button>
          {isAdmin ? (
            <a
              href="/admin"
              className="mt-1 flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-ink-muted hover:text-ink"
            >
              {t.adminNav}
            </a>
          ) : null}
        </div>

        <div className="mt-3">
          <p className="nav-group-label">{t.councilsTitle}</p>
          {sessions.length === 0 ? (
            <p className="px-3 py-1 text-xs leading-relaxed text-ink-muted">{t.emptySessionsBody}</p>
          ) : (
            <ul className="grid gap-1">
              {sessions.map((session) => {
                const isActive = currentView === 'session-active' && currentSessionId === session.id;
                const isEditing = editingId === session.id;
                const isConfirming = confirmingId === session.id;
                return (
                  <li
                    key={session.id}
                    className={`group flex items-center gap-1 rounded-lg px-1 ${isActive ? 'bg-surface' : ''}`}
                  >
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename(session.id);
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                          aria-label={t.renameSession}
                          className="min-h-9 min-w-0 flex-1 rounded-md border border-brass bg-background px-2 text-sm text-ink focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(session.id)}
                          aria-label={t.save}
                          className="icon-button min-h-9 min-w-9"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label={t.cancel}
                          className="icon-button min-h-9 min-w-9"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openSession(session.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`min-h-9 min-w-0 flex-1 truncate rounded-md px-2 text-left text-sm ${isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'}`}
                        >
                          {session.title}
                        </button>
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              onClick={() => { deleteSession(session.id); setConfirmingId(null); }}
                              aria-label={t.deleteSession}
                              className="icon-button min-h-9 min-w-9 text-terracotta hover:bg-terracotta/10"
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              aria-label={t.cancel}
                              className="icon-button min-h-9 min-w-9"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startRename(session.id, session.title)}
                              aria-label={t.renameSession}
                              className="icon-button min-h-9 min-w-9 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(session.id)}
                              aria-label={t.deleteSession}
                              className="icon-button min-h-9 min-w-9 opacity-0 transition hover:bg-terracotta/10 hover:text-terracotta group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
      <div className="mt-auto rounded-2xl border border-border bg-surface p-3.5 text-[11px] leading-relaxed text-ink-muted">
        <p className="font-bold text-ink">{t.localBadge}</p>
        <p className="mt-1">{t.boundaryShort}</p>
      </div>
    </aside>
  );
};
