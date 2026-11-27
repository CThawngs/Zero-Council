'use client';

/**
 * Collapsible "My bots" solo 1-on-1 navigation list inside the workspace Sidebar.
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { modelLabel, providerLabel } from '../../data/catalog';
import { SectionHeader } from './GroupActionMenu';

interface SidebarBotsSectionProps {
  open: boolean;
  onToggle: () => void;
  rowHeight: string;
  onClose?: () => void;
}

export const SidebarBotsSection: React.FC<SidebarBotsSectionProps> = ({
  open,
  onToggle,
  rowHeight,
  onClose,
}) => {
  const {
    apiKeys,
    bots,
    botCap,
    isBotDisabled,
    currentRoom,
    currentView,
    openBotChat,
    t,
  } = useApp();

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
  );
};
