'use client';

/**
 * Left-hand workspace navigation sidebar (group chats, solo bots, API keys, and settings).
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import type { SavedConversation, ViewType } from '../types';
import {
  Check,
  KeyRound,
  Lock,
  LogOut,
  MoreHorizontal,
  Pin,
  Plus,
  Settings,
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
import {
  GroupActionMenu,
  POPOVER_WIDTH,
  SectionHeader,
  computeMenuPosition,
  type GroupPopoverState,
} from './sidebar/GroupActionMenu';
import {
  SidebarBotsSection,
  adjustMenuRectToViewport,
  clampMenuToViewport,
  handleFloatingMenuKeyDown,
} from './sidebar/SidebarBotsSection';

const GROUP_POPOVER_ESTIMATED_HEIGHT = 248;

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobile = false, onClose }) => {
  const {
    authUser,
    conversations,
    currentRoom,
    currentView,
    deleteConversationById,
    isAdmin,
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
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const closeBotMenuRef = useRef<(() => void) | null>(null);

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

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenu(null);
    setConfirmDeleteId(null);
    const focusTarget = restoreFocus ? menuTriggerRef.current : null;
    menuTriggerRef.current = null;
    if (focusTarget && focusTarget.isConnected) {
      requestAnimationFrame(() => focusTarget.focus());
    }
  }, []);

  const go = (view: ViewType) => {
    closeMenu(false);
    closeBotMenuRef.current?.();
    onClose?.();
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const clamped = adjustMenuRectToViewport(
      { top: menu.top, left: menu.left },
      {
        width: rect.width || POPOVER_WIDTH,
        height: rect.height || GROUP_POPOVER_ESTIMATED_HEIGHT,
      },
      { width: window.innerWidth, height: window.innerHeight }
    );
    menuRef.current.style.top = `${clamped.top}px`;
    menuRef.current.style.left = `${clamped.left}px`;
  }, [menu, confirmDeleteId]);

  useEffect(() => {
    if (!menu) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      handleFloatingMenuKeyDown(event, menuRef.current, closeMenu);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node) {
        if (menuRef.current?.contains(target)) return;
        if (event.button === 0 && menuTriggerRef.current?.contains(target)) return;
      }
      closeMenu(false);
    };
    const onResize = () => {
      closeMenu(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, [menu, closeMenu]);

  const openGroupMenu = (groupId: string, trigger: HTMLElement, toggle = true) => {
    if (toggle && menu?.groupId === groupId) {
      closeMenu(false);
      return;
    }
    closeBotMenuRef.current?.();
    setConfirmDeleteId(null);
    menuTriggerRef.current = trigger;
    const pos = computeMenuPosition(trigger);
    setMenu({ groupId, ...pos });
  };

  const openGroupContextMenu = (
    groupId: string,
    clientX: number,
    clientY: number,
    focusAnchor: HTMLElement
  ) => {
    closeBotMenuRef.current?.();
    setConfirmDeleteId(null);
    menuTriggerRef.current = focusAnchor;
    const pos = clampMenuToViewport(
      { x: clientX, y: clientY },
      { width: POPOVER_WIDTH, height: GROUP_POPOVER_ESTIMATED_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight }
    );
    setMenu({ groupId, ...pos });
  };

  const handleStartRename = (group: SavedConversation) => {
    closeMenu(false);
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
    closeMenu(false);
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
    closeMenu(false);
    await deleteConversationById(groupId);
    const remaining = new Set(groupChats.filter((g) => g.id !== groupId).map((g) => g.id));
    updateOrg((cur) => pruneRemovedConversations(cur, remaining));
  };

  const activeGroupForMenu = menu
    ? groupChats.find((g) => g.id === menu.groupId) ?? null
    : null;

  const rowHeight = mobile ? 'min-h-11' : 'min-h-10';
  const footerButton =
    'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition hover:border-brass/60 hover:text-ink';

  const renderedGroupMenu =
    menu && activeGroupForMenu ? (
      <GroupActionMenu
        menu={menu}
        group={activeGroupForMenu}
        menuRef={menuRef}
        isPinned={pinnedSet.has(activeGroupForMenu.id)}
        confirmDeleteId={confirmDeleteId}
        onRename={handleStartRename}
        onEditGroup={(groupId) => {
          closeMenu(false);
          onClose?.();
          openEditGroup(groupId);
        }}
        onTogglePin={(groupId) => {
          updateOrg((cur) => togglePinConversation(cur, groupId));
          closeMenu(false);
        }}
        onExport={handleExportGroup}
        onConfirmOrDelete={(groupId) => {
          if (confirmDeleteId !== groupId) {
            setConfirmDeleteId(groupId);
            return;
          }
          void handleDeleteGroup(groupId);
        }}
      />
    ) : null;

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
                closeMenu(false);
                closeBotMenuRef.current?.();
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
          onScroll={() => {
            if (menu) closeMenu(false);
            closeBotMenuRef.current?.();
          }}
          className="grid min-w-0 grid-cols-1 content-start gap-4 overflow-y-auto overflow-x-hidden pr-0.5"
          aria-label={t.workspaceNavigation}
        >
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
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const focusAnchor =
                            event.currentTarget.querySelector<HTMLElement>(
                              `[data-group-menu-trigger="${group.id}"]`
                            ) ?? event.currentTarget;
                          openGroupContextMenu(group.id, event.clientX, event.clientY, focusAnchor);
                        }}
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
                            closeMenu(false);
                            closeBotMenuRef.current?.();
                            onClose?.();
                            openGroupChat(group.id);
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key === 'ContextMenu' ||
                              (event.shiftKey && event.key === 'F10')
                            ) {
                              event.preventDefault();
                              openGroupMenu(group.id, event.currentTarget, false);
                            }
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
                            openGroupMenu(group.id, event.currentTarget, true);
                          }}
                          aria-label={t.sidebarMoreActions}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          className={`flex ${mobile ? 'h-11 w-11' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:opacity-100 ${
                            isMenuOpen || mobile
                              ? 'bg-surface text-ink opacity-100'
                              : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
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

          <SidebarBotsSection
            open={botsOpen}
            onToggle={() => setBotsOpen((v) => !v)}
            rowHeight={rowHeight}
            mobile={mobile}
            onClose={onClose}
            closeMenuRef={closeBotMenuRef}
            onBeforeOpenMenu={() => closeMenu(false)}
          />
        </nav>
      </div>

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

      {renderedGroupMenu && typeof document !== 'undefined'
        ? createPortal(renderedGroupMenu, document.body)
        : renderedGroupMenu}
    </aside>
  );
};
