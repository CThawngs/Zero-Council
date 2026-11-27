'use client';

/**
 * Collapsible "My bots" solo 1-on-1 navigation list inside the workspace Sidebar,
 * with per-bot fresh-thread (+) actions and an accessible right-click / keyboard context menu.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Lock, MessageSquarePlus, MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { modelLabel, providerLabel } from '../../data/catalog';
import { fill } from '../../bot-settings-panel-logic';
import type { UserBot } from '../../types';
import { Modal } from '../Modal';
import { POPOVER_WIDTH, SectionHeader, computeMenuPosition } from './GroupActionMenu';

export interface MenuPoint {
  x: number;
  y: number;
}

export interface MenuDimensions {
  width: number;
  height: number;
}

export const MENU_VIEWPORT_MARGIN = 10;
const BOT_POPOVER_ESTIMATED_HEIGHT = 164;

/**
 * Computes a viewport-clamped fixed position from a pointer point (e.g. contextmenu clientX/Y).
 */
export const clampMenuToViewport = (
  point: MenuPoint,
  size: MenuDimensions,
  viewport: MenuDimensions,
  margin = MENU_VIEWPORT_MARGIN
): { top: number; left: number } => {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);

  let left = point.x;
  if (left + size.width > viewport.width - margin) {
    left = point.x - size.width;
  }
  left = Math.max(margin, Math.min(left, maxLeft));

  let top = point.y;
  if (top + size.height > viewport.height - margin) {
    top = point.y - size.height;
  }
  top = Math.max(margin, Math.min(top, maxTop));

  return { top: Math.round(top), left: Math.round(left) };
};

/**
 * Re-clamps an already-positioned menu using its real measured DOM dimensions.
 */
export const adjustMenuRectToViewport = (
  pos: { top: number; left: number },
  measured: MenuDimensions,
  viewport: MenuDimensions,
  margin = MENU_VIEWPORT_MARGIN
): { top: number; left: number } => {
  const maxLeft = Math.max(margin, viewport.width - measured.width - margin);
  const maxTop = Math.max(margin, viewport.height - measured.height - margin);
  return {
    top: Math.round(Math.max(margin, Math.min(pos.top, maxTop))),
    left: Math.round(Math.max(margin, Math.min(pos.left, maxLeft))),
  };
};

/**
 * Handles keyboard navigation (ArrowUp/Down, Home/End, Escape, Tab) for a floating ARIA menu.
 */
export const handleFloatingMenuKeyDown = (
  event: KeyboardEvent,
  menuEl: HTMLElement | null,
  onClose: (restoreFocus: boolean) => void
) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    onClose(true);
    return;
  }
  if (event.key === 'Tab') {
    onClose(false);
    return;
  }
  if (!menuEl) return;
  const items = Array.from(
    menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')
  );
  if (items.length === 0) return;

  const activeIndex = items.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    items[(activeIndex + 1 + items.length) % items.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    items[(activeIndex - 1 + items.length) % items.length]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    items[0]?.focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    items[items.length - 1]?.focus();
  }
};

interface BotMenuState {
  botId: string;
  top: number;
  left: number;
}

interface SidebarBotsSectionProps {
  open: boolean;
  onToggle: () => void;
  rowHeight: string;
  mobile?: boolean;
  onClose?: () => void;
  closeMenuRef?: React.MutableRefObject<(() => void) | null>;
  onBeforeOpenMenu?: () => void;
}

export const SidebarBotsSection: React.FC<SidebarBotsSectionProps> = ({
  open,
  onToggle,
  rowHeight,
  mobile = false,
  onClose,
  closeMenuRef,
  onBeforeOpenMenu,
}) => {
  const {
    apiKeys,
    bots,
    botCap,
    isBotDisabled,
    currentRoom,
    currentView,
    openBotChat,
    createSoloThread,
    openEditBot,
    deleteBot,
    openFirstBotOrWizard,
    t,
  } = useApp();

  const [botMenu, setBotMenu] = useState<BotMenuState | null>(null);
  const [creatingForBotId, setCreatingForBotId] = useState<string | null>(null);
  const [pendingDeleteBot, setPendingDeleteBot] = useState<UserBot | null>(null);
  const [deletingBot, setDeletingBot] = useState(false);

  const botMenuRef = useRef<HTMLDivElement>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);

  const closeBotMenu = useCallback((restoreFocus = false) => {
    setBotMenu(null);
    const focusTarget = restoreFocus ? triggerElRef.current : null;
    triggerElRef.current = null;
    if (focusTarget && focusTarget.isConnected) {
      requestAnimationFrame(() => focusTarget.focus());
    }
  }, []);

  useEffect(() => {
    if (!closeMenuRef) return;
    closeMenuRef.current = () => closeBotMenu(false);
    return () => {
      closeMenuRef.current = null;
    };
  }, [closeMenuRef, closeBotMenu]);

  useLayoutEffect(() => {
    if (!botMenu || !botMenuRef.current) return;
    const rect = botMenuRef.current.getBoundingClientRect();
    const clamped = adjustMenuRectToViewport(
      { top: botMenu.top, left: botMenu.left },
      { width: rect.width || POPOVER_WIDTH, height: rect.height || BOT_POPOVER_ESTIMATED_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight }
    );
    botMenuRef.current.style.top = `${clamped.top}px`;
    botMenuRef.current.style.left = `${clamped.left}px`;
  }, [botMenu]);

  useEffect(() => {
    if (!botMenu) return;
    const frame = requestAnimationFrame(() => {
      botMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      handleFloatingMenuKeyDown(event, botMenuRef.current, closeBotMenu);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node) {
        if (botMenuRef.current?.contains(target)) return;
        if (event.button === 0 && triggerElRef.current?.contains(target)) return;
      }
      closeBotMenu(false);
    };
    const onResize = () => closeBotMenu(false);

    const menuEl = botMenuRef.current;
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
  }, [botMenu, closeBotMenu]);

  useEffect(() => {
    if (!pendingDeleteBot) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!deletingBot) setPendingDeleteBot(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pendingDeleteBot, deletingBot]);

  const openBotMenuFromTrigger = (botId: string, trigger: HTMLElement, toggle = false) => {
    if (toggle && botMenu?.botId === botId) {
      closeBotMenu(false);
      return;
    }
    onBeforeOpenMenu?.();
    triggerElRef.current = trigger;
    const pos = computeMenuPosition(trigger);
    setBotMenu({ botId, ...pos });
  };

  const openBotContextMenu = (
    botId: string,
    clientX: number,
    clientY: number,
    focusAnchor: HTMLElement
  ) => {
    onBeforeOpenMenu?.();
    triggerElRef.current = focusAnchor;
    const pos = clampMenuToViewport(
      { x: clientX, y: clientY },
      { width: POPOVER_WIDTH, height: BOT_POPOVER_ESTIMATED_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight }
    );
    setBotMenu({ botId, ...pos });
  };

  const handleNewSoloChat = async (botId: string) => {
    if (creatingForBotId === botId) return;
    closeBotMenu(false);
    setCreatingForBotId(botId);
    try {
      onClose?.();
      await createSoloThread(botId);
    } finally {
      setCreatingForBotId((current) => (current === botId ? null : current));
    }
  };

  const handleEditBot = (botId: string) => {
    closeBotMenu(false);
    onClose?.();
    openEditBot(botId);
  };

  const handleConfirmDeleteBot = async () => {
    if (!pendingDeleteBot || deletingBot) return;
    const targetId = pendingDeleteBot.id;
    const wasActiveSolo = currentRoom?.kind === 'solo' && currentRoom?.botId === targetId;
    setDeletingBot(true);
    try {
      await deleteBot(targetId);
      setPendingDeleteBot(null);
      if (wasActiveSolo) {
        openFirstBotOrWizard(targetId);
        onClose?.();
      }
    } finally {
      setDeletingBot(false);
    }
  };

  const activeBotForMenu = botMenu
    ? bots.find((bot) => bot.id === botMenu.botId) ?? null
    : null;

  const actionButtonSize = mobile ? 'h-10 w-10' : 'h-8 w-8';

  const renderedBotMenu =
    botMenu && activeBotForMenu ? (
      <div
        ref={botMenuRef}
        role="menu"
        aria-label={fill(t.sidebarBotMoreActions, { name: activeBotForMenu.name })}
        data-sidebar-popover="bot"
        data-sidebar-popover-bot-id={activeBotForMenu.id}
        style={{
          top: `${botMenu.top}px`,
          left: `${botMenu.left}px`,
          width: `${POPOVER_WIDTH}px`,
        }}
        className="fixed z-[80] rounded-2xl border border-border bg-surface p-1.5 shadow-2xl"
      >
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            role="menuitem"
            data-bot-menu-new-chat={activeBotForMenu.id}
            onClick={() => void handleNewSoloChat(activeBotForMenu.id)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>{t.sidebarMenuNewChat}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            data-bot-menu-edit={activeBotForMenu.id}
            onClick={() => handleEditBot(activeBotForMenu.id)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
          >
            <Settings2 className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>{t.sidebarActionEditBot}</span>
          </button>

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            role="menuitem"
            data-bot-menu-delete={activeBotForMenu.id}
            onClick={() => {
              const target = activeBotForMenu;
              closeBotMenu(false);
              setPendingDeleteBot(target);
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-terracotta transition hover:bg-terracotta/10"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.wsDeleteBot}</span>
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="min-w-0 w-full">
      <SectionHeader
        label={t.botsTitle}
        meta={`${bots.length}/${botCap}`}
        open={open}
        onToggle={onToggle}
        controls="sidebar-bots-list"
        toggleLabel={open ? t.wsCollapse : t.wsExpand}
      />
      {open &&
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
              const isMenuOpen = botMenu?.botId === bot.id;
              const isCreating = creatingForBotId === bot.id;
              const keyMeta = apiKeys.find((key) => key.provider === bot.provider);
              const newChatLabel = fill(t.sidebarBotNewChatWith, { name: bot.name });
              const moreActionsLabel = fill(t.sidebarBotMoreActions, { name: bot.name });

              return (
                <li
                  key={bot.id}
                  data-sidebar-bot-row={bot.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const focusAnchor =
                      event.currentTarget.querySelector<HTMLElement>(`[data-sidebar-bot="${bot.id}"]`) ??
                      event.currentTarget;
                    openBotContextMenu(bot.id, event.clientX, event.clientY, focusAnchor);
                  }}
                  className={`group flex min-w-0 items-center gap-0.5 rounded-lg px-1 transition-colors ${
                    isActive
                      ? 'bg-surface shadow-sm ring-1 ring-brass/40'
                      : 'hover:bg-surface/60'
                  }`}
                >
                  <button
                    type="button"
                    data-sidebar-bot={bot.id}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      closeBotMenu(false);
                      onClose?.();
                      openBotChat(bot.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                        event.preventDefault();
                        openBotMenuFromTrigger(bot.id, event.currentTarget);
                      }
                    }}
                    className={`flex ${rowHeight} min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-sm ${
                      isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'
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

                  <button
                    type="button"
                    data-bot-new-chat={bot.id}
                    disabled={isCreating}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleNewSoloChat(bot.id);
                    }}
                    aria-label={newChatLabel}
                    title={newChatLabel}
                    className={`flex ${actionButtonSize} shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:opacity-100 disabled:opacity-50 ${
                      mobile ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'
                    }`}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brass" aria-hidden="true" />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-bot-menu-trigger={bot.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      openBotMenuFromTrigger(bot.id, event.currentTarget, true);
                    }}
                    aria-label={moreActionsLabel}
                    title={moreActionsLabel}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    className={`flex ${actionButtonSize} shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:opacity-100 ${
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

      {renderedBotMenu && typeof document !== 'undefined'
        ? createPortal(renderedBotMenu, document.body)
        : renderedBotMenu}

      <Modal
        isOpen={Boolean(pendingDeleteBot)}
        onClose={() => {
          if (!deletingBot) setPendingDeleteBot(null);
        }}
        onBeforeClose={() => !deletingBot}
        title={t.wsDeleteBot}
        description={
          pendingDeleteBot ? fill(t.wsDeleteConfirmBody, { name: pendingDeleteBot.name }) : undefined
        }
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              data-bot-delete-cancel
              disabled={deletingBot}
              onClick={() => setPendingDeleteBot(null)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.wsDeleteCancel}
            </button>
            <button
              type="button"
              data-bot-delete-confirm
              disabled={deletingBot}
              onClick={() => void handleConfirmDeleteBot()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
            >
              {deletingBot ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              {deletingBot ? t.wsDeleting : t.wsDeleteConfirm}
            </button>
          </>
        }
      />
    </div>
  );
};
