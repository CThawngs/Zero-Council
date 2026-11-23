'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '../context/AppContext';
import type { SavedConversation, ViewType } from '../types';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Settings,
  Settings2,
  Trash2,
  Users,
  UserStar,
  X,
} from 'lucide-react';
import {
  EMPTY_SIDEBAR_ORG,
  exportGroupChatJson,
  getSidebarOrgSnapshot,
  mutateSidebarOrg,
  pruneRemovedConversations,
  subscribeSidebarOrg,
  togglePinConversation,
  type SidebarOrgState,
} from '../sidebar-organization';

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

interface GroupPopoverState {
  groupId: string;
  top: number;
  left: number;
}

const POPOVER_WIDTH = 224;
const POPOVER_ESTIMATED_HEIGHT = 236;

const computeMenuPosition = (trigger: HTMLElement): { top: number; left: number } => {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 10;

  let left = rect.right - POPOVER_WIDTH;
  left = Math.max(margin, Math.min(left, vw - POPOVER_WIDTH - margin));

  let top = rect.bottom + 6;
  if (top + POPOVER_ESTIMATED_HEIGHT > vh - margin) {
    top = Math.max(margin, rect.top - POPOVER_ESTIMATED_HEIGHT - 6);
  }

  return { top, left };
};

export const Sidebar: React.FC<SidebarProps> = ({
  mobile = false,
  onClose,
}) => {
  const {
    authUser,
    bots,
    botCap,
    isBotDisabled,
    conversations,
    currentRoom,
    currentView,
    deleteConversationById,
    isAdmin,
    openBotChat,
    openEditGroup,
    openGroupChat,
    openJoinRoom,
    renameConversation,
    setCurrentView,
    showToast,
    t,
  } = useApp();

  const userKey = authUser?.id ?? 'anon';
  const org = useSyncExternalStore(
    subscribeSidebarOrg,
    () => getSidebarOrgSnapshot(userKey),
    () => EMPTY_SIDEBAR_ORG
  );

  const [menu, setMenu] = useState<GroupPopoverState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  const updateOrg = useCallback(
    (updater: (current: SidebarOrgState) => SidebarOrgState) => {
      mutateSidebarOrg(userKey, updater);
    },
    [userKey]
  );

  const pinnedSet = useMemo(() => new Set(org.pinnedIds), [org.pinnedIds]);

  const groupChats = useMemo(() => {
    const groups = conversations.filter((c) => c.kind === 'group');
    if (org.pinnedIds.length === 0) return groups;
    const pinnedOrder = new Map(org.pinnedIds.map((id, index) => [id, index]));
    return [...groups].sort((a, b) => {
      const pa = pinnedOrder.get(a.id);
      const pb = pinnedOrder.get(b.id);
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return 0;
    });
  }, [conversations, org.pinnedIds]);

  const go = (view: ViewType) => {
    onClose?.();
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const closeMenu = () => {
    setMenu(null);
    setConfirmDeleteId(null);
  };

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
        setConfirmDeleteId(null);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        setMenu(null);
        setConfirmDeleteId(null);
      }
    };
    const onResize = () => {
      setMenu(null);
      setConfirmDeleteId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, [menu]);

  const openGroupMenu = (groupId: string, trigger: HTMLElement) => {
    if (menu?.groupId === groupId) {
      closeMenu();
      return;
    }
    setConfirmDeleteId(null);
    const pos = computeMenuPosition(trigger);
    setMenu({ groupId, ...pos });
  };

  const handleStartRename = (group: SavedConversation) => {
    closeMenu();
    setRenamingGroupId(group.id);
    setRenameDraft(group.title);
  };

  const handleCommitRename = async (groupId: string) => {
    const clean = renameDraft.trim();
    setRenamingGroupId(null);
    if (!clean) return;
    await renameConversation(groupId, clean);
  };

  const handleExportGroup = (group: SavedConversation) => {
    closeMenu();
    const json = exportGroupChatJson({
      title: group.title,
      mode: group.mode,
      rosterCount: group.roster.length,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const slug = group.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    anchor.download = `${slug || 'zero-council-group'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('sidebarToastExported');
  };

  const handleDeleteGroup = async (groupId: string) => {
    closeMenu();
    await deleteConversationById(groupId);
    const remaining = new Set(groupChats.filter((g) => g.id !== groupId).map((g) => g.id));
    updateOrg((cur) => pruneRemovedConversations(cur, remaining));
  };

  const activeGroupForMenu = menu
    ? groupChats.find((g) => g.id === menu.groupId) ?? null
    : null;

  return (
    <aside
      className={
        mobile
          ? 'flex justify-between h-dvh w-full flex-col overflow-hidden bg-surface p-4'
          : 'sticky top-[76px] hidden h-[calc(100dvh-76px)] w-72 shrink-0 border-r border-border bg-surface-2/50 p-4 lg:flex lg:flex-col gap-3 justify-between'
      }
    >
      {/* Phân nhóm để khi flex dễ justify-between */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div>
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
            onClick={() => {
              onClose?.();
              openJoinRoom();
            }}
            className="button-primary mb-5 w-full justify-center"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> {t.newGroupChat}
          </button>
        </div>

        <nav
          className="grid min-w-0 grid-cols-1 gap-7 overflow-y-auto overflow-x-hidden pr-0.5"
          aria-label={t.workspaceNavigation}
        >
          {/* Solo 1-on-1 AI Bots */}
          <div className="mt-3 min-w-0">
            <button
              type="button"
              onClick={() => setCurrentView('personas')}
              className="group nav-group-label flex items-center justify-between pr-2 w-full"
            >
              <p className="">{t.botsTitle}</p>
              <span className="flex items-center text-[10px] font-semibold text-ink-muted">
                {bots.length}/{botCap}
                {currentView === 'personas' ? (
                  <ChevronRight className="h-5 w-5 invisible group-hover:visible transition" />
                ) : (
                  <ChevronDown className="h-5 w-5 invisible group-hover:visible transition" />
                )}
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
                        onClick={() => {
                          onClose?.();
                          openBotChat(bot.id);
                        }}
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

            {currentView === 'sessions' ? (
              <button
                type="button"
                id="sidebar-new-bot-btn"
                onClick={() => go('bot-wizard')}
                className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-brass hover:text-ink"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t.newBot}
              </button>
            ) : null}
          </div>

          {/* Multi-Bot Group Chats (>= 2 bots) */}
          <div className="mt-3 min-w-0 w-full">
            <button
              type="button"
              onClick={() => setCurrentView('sessions')}
              className="group nav-group-label flex items-center justify-between w-full"
            >
              {t.groupChatsTitle}
              {currentView === 'sessions' ? (
                <ChevronRight className="h-5 w-5 invisible group-hover:visible transition" />
              ) : (
                <ChevronDown className="h-5 w-5 invisible group-hover:visible transition" />
              )}
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
                  const isRenaming = renamingGroupId === group.id;
                  const isPinned = pinnedSet.has(group.id);
                  const isMenuOpen = menu?.groupId === group.id;

                  if (isRenaming) {
                    return (
                      <li
                        key={group.id}
                        data-sidebar-group={group.id}
                        className="flex min-w-0 items-center gap-1 rounded-lg bg-surface px-1.5 py-1"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={renameDraft}
                          maxLength={100}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleCommitRename(group.id);
                            } else if (event.key === 'Escape') {
                              setRenamingGroupId(null);
                            }
                          }}
                          aria-label={t.sidebarActionRename}
                          className="min-w-0 flex-1 rounded-md border border-brass bg-background px-2 py-1 text-xs text-ink outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleCommitRename(group.id)}
                          aria-label={t.groupSaveChanges}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brass hover:bg-surface-2"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingGroupId(null)}
                          aria-label={t.cancel}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={group.id}
                      data-sidebar-group={group.id}
                      data-sidebar-pinned={isPinned ? 'true' : undefined}
                      className={`group flex min-w-0 items-center gap-1 rounded-lg px-1 ${
                        isActive ? 'bg-surface' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose?.();
                          openGroupChat(group.id);
                        }}
                        className={`flex min-h-9 min-w-0 flex-1 items-center gap-2 truncate rounded-md px-2 text-left text-sm ${
                          isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        <Users className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                        <span className="truncate">{group.title}</span>
                        {isPinned && (
                          <Pin
                            className="h-3 w-3 shrink-0 text-brass"
                            aria-label={t.sidebarPinned}
                          />
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-ink-muted">
                          {group.roster.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-group-menu-trigger={group.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          openGroupMenu(group.id, event.currentTarget);
                        }}
                        aria-label={t.sidebarMoreActions}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:opacity-100 ${
                          isMenuOpen || mobile
                            ? 'opacity-100 bg-surface text-ink'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </nav>
      </div>

      {/* BADGE & ACCOUNT */}
      <div className="flex flex-col gap-3">
        {isAdmin ? (
          <a
            href="/admin"
            className="mt-1 flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-ink-muted hover:text-ink"
          >
            <UserStar />
            {t.adminNav}
          </a>
        ) : null}

        <div className="rounded-2xl border border-border bg-surface p-3.5 text-[11px] leading-relaxed text-ink-muted">
          <p className="font-bold text-ink">{t.localBadge}</p>
          <p className="mt-1">{t.boundaryShort}</p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('settings')}
          className="w-full mb-5 rounded-2xl border border-border bg-surface p-3.5 text-[11px] leading-relaxed text-ink flex justify-baseline items-center"
        >
          <Settings className="h-5 w-5 mr-3" />
          {t.settingsTitle}
        </button>
      </div>

      {/* Floating '...' Action Menu for Group Chats */}
      {menu && activeGroupForMenu && (
        <div
          ref={menuRef}
          role="menu"
          data-sidebar-popover="group"
          style={{ top: `${menu.top}px`, left: `${menu.left}px`, width: `${POPOVER_WIDTH}px` }}
          className="fixed z-[80] rounded-2xl border border-border bg-surface p-1.5 shadow-2xl"
        >
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleStartRename(activeGroupForMenu)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
            >
              <Pencil className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span>{t.sidebarActionRename}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onClose?.();
                openEditGroup(activeGroupForMenu.id);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
            >
              <Settings2 className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span>{t.sidebarActionEditGroup}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                updateOrg((cur) => togglePinConversation(cur, activeGroupForMenu.id));
                closeMenu();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
            >
              {pinnedSet.has(activeGroupForMenu.id) ? (
                <PinOff className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              ) : (
                <Pin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              )}
              <span>
                {pinnedSet.has(activeGroupForMenu.id)
                  ? t.sidebarActionUnpin
                  : t.sidebarActionPin}
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleExportGroup(activeGroupForMenu)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
            >
              <Download className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span>{t.sidebarActionExport}</span>
            </button>

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              role="menuitem"
              data-group-menu-delete={activeGroupForMenu.id}
              onClick={() => {
                if (confirmDeleteId !== activeGroupForMenu.id) {
                  setConfirmDeleteId(activeGroupForMenu.id);
                  return;
                }
                void handleDeleteGroup(activeGroupForMenu.id);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                confirmDeleteId === activeGroupForMenu.id
                  ? 'bg-terracotta text-white'
                  : 'text-terracotta hover:bg-terracotta/10'
              }`}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {confirmDeleteId === activeGroupForMenu.id
                  ? t.sidebarConfirmDelete
                  : t.sidebarActionDelete}
              </span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
