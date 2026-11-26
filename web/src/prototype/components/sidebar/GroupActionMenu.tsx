'use client';

/**
 * Floating group-chat context menu and collapsible section header for the workspace Sidebar.
 */

import React from 'react';
import { ChevronDown, Download, Pencil, Pin, PinOff, Settings2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { SavedConversation } from '../../types';

export interface GroupPopoverState {
  groupId: string;
  top: number;
  left: number;
}

export const POPOVER_WIDTH = 224;
const POPOVER_ESTIMATED_HEIGHT = 236;

export const computeMenuPosition = (trigger: HTMLElement): { top: number; left: number } => {
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

export const SectionHeader: React.FC<{
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

interface GroupActionMenuProps {
  menu: GroupPopoverState;
  group: SavedConversation;
  menuRef: React.Ref<HTMLDivElement>;
  isPinned: boolean;
  confirmDeleteId: string | null;
  onRename: (group: SavedConversation) => void;
  onEditGroup: (groupId: string) => void;
  onTogglePin: (groupId: string) => void;
  onExport: (group: SavedConversation) => void;
  onConfirmOrDelete: (groupId: string) => void;
}

export const GroupActionMenu: React.FC<GroupActionMenuProps> = ({
  menu,
  group,
  menuRef,
  isPinned,
  confirmDeleteId,
  onRename,
  onEditGroup,
  onTogglePin,
  onExport,
  onConfirmOrDelete,
}) => {
  const { t } = useApp();
  const isConfirming = confirmDeleteId === group.id;

  return (
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
          onClick={() => onRename(group)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          <Pencil className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>{t.sidebarActionRename}</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => onEditGroup(group.id)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          <Settings2 className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>{t.sidebarActionEditGroup}</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => onTogglePin(group.id)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          {isPinned ? (
            <PinOff className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          ) : (
            <Pin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          )}
          <span>{isPinned ? t.sidebarActionUnpin : t.sidebarActionPin}</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => onExport(group)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-surface-2"
        >
          <Download className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>{t.sidebarActionExport}</span>
        </button>

        <div className="my-1 border-t border-border" />

        <button
          type="button"
          role="menuitem"
          data-group-menu-delete={group.id}
          onClick={() => onConfirmOrDelete(group.id)}
          className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
            isConfirming
              ? 'bg-terracotta text-accent-ink'
              : 'text-terracotta hover:bg-terracotta/10'
          }`}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isConfirming ? t.sidebarConfirmDelete : t.sidebarActionDelete}</span>
        </button>
      </div>
    </div>
  );
};
