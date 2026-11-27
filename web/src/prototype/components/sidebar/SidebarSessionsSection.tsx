'use client';

/**
 * Compact recent solo-sessions list inside the workspace Sidebar with bounded density,
 * inline rename, pin/unpin, last-session delete protection, and unified popup menus.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, MessageSquare, MoreHorizontal, Pin, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fill } from '../../bot-settings-panel-logic';
import {
  RECENT_SOLO_SESSIONS_LIMIT,
  SIDEBAR_SESSION_COPY,
  canDeleteSoloSession,
  formatRelativeTime,
  partitionBoundedSessions,
  resolveSoloSessionBotId,
  selectOrderedSoloSessions,
} from '../../sidebar-organization';
import type { SavedConversation } from '../../types';
import { POPOVER_WIDTH, SectionHeader, computeMenuPosition } from './GroupActionMenu';
import {
  adjustMenuRectToViewport,
  clampMenuToViewport,
  handleFloatingMenuKeyDown,
} from './SidebarBotsSection';
import { SessionActionMenu, type SessionPopoverState } from './SessionActionMenu';

const SESSION_POPOVER_ESTIMATED_HEIGHT = 228;

interface SidebarSessionsSectionProps {
  open: boolean;
  onToggle: () => void;
  rowHeight: string;
  mobile?: boolean;
  onClose?: () => void;
  pinnedIds: readonly string[];
  onTogglePin: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  closeMenuRef?: React.MutableRefObject<(() => void) | null>;
  onBeforeOpenMenu?: () => void;
  onBeforeNavigate?: () => void;
}

export const SidebarSessionsSection: React.FC<SidebarSessionsSectionProps> = ({
  open,
  onToggle,
  rowHeight,
  mobile = false,
  onClose,
  pinnedIds,
  onTogglePin,
  onDeleteSession,
  closeMenuRef,
  onBeforeOpenMenu,
  onBeforeNavigate,
}) => {
  const {
    bots,
    conversations,
    currentRoom,
    currentView,
    language,
    openBotChat,
    renameConversation,
    t,
  } = useApp();

  const sessionCopy = SIDEBAR_SESSION_COPY[language];

  const [sessionMenu, setSessionMenu] = useState<SessionPopoverState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expandedAll, setExpandedAll] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);

  const validBotIds = useMemo(() => new Set(bots.map((bot) => bot.id)), [bots]);
  const botNameById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot.name])), [bots]);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const orderedSessions = useMemo(
    () => selectOrderedSoloSessions(conversations, pinnedIds, validBotIds),
    [conversations, pinnedIds, validBotIds]
  );

  const { visible: visibleSessions, canExpand } = useMemo(
    () => partitionBoundedSessions(orderedSessions, expandedAll, RECENT_SOLO_SESSIONS_LIMIT),
    [orderedSessions, expandedAll]
  );

  const closeSessionMenu = useCallback((restoreFocus = false) => {
    setSessionMenu(null);
    setConfirmDeleteId(null);
    const focusTarget = restoreFocus ? triggerElRef.current : null;
    triggerElRef.current = null;
    if (focusTarget && focusTarget.isConnected) {
      requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
    }
  }, []);

  useEffect(() => {
    if (!closeMenuRef) return;
    closeMenuRef.current = () => closeSessionMenu(false);
    return () => {
      closeMenuRef.current = null;
    };
  }, [closeMenuRef, closeSessionMenu]);

  useLayoutEffect(() => {
    if (!sessionMenu || !sessionMenuRef.current) return;
    const rect = sessionMenuRef.current.getBoundingClientRect();
    const clamped = adjustMenuRectToViewport(
      { top: sessionMenu.top, left: sessionMenu.left },
      {
        width: rect.width || POPOVER_WIDTH,
        height: rect.height || SESSION_POPOVER_ESTIMATED_HEIGHT,
      },
      { width: window.innerWidth, height: window.innerHeight }
    );
    sessionMenuRef.current.style.top = `${clamped.top}px`;
    sessionMenuRef.current.style.left = `${clamped.left}px`;
  }, [sessionMenu, confirmDeleteId]);

  useEffect(() => {
    if (!sessionMenu) return;
    const frame = requestAnimationFrame(() => {
      sessionMenuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
        ?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      handleFloatingMenuKeyDown(event, sessionMenuRef.current, closeSessionMenu);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node) {
        if (sessionMenuRef.current?.contains(target)) return;
        if (event.button === 0 && triggerElRef.current?.contains(target)) return;
      }
      closeSessionMenu(false);
    };
    const onResize = () => closeSessionMenu(false);

    const menuEl = sessionMenuRef.current;
    const stopInsidePointerDown = (event: PointerEvent) => {
      // Keep window-level outside-click listeners (e.g. mobile drawer) from
      // dismissing the drawer before a portaled menu item click fires.
      event.stopPropagation();
    };
    menuEl?.addEventListener('pointerdown', stopInsidePointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      menuEl?.removeEventListener('pointerdown', stopInsidePointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, [sessionMenu, closeSessionMenu]);

  const openSessionMenuFromTrigger = (
    sessionId: string,
    trigger: HTMLElement,
    toggle = false
  ) => {
    if (toggle && sessionMenu?.sessionId === sessionId) {
      closeSessionMenu(false);
      return;
    }
    onBeforeOpenMenu?.();
    setConfirmDeleteId(null);
    triggerElRef.current = trigger;
    const pos = computeMenuPosition(trigger);
    setSessionMenu({ sessionId, ...pos });
  };

  const openSessionContextMenu = (
    sessionId: string,
    clientX: number,
    clientY: number,
    focusAnchor: HTMLElement
  ) => {
    onBeforeOpenMenu?.();
    setConfirmDeleteId(null);
    triggerElRef.current = focusAnchor;
    const pos = clampMenuToViewport(
      { x: clientX, y: clientY },
      { width: POPOVER_WIDTH, height: SESSION_POPOVER_ESTIMATED_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight }
    );
    setSessionMenu({ sessionId, ...pos });
  };

  const handleOpenSession = (session: SavedConversation) => {
    closeSessionMenu(false);
    onBeforeNavigate?.();
    onClose?.();
    const botId = resolveSoloSessionBotId(session);
    if (!botId) return;
    openBotChat(botId, session.id);
  };

  const handleStartRename = (session: SavedConversation) => {
    closeSessionMenu(false);
    setRenamingSessionId(session.id);
    setRenameDraft(session.title);
  };

  const handleCommitRename = async (sessionId: string) => {
    const clean = renameDraft.trim();
    setRenamingSessionId(null);
    if (!clean) return;
    await renameConversation(sessionId, clean);
  };

  const handleCancelRename = (sessionId: string, restoreFocus = false) => {
    setRenamingSessionId(null);
    if (restoreFocus) {
      requestAnimationFrame(() => {
        const triggers = sectionRef.current?.querySelectorAll<HTMLElement>(
          '[data-session-menu-trigger]'
        );
        if (!triggers) return;
        for (const el of triggers) {
          if (el.getAttribute('data-session-menu-trigger') === sessionId) {
            el.focus({ preventScroll: true });
            break;
          }
        }
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!canDeleteSoloSession(conversations, sessionId)) {
      setConfirmDeleteId(null);
      return;
    }
    closeSessionMenu(false);
    await onDeleteSession(sessionId);
  };

  const activeSessionForMenu = sessionMenu
    ? orderedSessions.find((session) => session.id === sessionMenu.sessionId) ?? null
    : null;

  const activeSessionCanDelete = activeSessionForMenu
    ? canDeleteSoloSession(conversations, activeSessionForMenu.id)
    : false;

  const triggerSizeClass = mobile
    ? 'h-11 w-11'
    : 'h-9 w-9 [@media(hover:none)]:h-10 [@media(hover:none)]:w-10';

  const renderedSessionMenu =
    sessionMenu && activeSessionForMenu ? (
      <SessionActionMenu
        menu={sessionMenu}
        session={activeSessionForMenu}
        menuRef={sessionMenuRef}
        isPinned={pinnedSet.has(activeSessionForMenu.id)}
        canDelete={activeSessionCanDelete}
        confirmDeleteId={confirmDeleteId}
        onOpen={handleOpenSession}
        onRename={handleStartRename}
        onTogglePin={(sessionId) => {
          onTogglePin(sessionId);
          closeSessionMenu(false);
        }}
        onConfirmOrDelete={(sessionId) => {
          if (!canDeleteSoloSession(conversations, sessionId)) return;
          if (confirmDeleteId !== sessionId) {
            setConfirmDeleteId(sessionId);
            return;
          }
          void handleDeleteSession(sessionId);
        }}
        onCancelConfirm={() => setConfirmDeleteId(null)}
      />
    ) : null;

  return (
    <div ref={sectionRef} className="min-w-0 w-full" data-sidebar-sessions-section>
      <SectionHeader
        label={sessionCopy.sectionTitle}
        meta={orderedSessions.length > 0 ? String(orderedSessions.length) : undefined}
        open={open}
        onToggle={onToggle}
        controls="sidebar-sessions-list"
        toggleLabel={open ? t.wsCollapse : t.wsExpand}
      />

      {open &&
        (orderedSessions.length === 0 ? (
          <p
            data-sidebar-sessions-empty
            className="px-3 py-1 text-xs leading-relaxed text-ink-muted"
          >
            {sessionCopy.emptyText}
          </p>
        ) : (
          <div id="sidebar-sessions-list" className="grid grid-cols-1 gap-1">
            <ul className="grid grid-cols-1 gap-1">
              {visibleSessions.map((session) => {
                const isActive =
                  currentView === 'chat-room' &&
                  currentRoom?.kind === 'solo' &&
                  currentRoom?.conversationId === session.id;
                const isRenaming = renamingSessionId === session.id;
                const isPinned = pinnedSet.has(session.id);
                const isMenuOpen = sessionMenu?.sessionId === session.id;
                const botId = resolveSoloSessionBotId(session);
                const botName = botId ? botNameById.get(botId) : undefined;
                const timestampIso = session.updatedAt || session.createdAt;
                const relativeUpdated = formatRelativeTime(timestampIso, language);
                const moreActionsLabel = fill(t.sidebarBotMoreActions, {
                  name: session.title,
                });

                if (isRenaming) {
                  return (
                    <li
                      key={session.id}
                      data-sidebar-session={session.id}
                      className="flex min-w-0 items-center gap-1 rounded-lg bg-surface px-1.5 py-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        data-session-rename-input={session.id}
                        value={renameDraft}
                        maxLength={100}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleCommitRename(session.id);
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            handleCancelRename(session.id, true);
                          }
                        }}
                        aria-label={t.sidebarActionRename}
                        className="min-h-9 min-w-0 flex-1 rounded-md border border-brass bg-background px-2 py-1 text-sm text-ink outline-none"
                      />
                      <button
                        type="button"
                        data-session-rename-save={session.id}
                        onClick={() => void handleCommitRename(session.id)}
                        aria-label={t.groupSaveChanges}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brass hover:bg-surface-2"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        data-session-rename-cancel={session.id}
                        onClick={() => handleCancelRename(session.id, false)}
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
                    key={session.id}
                    data-sidebar-session={session.id}
                    data-sidebar-pinned={isPinned ? 'true' : undefined}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (event.button !== 2 || (event.clientX === 0 && event.clientY === 0)) {
                        const kbAnchor =
                          event.target instanceof HTMLElement ? event.target : event.currentTarget;
                        openSessionMenuFromTrigger(session.id, kbAnchor, false);
                        return;
                      }
                      const focusAnchor =
                        event.currentTarget.querySelector<HTMLElement>(
                          `[data-session-menu-trigger="${session.id}"]`
                        ) ?? event.currentTarget;
                      openSessionContextMenu(
                        session.id,
                        event.clientX,
                        event.clientY,
                        focusAnchor
                      );
                    }}
                    className={`group flex min-w-0 items-center gap-1 rounded-lg px-1 transition-colors ${
                      isActive
                        ? 'bg-surface shadow-sm ring-1 ring-brass/40'
                        : 'hover:bg-surface/60'
                    }`}
                  >
                    <button
                      type="button"
                      data-sidebar-session-open={session.id}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => handleOpenSession(session)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'ContextMenu' ||
                          (event.shiftKey && event.key === 'F10')
                        ) {
                          event.preventDefault();
                          openSessionMenuFromTrigger(session.id, event.currentTarget, false);
                        }
                      }}
                      className={`flex ${rowHeight} min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-left text-sm ${
                        isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span data-session-title={session.id} className="block truncate">
                          {session.title}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-[11px] font-normal text-ink-muted">
                          {botName ? (
                            <>
                              <span className="truncate">{botName}</span>
                              {relativeUpdated ? <span aria-hidden="true">·</span> : null}
                            </>
                          ) : null}
                          {relativeUpdated ? (
                            <time
                              dateTime={timestampIso}
                              data-session-updated={session.id}
                              className="shrink-0"
                            >
                              {relativeUpdated}
                            </time>
                          ) : null}
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
                      data-session-menu-trigger={session.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openSessionMenuFromTrigger(session.id, event.currentTarget, true);
                      }}
                      aria-label={moreActionsLabel}
                      title={moreActionsLabel}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      className={`flex ${triggerSizeClass} shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:opacity-100 ${
                        isMenuOpen || mobile
                          ? 'bg-surface text-ink opacity-100'
                          : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
                      }`}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {canExpand && (
              <button
                type="button"
                data-sessions-expand-toggle
                aria-expanded={expandedAll}
                onClick={() => setExpandedAll((prev) => !prev)}
                className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-ink-muted transition hover:bg-surface/60 hover:text-ink"
              >
                <span>
                  {expandedAll
                    ? sessionCopy.showLess
                    : fill(sessionCopy.showAll, { count: orderedSessions.length })}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    expandedAll ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        ))}

      {renderedSessionMenu && typeof document !== 'undefined'
        ? createPortal(renderedSessionMenu, document.body)
        : renderedSessionMenu}
    </div>
  );
};
