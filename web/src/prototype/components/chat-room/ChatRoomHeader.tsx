/**
 * Chat room top bar, solo multi-thread switcher, plan-lock banner, and missing-key banner.
 */

import React from 'react';
import {
  Check,
  ClipboardList,
  KeyRound,
  Lock,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Settings2,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { USER_HANDLE } from '../../chat/engine';
import type { CHAT_UX_COPY } from '../../chat/mentions';
import { useApp } from '../../context/AppContext';
import type { ChatRoomState } from '../../context/types';
import type { Language } from '../../i18n';
import type { AdvisorPersona, SavedConversation } from '../../types';
import { Avatar } from './helpers';

interface ChatRoomHeaderProps {
  currentRoom: ChatRoomState;
  roster: AdvisorPersona[];
  disabledSet: Set<string>;
  isSolo: boolean;
  isRunning: boolean;
  soloBotLocked: boolean;
  groupLockedCount: number;
  planName: string;
  noKeyMessage: string | null;
  panelVisible: boolean;
  expanded: boolean;
  soloThreads: SavedConversation[];
  renamingThread: boolean;
  threadTitleDraft: string;
  ux: (typeof CHAT_UX_COPY)[Language];
  onToggleExpanded: () => void;
  onClearClick: () => void;
  onTogglePanel: () => void;
  onThreadTitleDraftChange: (next: string) => void;
  onStartRenameThread: () => void;
  onCancelRenameThread: () => void;
  onCommitRenameThread: () => void;
}

export const ChatRoomHeader: React.FC<ChatRoomHeaderProps> = ({
  currentRoom,
  roster,
  disabledSet,
  isSolo,
  isRunning,
  soloBotLocked,
  groupLockedCount,
  planName,
  noKeyMessage,
  panelVisible,
  expanded,
  soloThreads,
  renamingThread,
  threadTitleDraft,
  ux,
  onToggleExpanded,
  onClearClick,
  onTogglePanel,
  onThreadTitleDraftChange,
  onStartRenameThread,
  onCancelRenameThread,
  onCommitRenameThread,
}) => {
  const {
    stopRoom,
    wrapUpRoom,
    openBotChat,
    createSoloThread,
    deleteConversationById,
    botCap,
    goToPricing,
    setCurrentView,
    t,
  } = useApp();

  const visibleAvatars = roster.slice(0, 4);
  const overflowCount = Math.max(0, roster.length - visibleAvatars.length);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-[13rem] flex-1 items-center gap-2.5 overflow-hidden sm:min-w-[16rem]">
          <div className="flex shrink-0 -space-x-2" aria-hidden="true">
            {visibleAvatars.map((persona) => (
              <span
                key={persona.id}
                className={`rounded-full ring-2 ring-surface ${
                  disabledSet.has(persona.id) ? 'opacity-45 grayscale' : ''
                }`}
              >
                <Avatar name={persona.name} color={persona.colorHex} size="sm" />
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-[10px] font-semibold text-ink ring-2 ring-surface">
                +{overflowCount}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isRunning
                    ? 'animate-pulse bg-brass'
                    : soloBotLocked
                      ? 'bg-terracotta'
                      : 'bg-sage'
                }`}
                aria-hidden="true"
              />
              <h1 className="truncate font-serif text-base leading-tight text-ink sm:text-lg">
                {currentRoom.title}
              </h1>
              <span className="badge-neutral inline-flex shrink-0 text-[10px]">
                {isSolo ? t.soloBadge : t.groupBadge.replace('{count}', String(roster.length))}
              </span>
              {!isSolo && (
                <span className="badge-neutral inline-flex shrink-0 text-[10px]">
                  {currentRoom.mode === 'panel' ? t.modeIndependentTitle : t.modeDebateTitle}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink-muted">
              {roster
                .map((persona) =>
                  disabledSet.has(persona.id)
                    ? `${persona.name} (${t.botDisabledBadge})`
                    : persona.name
                )
                .join(', ')}
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          {isRunning && (
            <button
              type="button"
              onClick={stopRoom}
              aria-label={t.chatStop}
              title={t.chatStop}
              className="button-secondary min-h-8 justify-center px-2.5 text-xs"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.chatStop}</span>
            </button>
          )}
          {!isSolo && (
            <button
              type="button"
              onClick={wrapUpRoom}
              disabled={!currentRoom.messages.some((message) => message.authorId !== USER_HANDLE)}
              aria-label={t.chatWrapUp}
              title={t.chatWrapUpHint}
              className="button-secondary min-h-8 justify-center px-2.5 text-xs disabled:opacity-45"
            >
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.chatWrapUp}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClearClick}
            aria-label={t.chatClear}
            title={t.chatClear}
            className="button-quiet min-h-8 justify-center px-2 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t.chatClear}</span>
          </button>
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? t.chatCollapse : t.chatExpand}
            title={expanded ? t.chatCollapse : t.chatExpand}
            className="icon-button h-8 w-8 min-h-0 min-w-0 shrink-0"
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {isSolo && currentRoom.botId && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/40 px-3 py-1.5 text-xs sm:px-5 sm:py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span className="hidden shrink-0 font-semibold uppercase tracking-wider text-ink-muted sm:inline">
              {t.soloThreadsLabel}:
            </span>
            {renamingThread ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <input
                  id="solo-thread-rename-input"
                  type="text"
                  autoFocus
                  value={threadTitleDraft}
                  onChange={(e) => onThreadTitleDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitRenameThread();
                    if (e.key === 'Escape') onCancelRenameThread();
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-brass bg-surface px-2 py-1 text-xs text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onCommitRenameThread}
                  aria-label={ux.saveChanges}
                  className="icon-button h-7 w-7 min-h-0 min-w-0 shrink-0 text-sage"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onCancelRenameThread}
                  aria-label={t.cancel}
                  className="icon-button h-7 w-7 min-h-0 min-w-0 shrink-0"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <select
                aria-label={t.soloThreadsLabel}
                value={currentRoom.conversationId ?? ''}
                onChange={(e) => {
                  if (e.target.value && currentRoom.botId) {
                    openBotChat(currentRoom.botId, e.target.value);
                  }
                }}
                className="min-w-0 max-w-full flex-1 truncate rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-ink focus:border-brass focus:outline-none sm:max-w-[260px]"
              >
                {soloThreads.length === 0 ? (
                  <option value="">{currentRoom.title}</option>
                ) : (
                  soloThreads.map((thread) => (
                    <option key={thread.id} value={thread.id}>
                      {thread.title}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              id="solo-new-thread-btn"
              onClick={() => void createSoloThread(currentRoom.botId!)}
              aria-label={t.soloNewThread}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink transition hover:border-brass"
            >
              <Plus className="h-3.5 w-3.5 text-brass" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.soloNewThread}</span>
            </button>
            {currentRoom.conversationId && !renamingThread && (
              <>
                <button
                  type="button"
                  id="solo-rename-thread-btn"
                  onClick={onStartRenameThread}
                  aria-label={t.renameSession}
                  className="icon-button h-7 w-7 min-h-0 min-w-0"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {soloThreads.length > 1 && (
                  <button
                    type="button"
                    id="solo-delete-thread-btn"
                    onClick={() => void deleteConversationById(currentRoom.conversationId!)}
                    aria-label={t.deleteSession}
                    className="icon-button h-7 w-7 min-h-0 min-w-0 hover:text-terracotta"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {(soloBotLocked || groupLockedCount > 0) && (
        <div
          role="alert"
          id="plan-locked-banner"
          className="flex flex-col gap-2 border-b border-brass/30 bg-brass/10 px-3 py-2.5 text-xs text-ink sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <p className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
            <span>
              {soloBotLocked
                ? t.botDisabledSoloBanner
                    .replace('{plan}', planName)
                    .replace('{cap}', String(botCap))
                : t.botDisabledGroupNote
                    .replace('{count}', String(groupLockedCount))
                    .replace('{plan}', planName)}
            </span>
          </p>
          <button
            type="button"
            onClick={goToPricing}
            className="button-primary min-h-8 shrink-0 px-3 py-1 text-xs"
          >
            {t.pricingTitle}
          </button>
        </div>
      )}

      {noKeyMessage && (
        <div
          id="chat-no-key-banner"
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/85 px-3 py-2 text-xs text-ink sm:px-5"
        >
          <p className="flex min-w-0 flex-1 items-start gap-2 leading-snug">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
            <span className="min-w-0">{noKeyMessage}</span>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              id="chat-connect-key-cta"
              onClick={() => setCurrentView('api-keys')}
              className="inline-flex min-h-7 items-center gap-1 rounded-full border border-brass/45 bg-brass/15 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-brass hover:bg-brass/20"
            >
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              <span>{ux.connectApiKeyCta}</span>
            </button>
            {!panelVisible && (
              <button
                type="button"
                id="chat-open-panel-cta"
                onClick={onTogglePanel}
                className="inline-flex min-h-7 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink transition hover:border-brass/50"
              >
                <Settings2 className="h-3 w-3" aria-hidden="true" />
                <span>{isSolo ? ux.openSettingsCtaSolo : ux.openSettingsCtaGroup}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
