/**
 * Scrollable transcript log area for ChatRoomView (empty state chips, message bubbles, typing/search spinners, and error/pause cards).
 */

import React from 'react';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ChatRoomState } from '../../context/types';
import type { AdvisorPersona } from '../../types';
import { CouncilOrb } from '../CouncilOrb';
import { ChatMessageItem, ChatTurnErrorCard } from './ChatMessageItem';
import { Avatar, type TurnFailureCardData } from './helpers';

export interface ChatTranscriptLogProps {
  logRef: React.RefObject<HTMLDivElement | null>;
  currentRoom: ChatRoomState;
  roster: AdvisorPersona[];
  rosterNames: string[];
  disabledSet: Set<string>;
  isSolo: boolean;
  isRunning: boolean;
  isSearchingWeb: boolean;
  expanded: boolean;
  turnFailureCard: TurnFailureCardData | null;
  pauseNote: string | null;
  onInsertMention: (handle: string) => void;
}

export const ChatTranscriptLog: React.FC<ChatTranscriptLogProps> = ({
  logRef,
  currentRoom,
  roster,
  rosterNames,
  disabledSet,
  isSolo,
  isRunning,
  isSearchingWeb,
  expanded,
  turnFailureCard,
  pauseNote,
  onInsertMention,
}) => {
  const { t } = useApp();

  return (
    <div
      ref={logRef}
      role="log"
      aria-live="polite"
      aria-label={t.chatLogLabel}
      className="chat-log min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-6"
      style={expanded ? { paddingInline: 'max(1.5rem, calc((100% - 56rem) / 2))' } : undefined}
    >
      {currentRoom.messages.length === 0 && (
        <div className="flex flex-col items-center px-3 py-6 text-center">
          <CouncilOrb />
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{t.chatEmpty}</p>
          {!isSolo && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {roster.map((persona) => {
                const locked = disabledSet.has(persona.id);
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => onInsertMention(persona.name)}
                    disabled={isRunning || locked}
                    title={locked ? t.botDisabledBadge : undefined}
                    className="flex items-center gap-2 rounded-full border border-border bg-background/60 py-1 pl-1 pr-3 text-xs font-medium text-ink transition hover:border-brass/60 hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Avatar name={persona.name} color={persona.colorHex} size="sm" />
                    <span>{`@${persona.name}`}</span>
                    {locked && <Lock className="h-3 w-3 text-brass" aria-hidden="true" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onInsertMention('all')}
                disabled={isRunning}
                className="flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brass hover:bg-brass/15 disabled:opacity-45"
              >
                <span>@all</span>
              </button>
            </div>
          )}
          {!isSolo && roster[0] && (
            <p className="mt-5 max-w-md text-xs leading-relaxed text-ink-muted">
              {t.chatOrderHint.replace('{name}', roster[0].name)}
            </p>
          )}
        </div>
      )}

      {currentRoom.messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          roster={roster}
          rosterNames={rosterNames}
        />
      ))}

      {isSearchingWeb && (
        <div className="chat-pop flex items-center gap-2 text-xs text-ink" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-brass" aria-hidden="true" />
          <span>{t.chatWebSearchSearching}</span>
        </div>
      )}

      {isRunning && (
        <div className="chat-pop flex items-center gap-3" role="status">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background"
            aria-hidden="true"
          >
            <span className="typing-dots">
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="text-xs text-ink-muted">{t.chatThinking}</span>
        </div>
      )}

      {turnFailureCard && <ChatTurnErrorCard card={turnFailureCard} />}

      {pauseNote && (
        <p className="mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-border bg-background/60 px-3.5 py-3 text-xs leading-relaxed text-ink">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
          <span>{pauseNote}</span>
        </p>
      )}
    </div>
  );
};
