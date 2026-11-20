import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { Check, ChevronDown, ChevronRight, Lock, Pencil, Plus, Settings, Settings2, Trash2, Users, X } from 'lucide-react';

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobile = false,
  onClose,
}) => {
  const {
    bots,
    botCap,
    isBotDisabled,
    conversations,
    currentRoom,
    currentView,
    deleteConversationById,
    isAdmin,
    language,
    openBotChat,
    openEditGroup,
    openGroupChat,
    openJoinRoom,
    renameSession,
    setCurrentSessionId,
    setCurrentView,
    t,
  } = useApp();

  const labels = translations[language];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingGroupId, setConfirmingGroupId] = useState<string | null>(null);

  const groupChats = conversations.filter((c) => c.kind === 'group');

  const go = (view: ViewType) => {
    onClose?.();
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const openSession = (id: string) => {
    onClose?.();
    setCurrentSessionId(id);
    go('session-concluded');
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
    <aside
      className={
        mobile
          ? "flex h-dvh w-full flex-col overflow-hidden bg-surface p-4"
          : "sticky gap-3 top-[76px] hidden h-[calc(100dvh-76px)] w-72 shrink-0 border-r border-border bg-surface-2/50 p-4 lg:flex lg:flex-col"
      }
    >
      {mobile && (
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold text-ink">
            {t.workspaceNavigation}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="icon-button min-h-10 min-w-10"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      
      <button
        type="button"
        id="sidebar-new-group-btn"
        onClick={() => {onClose?.(); openJoinRoom()}}
        className="button-primary mb-5 w-full justify-center"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> {t.newGroupChat}
      </button>

      <nav
        className="grid min-w-0 grid-cols-1 gap-7 overflow-y-auto overflow-x-hidden pr-0.5"
        aria-label={t.workspaceNavigation}
      >
        {/* Solo 1-on-1 AI Bots */}
        <div className="mt-3 min-w-0">
          <button type='button' onClick={() => setCurrentView('personas')} className="group nav-group-label flex items-center justify-between pr-2 w-full">
            <p className="">{t.botsTitle}</p>
            <span className="flex items-center text-[10px] font-semibold text-ink-muted">
              {bots.length}/{botCap}
              {currentView === 'personas' 
              ? <ChevronRight className='h-5 w-5 invisible group-hover:visible transition' /> 
              : <ChevronDown className='h-5 w-5 invisible group-hover:visible transition' />}
            </span>
          </button>

          {currentView === 'personas' ? null : bots.length === 0 ? (
            <p className="px-3 py-1 text-xs leading-relaxed text-ink-muted">{t.botsEmpty}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1">
              {bots.map((bot) => {
                const locked = isBotDisabled(bot.id);
                const isActive =
                  currentView === 'chat-room' &&
                  currentRoom?.kind === 'solo' &&
                  currentRoom?.botId === bot.id;
                return (
                  <li key={bot.id}>
                    <button
                      type="button"
                      data-sidebar-bot={bot.id}
                      onClick={() => {onClose?.(); openBotChat(bot.id)}}
                      className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm transition ${
                        isActive
                          ? 'bg-surface font-semibold text-ink'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{bot.name}</span>
                      {locked && (
                        <Lock
                          className="h-3.5 w-3.5 shrink-0 text-brass"
                          aria-label={t.botDisabledBadge}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {currentView === 'sessions' ?
          <button
            type="button"
            id="sidebar-new-bot-btn"
            onClick={() => go('bot-wizard')}
            className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-brass hover:text-ink"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t.newBot}
          </button>
          : null
          }
          
          {isAdmin ? (
            <a
              href="/admin"
              className="mt-1 flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-ink-muted hover:text-ink"
            >
              {t.adminNav}
            </a>
          ) : null}
        </div>

        {/* Multi-Bot Group Chats (>= 2 bots) */}
        <div className="mt-3 min-w-0 w-full">
          <button type='button' onClick={() => setCurrentView('sessions')} className="group nav-group-label flex items-center justify-between w-full">
            {t.groupChatsTitle}
            {currentView === 'sessions' 
            ? <ChevronRight className='h-5 w-5 invisible group-hover:visible transition' /> 
            : <ChevronDown className='h-5 w-5 invisible group-hover:visible transition' />}
          </button>
          {groupChats.length === 0 ? (
            <p className="px-3 py-1 text-xs leading-relaxed text-ink-muted">
              {t.groupChatsEmpty}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-1">
              {groupChats.map((group) => {
                const isActive =
                  currentView === 'chat-room' && currentRoom?.conversationId === group.id;
                const isConfirming = confirmingGroupId === group.id;
                return (
                  <li
                    key={group.id}
                    data-sidebar-group={group.id}
                    className={`group flex min-w-0 items-center gap-1 rounded-lg px-1 ${
                      isActive ? 'bg-surface' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {onClose?.(); openGroupChat(group.id)}}
                      className={`flex min-h-9 min-w-0 flex-1 items-center gap-2 truncate rounded-md px-2 text-left text-sm ${
                        isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                      <span className="truncate">{group.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-ink-muted">
                        {group.roster.length}
                      </span>
                    </button>

                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteConversationById(group.id);
                            setConfirmingGroupId(null);
                          }}
                          aria-label={t.deleteSession}
                          className="icon-button min-h-8 min-w-8 text-terracotta hover:bg-terracotta/10"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingGroupId(null)}
                          aria-label={t.cancel}
                          className="icon-button min-h-8 min-w-8"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {onClose?.(); openEditGroup(group.id)}}
                          aria-label={t.groupEditTitle}
                          className="icon-button min-h-8 min-w-8 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingGroupId(group.id)}
                          aria-label={t.deleteSession}
                          className="icon-button min-h-8 min-w-8 opacity-0 transition hover:bg-terracotta/10 hover:text-terracotta group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
      
      {/* BADGE & ACCOUNT */}
      <div className="mt-auto rounded-2xl border border-border bg-surface p-3.5 text-[11px] leading-relaxed text-ink-muted">
        <p className="font-bold text-ink">{t.localBadge}</p>
        <p className="mt-1">{t.boundaryShort}</p>
      </div>

      <button 
      type="button" 
      onClick={() => setCurrentView('settings')}
      className="w-full mt-auto mb-5 rounded-2xl border border-border bg-surface p-3.5 text-[11px] leading-relaxed text-ink flex justify-baseline items-center">
          <Settings className='h-5 w-5 mr-3'/>
          {t.settingsTitle}
      </button>
    </aside>
  );
};
