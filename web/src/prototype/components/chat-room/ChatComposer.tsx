/**
 * Chat composer footer: pending attachment pills, @mention autocomplete, URL reader, file upload, and web search toggle.
 */

import React from 'react';
import { AlertCircle, ArrowUp, AtSign, FileText, Globe, Link2, Paperclip, X } from 'lucide-react';
import { attachmentStatus } from '../../chat/attachment-status';
import {
  compactMentionKey,
  detectMentionQuery,
  type CHAT_UX_COPY,
  type MentionCandidate,
  type MentionQueryMatch,
} from '../../chat/mentions';
import { useApp } from '../../context/AppContext';
import type { ChatRoomState } from '../../context/types';
import type { Language } from '../../i18n';
import { MentionAutocomplete } from '../MentionAutocomplete';
import { AttachmentGlyph, FILE_INPUT_ACCEPT } from './helpers';

interface ChatComposerProps {
  currentRoom: ChatRoomState;
  draft: string;
  link: string;
  showLink: boolean;
  isRunning: boolean;
  soloBotLocked: boolean;
  blocked: boolean;
  maxActiveAdvisors: number;
  mentionOpen: boolean;
  mentionMatch: MentionQueryMatch | null;
  mentionCandidates: MentionCandidate[];
  filteredCandidates: MentionCandidate[];
  safeMentionIdx: number;
  completedHandles: string[];
  ux: (typeof CHAT_UX_COPY)[Language];
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  composerCardRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDraftChange: (nextValue: string, nextCursor: number, dismissStart: number | null) => void;
  onCursorChange: (nextCursor: number) => void;
  onSetActiveMentionIdx: (idx: number) => void;
  onDismissMention: (start: number) => void;
  onSelectMentionCandidate: (candidate: MentionCandidate) => void;
  onMentionButtonClick: () => void;
  onLinkChange: (next: string) => void;
  onToggleShowLink: () => void;
  onAttachLinkSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTakeFiles: (list: FileList | File[] | null) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  currentRoom,
  draft,
  link,
  showLink,
  isRunning,
  soloBotLocked,
  blocked,
  maxActiveAdvisors,
  mentionOpen,
  mentionMatch,
  mentionCandidates,
  filteredCandidates,
  safeMentionIdx,
  completedHandles,
  ux,
  composerRef,
  composerCardRef,
  fileInputRef,
  onDraftChange,
  onCursorChange,
  onSetActiveMentionIdx,
  onDismissMention,
  onSelectMentionCandidate,
  onMentionButtonClick,
  onLinkChange,
  onToggleShowLink,
  onAttachLinkSubmit,
  onTakeFiles,
  onSubmit,
}) => {
  const {
    removePending,
    isReadingLink,
    isReadingFile,
    webSearchEnabled,
    setWebSearchEnabled,
    language,
    t,
  } = useApp();

  return (
    <div className="border-t border-border bg-background/50 px-2.5 py-2 sm:px-5 sm:py-3">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {isReadingFile && (
          <p role="status" className="flex items-center gap-2 text-[11px] text-ink-muted">
            <FileText className="h-3.5 w-3.5 shrink-0 animate-pulse text-brass" aria-hidden="true" />
            {t.chatAttachFileReading}
          </p>
        )}

        {currentRoom.pending.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {currentRoom.pending.map((attachment) => (
              <li
                key={attachment.id}
                className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${
                  attachment.problem
                    ? 'border-terracotta/50 bg-terracotta/10 text-ink'
                    : 'border-brass/40 bg-brass/10 text-ink-muted'
                }`}
              >
                <AttachmentGlyph
                  attachment={attachment}
                  className={`h-3.5 w-3.5 shrink-0 ${
                    attachment.problem ? 'text-terracotta' : 'text-brass'
                  }`}
                />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink">{attachment.name}</span>{' '}
                  {attachmentStatus(attachment, t)}
                </span>
                <button
                  type="button"
                  onClick={() => removePending(attachment.id)}
                  disabled={isRunning}
                  aria-label={
                    attachment.kind === 'link' ? t.chatAttachRemove : t.chatAttachFileRemove
                  }
                  className="shrink-0 rounded-full p-0.5 text-ink-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-45"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          ref={composerCardRef}
          className="relative rounded-2xl border border-border bg-surface shadow-sm transition focus-within:border-brass"
        >
          {mentionOpen && (
            <MentionAutocomplete
              candidates={filteredCandidates}
              activeIndex={safeMentionIdx}
              language={language}
              onSelect={onSelectMentionCandidate}
              onHover={onSetActiveMentionIdx}
            />
          )}

          <form
            onSubmit={onAttachLinkSubmit}
            className={`${
              showLink ? 'flex' : 'hidden'
            } items-center gap-2 border-b border-border px-3 py-1.5`}
          >
            <Link2 className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
            <label htmlFor="chat-link" className="sr-only">
              {t.chatAttachLabel}
            </label>
            <input
              id="chat-link"
              name="chat-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(event) => onLinkChange(event.target.value)}
              placeholder={t.chatAttachPlaceholder}
              disabled={isRunning || isReadingLink || soloBotLocked}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink placeholder:text-ink-muted/70 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isRunning || isReadingLink || !link.trim() || soloBotLocked}
              className="button-quiet shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-45"
              style={{ minHeight: '2rem', padding: '0.25rem 0.75rem' }}
            >
              {isReadingLink ? t.chatAttachReading : t.chatAttach}
            </button>
          </form>

          <form onSubmit={onSubmit} className="flex flex-col">
            <input
              ref={fileInputRef}
              id="chat-file"
              name="chat-file"
              type="file"
              multiple
              accept={FILE_INPUT_ACCEPT}
              className="hidden"
              tabIndex={-1}
              onChange={(event) => {
                const input = event.currentTarget;
                const picked = Array.from(input.files ?? []);
                input.value = '';
                onTakeFiles(picked);
              }}
            />

            <label htmlFor="chat-composer" className="sr-only">
              {t.chatComposerLabel}
            </label>
            <textarea
              id="chat-composer"
              name="chat-composer"
              ref={composerRef}
              rows={1}
              value={draft}
              aria-autocomplete="list"
              aria-controls={mentionOpen ? 'chat-mention-listbox' : undefined}
              aria-activedescendant={
                mentionOpen && filteredCandidates.length > 0
                  ? `chat-mention-option-${safeMentionIdx}`
                  : undefined
              }
              onChange={(event) => {
                const nextValue = event.target.value;
                const nextCursor = event.target.selectionStart ?? nextValue.length;
                const delta = Math.abs(nextValue.length - draft.length);

                const nextMatch = detectMentionQuery(nextValue, nextCursor, completedHandles);
                const isBulkExactHandle =
                  delta > 3 &&
                  !nextValue.endsWith('@') &&
                  nextMatch !== null &&
                  nextMatch.query.length > 0 &&
                  mentionCandidates.some(
                    (c) => compactMentionKey(c.handle) === compactMentionKey(nextMatch.query)
                  );
                onDraftChange(
                  nextValue,
                  nextCursor,
                  isBulkExactHandle && nextMatch ? nextMatch.start : null
                );
              }}
              onClick={(event) => {
                onCursorChange(event.currentTarget.selectionStart ?? draft.length);
              }}
              onKeyUp={(event) => {
                if (
                  event.key === 'ArrowLeft' ||
                  event.key === 'ArrowRight' ||
                  event.key === 'Home' ||
                  event.key === 'End'
                ) {
                  onCursorChange(event.currentTarget.selectionStart ?? draft.length);
                }
              }}
              onPaste={(event) => {
                if (event.clipboardData.files.length === 0) return;
                event.preventDefault();
                onTakeFiles(event.clipboardData.files);
              }}
              onKeyDown={(event) => {
                if (mentionOpen && filteredCandidates.length > 0) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    onSetActiveMentionIdx((safeMentionIdx + 1) % filteredCandidates.length);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    onSetActiveMentionIdx(
                      (safeMentionIdx - 1 + filteredCandidates.length) % filteredCandidates.length
                    );
                    return;
                  }
                  if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
                    event.preventDefault();
                    onSelectMentionCandidate(filteredCandidates[safeMentionIdx]);
                    return;
                  }
                }
                if (mentionOpen && event.key === 'Escape' && mentionMatch) {
                  event.preventDefault();
                  event.stopPropagation();
                  onDismissMention(mentionMatch.start);
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={t.chatPlaceholder}
              disabled={isRunning || soloBotLocked}
              autoComplete="off"
              className="max-h-40 min-h-10 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70 focus:outline-none disabled:opacity-60"
            />

            <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5 pt-0.5">
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  id="chat-attach-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRunning || isReadingFile || soloBotLocked}
                  aria-label={t.chatAttachFileLabel}
                  title={t.chatAttachFileLabel}
                  className="icon-button shrink-0 disabled:opacity-45"
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    minHeight: 0,
                    minWidth: 0,
                    borderColor: 'transparent',
                    background: 'transparent',
                  }}
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  id="chat-attach-link-btn"
                  onClick={onToggleShowLink}
                  disabled={soloBotLocked}
                  aria-label={t.chatAttachLabel}
                  aria-expanded={showLink}
                  title={t.chatAttachLabel}
                  className="icon-button shrink-0 disabled:opacity-45"
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    minHeight: 0,
                    minWidth: 0,
                    borderColor: 'transparent',
                    background: showLink
                      ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)'
                      : 'transparent',
                  }}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  id="chat-web-search-toggle"
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  disabled={soloBotLocked}
                  aria-pressed={webSearchEnabled}
                  aria-label={t.chatWebSearchLabel}
                  title={webSearchEnabled ? t.chatWebSearchOn : t.chatWebSearchLabel}
                  className={`icon-button shrink-0 transition disabled:opacity-45 ${
                    webSearchEnabled ? 'text-ink' : 'text-ink-muted'
                  }`}
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    minHeight: 0,
                    minWidth: 0,
                    borderColor: webSearchEnabled ? 'var(--color-accent)' : 'transparent',
                    background: webSearchEnabled
                      ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
                      : 'transparent',
                  }}
                >
                  <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  id="chat-mention-btn"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onMentionButtonClick}
                  disabled={isRunning || soloBotLocked}
                  aria-label={ux.mentionTriggerLabel}
                  aria-haspopup="listbox"
                  title={ux.mentionTriggerLabel}
                  className={`icon-button shrink-0 transition disabled:opacity-45 ${
                    mentionOpen ? 'text-ink' : 'text-ink-muted'
                  }`}
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    minHeight: 0,
                    minWidth: 0,
                    borderColor: mentionOpen ? 'var(--color-accent)' : 'transparent',
                    background: mentionOpen
                      ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
                      : 'transparent',
                  }}
                >
                  <AtSign className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {webSearchEnabled && (
                  <span className="hidden items-center gap-1 rounded-full border border-brass/45 bg-brass/12 px-2 py-0.5 text-[10px] font-semibold text-ink sm:inline-flex">
                    <Globe className="h-3 w-3 text-brass" aria-hidden="true" />
                    {t.chatWebSearchOn}
                  </span>
                )}
                {blocked && (
                  <span
                    className="flex items-center"
                    title={t.chatCapNote.replace('{cap}', String(maxActiveAdvisors))}
                  >
                    <AlertCircle className="h-4 w-4 text-brass" aria-hidden="true" />
                    <span className="sr-only">
                      {t.chatCapNote.replace('{cap}', String(maxActiveAdvisors))}
                    </span>
                  </span>
                )}
                <button
                  type="submit"
                  id="chat-send-btn"
                  disabled={
                    isRunning ||
                    soloBotLocked ||
                    (!draft.trim() && currentRoom.pending.length === 0)
                  }
                  aria-label={t.chatSend}
                  title={t.chatSend}
                  className="button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ width: '2.25rem', height: '2.25rem', minHeight: 0, padding: 0 }}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
        </div>

        <p className="hidden text-right text-[11px] text-ink-muted lg:block">{t.chatHint}</p>
      </div>
    </div>
  );
};
