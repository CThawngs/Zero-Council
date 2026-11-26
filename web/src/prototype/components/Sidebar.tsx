'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/catalog';
import type { SavedConversation, ViewType } from '../types';
import {
  Check,
  ChevronDown,
  Download,
  KeyRound,
  Lock,
  LogOut,
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
import { fill } from '../bot-settings-panel-logic';

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

/** Collapsible section header used by "Group chats" and "My bots". */
const SectionHeader: React.FC<{
  label: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  controls: string;
  toggleLabel: string;
}> = ({ label, meta, open, onToggle, controls, toggleLabel }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    aria-controls={controls}
    title={toggleLabel}
    className="group flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left lg:min-h-9"
  >
    <span className="nav-group-label">{label}</span>
    <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-muted">
      {meta}
      <ChevronDown
        className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`}
        aria-hidden="true"
      />
    </span>
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({
  mobile = false,
  onClose,
}) => {
  const {
    apiKeys,
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
    signOut,
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
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [botsOpen, setBotsOpen] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);

  const updateOrg = useCallback(
    (updater: (current: SidebarOrgState) => SidebarOrgState) => {
      mutateSidebarOrg(userKey, updater);
    },
    [userKey]
  );

  const pinnedSet = useMemo(() => new Set(org.pinnedIds), [org.pinnedIds]);

  const groupChats = useMemo(() => {
    const groups = conversations.filter((conv) => conv.kind === 'group');
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

  // 44px touch targets on mobile / coarse pointers, compact on desktop.
  const rowHeight = mobile ? 'min-h-11' : 'min-h-10';
  const footerButton =
    'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition hover:border-brass/60 hover:text-ink';

  return (
    <aside
      data-workspace-sidebar={mobile ? 'mobile' : 'desktop'}
      className={
        mobile
          ? 'flex h-dvh w-full flex-col justify-between overflow-hidden bg-surface p-4'
          : 'sticky top-[76px] hidden h-[calc(100dvh-76px)] w-72 shrink-0 flex-col justify-between gap-3 border-r border-border bg-surface-2/50 p-4 lg:flex'
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div>
          {mobile && (
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold text-ink">{t.workspaceNavigation}</span>

              <button
                type="button"
                onClick={onClose}
                className="icon-button min-h-11 min-w-11"
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="mb-4 grid gap-2">
            <button
              type="button"
              id="sidebar-new-group-btn"
              onClick={() => {
                onClose?.();
                openJoinRoom();
              }}
              className="button-primary min-h-11 w-full justify-center !px-4 !py-2 text-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> {t.newGroupChat}
            </button>
            <button
              type="button"
              id="sidebar-new-bot-btn"
              onClick={() => go('bot-wizard')}
              className="button-secondary min-h-11 w-full justify-center !px-4 !py-2 text-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> {t.newBot}
            </button>
          </div>
        </div>

        <nav
          className="grid min-w-0 grid-cols-1 content-start gap-4 overflow-y-auto overflow-x-hidden pr-0.5"
          aria-label={t.workspaceNavigation}
        >
          {/* Multi-Bot Group Chats (>= 2 bots) */}
          <div className="min-w-0 w-full">
            <SectionHeader
              label={t.groupChatsTitle}
              meta={groupChats.length > 0 ? String(groupChats.length) : undefined}
              open={groupsOpen}
              onToggle={() => setGroupsOpen((v) => !v)}
              controls="sidebar-groups-list"
              toggleLabel={groupsOpen ? t.wsCollapse : t.wsExpand}
            />
            {groupsOpen &&
              (groupChats.length === 0 ? (
                <p className="px-3 py-1 text-xs leading-relaxed text-ink-muted">
                  {t.groupChatsEmpty}
                </p>
              ) : (
                <ul id="sidebar-groups-list" className="grid grid-cols-1 gap-1">
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
                            className="min-h-9 min-w-0 flex-1 rounded-md border border-brass bg-background px-2 py-1 text-sm text-ink outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleCommitRename(group.id)}
                            aria-label={t.groupSaveChanges}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brass hover:bg-surface-2"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingGroupId(null)}
                            aria-label={t.cancel}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={group.id}
                        data-sidebar-group={group.id}
                        data-sidebar-pinned={isPinned ? 'true' : undefined}
                        className={`group flex min-w-0 items-center gap-1 rounded-lg px-1 transition-colors ${
                          isActive
                            ? 'bg-surface shadow-sm ring-1 ring-brass/40'
                            : 'hover:bg-surface/60'
                        }`}
                      >
                        <button
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            onClose?.();
                            openGroupChat(group.id);
                          }}
                          className={`flex ${rowHeight} min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-left text-sm ${
                            isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'
                          }`}
                        >
                          <Users className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{group.title}</span>
                            <span className="block truncate text-[11px] font-normal text-ink-muted">
                              {fill(t.wsMembersCount, { count: group.roster.length })}
                            </span>
                          </span>
                          {isPinned && (
                            <Pin
                              className="h-3 w-3 shrink-0 text-brass"
                              aria-label={t.sidebarPinned}
                            />
                          )}
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
                          className={`flex ${mobile ? 'h-11 w-11' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:opacity-100 ${
                            isMenuOpen || mobile
                              ? 'bg-surface text-ink opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>

          {/* Solo 1-on-1 AI Bots */}
          <div className="min-w-0 w-full">
            <SectionHeader
              label={t.botsTitle}
              meta={`${bots.length}/${botCap}`}
              open={botsOpen}
              onToggle={() => setBotsOpen((v) => !v)}
              controls="sidebar-bots-list"
              toggleLabel={botsOpen ? t.wsCollapse : t.wsExpand}
            />
            {botsOpen &&
              (bots.length === 0 ? (
                <p className="px-3 py-1 text-xs leading-relaxed text-ink-muted">{t.botsEmpty}</p>
              ) : (
                <ul id="sidebar-bots-list" className="grid grid-cols-1 gap-1">
                  {bots.map((bot) => {
                    const locked = isBotDisabled(bot.id);
                    const isActive =
                      currentView === 'chat-room' &&
                      currentRoom?.kind === 'solo' &&
                      currentRoom?.botId === bot.id;
                    const keyMeta = apiKeys.find((key) => key.provider === bot.provider);
                    return (
                      <li key={bot.id}>
                        <button
                          type="button"
                          data-sidebar-bot={bot.id}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            onClose?.();
                            openBotChat(bot.id);
                          }}
                          className={`flex ${rowHeight} w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors ${
                            isActive
                              ? 'bg-surface font-semibold text-ink shadow-sm ring-1 ring-brass/40'
                              : 'text-ink-muted hover:bg-surface/60 hover:text-ink'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brass/15 text-xs font-bold uppercase text-brass"
                          >
                            {(bot.name.trim()[0] ?? '?').toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{bot.name}</span>
                            <span className="block truncate text-[11px] font-normal text-ink-muted">
                              {providerLabel(bot.provider, keyMeta?.label)} · {modelLabel(bot.model)}
                            </span>
                          </span>
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
              ))}
          </div>
        </nav>
      </div>

      {/* QUICK ACCESS: API keys / Settings */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {isAdmin ? (
          <a
            href="/admin"
            className="flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-ink-muted hover:text-ink"
          >
            <UserStar className="h-4 w-4" aria-hidden="true" />
            {t.adminNav}
          </a>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            id="sidebar-api-keys-btn"
            onClick={() => go('api-keys')}
            aria-current={currentView === 'api-keys' ? 'page' : undefined}
            className={`${footerButton} ${
              currentView === 'api-keys' ? 'border-brass text-ink' : 'text-ink-muted'
            }`}
          >
            <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.wsApiKeys}</span>
          </button>
          <button
            type="button"
            id="sidebar-settings-btn"
            onClick={() => go('settings')}
            aria-current={currentView === 'settings' ? 'page' : undefined}
            className={`${footerButton} ${
              currentView === 'settings' ? 'border-brass text-ink' : 'text-ink-muted'
            }`}
            title={t.settingsTitle}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.wsSettings}</span>
          </button>
        </div>

        {mobile && authUser ? (
          <button
            type="button"
            onClick={() => {
              onClose?.();
              void signOut();
            }}
            className="flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-ink-muted hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t.signOut}
          </button>
        ) : null}

        <p className="flex items-center gap-1.5 px-1 text-[11px] leading-relaxed text-ink-muted">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate" title={t.boundaryShort}>
            {t.localBadge}
          </span>
        </p>
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
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
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
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
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
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
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
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
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
              className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                confirmDeleteId === activeGroupForMenu.id
                  ? 'bg-terracotta text-accent-ink'
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
