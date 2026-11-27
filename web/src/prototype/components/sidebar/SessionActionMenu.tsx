'use client';

/**
 * Floating context/action menu for solo session rows inside the workspace Sidebar.
 */

import React from 'react';
import { MessageSquare, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fill } from '../../bot-settings-panel-logic';
import { SIDEBAR_SESSION_COPY } from '../../sidebar-organization';
import type { SavedConversation } from '../../types';
import { POPOVER_WIDTH } from './GroupActionMenu';

export interface SessionPopoverState {
  sessionId: string;
  top: number;
  left: number;
}

interface SessionActionMenuProps {
  menu: SessionPopoverState;
  session: SavedConversation;
  menuRef: React.Ref<HTMLDivElement>;
  isPinned: boolean;
  canDelete: boolean;
  confirmDeleteId: string | null;
  onOpen: (session: SavedConversation) => void;
  onRename: (session: SavedConversation) => void;
  onTogglePin: (sessionId: string) => void;
  onConfirmOrDelete: (sessionId: string) => void;
  onCancelConfirm: () => void;
}

export const SessionActionMenu: React.FC<SessionActionMenuProps> = ({
  menu,
  session,
  menuRef,
  isPinned,
  canDelete,
  confirmDeleteId,
  onOpen,
  onRename,
  onTogglePin,
  onConfirmOrDelete,
  onCancelConfirm,
}) => {
  const { language, t } = useApp();
  const sessionCopy = SIDEBAR_SESSION_COPY[language];
  const isConfirming = canDelete && confirmDeleteId === session.id;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={fill(t.sidebarBotMoreActions, { name: session.title })}
      data-sidebar-popover="session"
      data-sidebar-popover-session-id={session.id}
      style={{ top: `${menu.top}px`, left: `${menu.left}px`, width: `${POPOVER_WIDTH}px` }}
      className="fixed z-[80] rounded-2xl border border-border bg-surface p-1.5 shadow-2xl"
    >
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          role="menuitem"
          data-session-menu-open={session.id}
          onClick={() => onOpen(session)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>{sessionCopy.openAction}</span>
        </button>

        <button
          type="button"
          role="menuitem"
          data-session-menu-rename={session.id}
          onClick={() => onRename(session)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          <Pencil className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>{sessionCopy.renameAction}</span>
        </button>

        <button
          type="button"
          role="menuitem"
          data-session-menu-pin={session.id}
          onClick={() => onTogglePin(session.id)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          {isPinned ? (
            <PinOff className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          ) : (
            <Pin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          )}
          <span>{isPinned ? sessionCopy.unpinAction : sessionCopy.pinAction}</span>
        </button>

        <div className="my-1 border-t border-border" />

        <button
          key="session-delete-action"
          type="button"
          role="menuitem"
          disabled={!canDelete}
          aria-disabled={!canDelete}
          data-session-menu-delete={session.id}
          data-session-delete-disabled={!canDelete ? 'true' : undefined}
          title={!canDelete ? sessionCopy.lastSessionHint : undefined}
          onClick={() => {
            if (!canDelete) return;
            onConfirmOrDelete(session.id);
          }}
          className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
            !canDelete
              ? 'cursor-not-allowed text-ink-muted opacity-60'
              : isConfirming
                ? 'bg-terracotta text-accent-ink'
                : 'text-terracotta hover:bg-terracotta/10'
          }`}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block">
              {isConfirming ? sessionCopy.confirmDeleteAction : sessionCopy.deleteAction}
            </span>
            {!canDelete && (
              <span className="block text-[11px] font-normal leading-snug text-ink-muted">
                {sessionCopy.lastSessionHint}
              </span>
            )}
          </span>
        </button>

        {isConfirming && (
          <button
            key="session-cancel-delete"
            type="button"
            role="menuitem"
            data-session-menu-cancel-delete={session.id}
            onClick={onCancelConfirm}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{sessionCopy.cancelDeleteAction}</span>
          </button>
        )}
      </div>
    </div>
  );
};
