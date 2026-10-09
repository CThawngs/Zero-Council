import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { planById } from '../data/plans';
import { AlertCircle, AtSign, Link2, Send, Square, Trash2, X } from 'lucide-react';
import { USER_HANDLE } from '../chat/engine';

/**
 * One advisor, one card. The bubble carries an explicit border even though it sits on a near-identical
 * background: without it the card reads as floating text rather than as a message, which is the
 * whole affordance of a messenger view.
 */
const renderBody = (body: string) =>
  body.split(/(@[\p{L}\p{N}][\p{L}\p{N}_-]*)/gu).map((part, index) =>
    part.startsWith('@') ? (
      <span key={index} className="rounded bg-brass/15 px-1 font-medium text-brass">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );

export const ChatRoomView: React.FC = () => {
  const {
    currentRoom,
    sendMessage,
    stopRoom,
    clearRoom,
    attachLink,
    removePending,
    isRoomBusy,
    isReadingLink,
    personas,
    setCurrentView,
    currentPlanId,
    t,
  } = useApp();
  const [draft, setDraft] = useState('');
  const [link, setLink] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // One source of truth for "the room is working". A second flag in this component would drift the
  // moment a round is stopped rather than finished, and the composer would unlock mid-round.
  const isRunning = isRoomBusy;

  const roster = currentRoom
    ? currentRoom.roster.map((id) => personas.find((persona) => persona.id === id)).filter(Boolean)
    : [];

  // Why the room went quiet, in the user's terms. Saying "paused" when nobody replied would be a
  // lie about the council, so each stop reason gets its own line.
  const pauseNote = (() => {
    if (!currentRoom || currentRoom.messages.length === 0) return null;
    const count = String(currentRoom.turns);
    switch (currentRoom.stoppedBy) {
      case 'max-turns':
        return t.chatPaused.replace('{count}', count);
      case 'budget':
        return t.chatBudgetReached;
      case 'silent':
        return t.chatNobodySpoke;
      case 'cancelled':
        return t.chatCancelled;
      case 'failed':
        // A dropped advisor reads as "an advisor stopped working"; the user needs the difference
        // between "it broke" and "it was too slow", because only one of them is worth retrying.
        return currentRoom.failures[0]?.kind === 'timeout'
          ? t.chatAdvisorTimedOut
          : t.chatAdvisorFailed.replace('{reason}', currentRoom.failures[0]?.kind ?? 'error');
      default:
        return null;
    }
  })();

  // A new advisor message must be readable without scrolling up to find out who spoke.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [currentRoom?.messages.length, isRunning]);

  if (!currentRoom) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 py-4 sm:py-8">
        <h1 className="font-serif text-3xl text-ink">{t.chatTitle}</h1>
        <button type="button" onClick={() => setCurrentView('empty-chamber')} className="button-primary min-h-11">
          {t.chatStartFirst}
        </button>
      </div>
    );
  }

  const blocked = roster.length >= planById(currentPlanId).maxActiveAdvisors;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isRunning) return;
    setDraft('');
    await sendMessage(body);
  };

  // Reading happens on attach, not on send: a link that hangs mid-round is indistinguishable from a
  // provider hang, and the room would report the wrong thing.
  const handleAttach = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = link.trim();
    if (!href || isReadingLink) return;
    setLink('');
    await attachLink(href);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-76px)] w-full max-w-5xl flex-col gap-4 py-4 sm:py-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{t.chatEyebrow}</p>
          <h1 className="mt-1 truncate font-serif text-xl text-ink sm:text-2xl">{currentRoom.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {roster.map((persona) => (
              <span key={persona!.id} className="badge-neutral gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: persona!.colorHex }} aria-hidden="true" />
                {persona!.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <span className="badge-neutral self-center">
            {currentRoom.mode === 'panel' ? t.modePanel : t.modeRoundRobin}
          </span>
          <button type="button" onClick={stopRoom} disabled={!isRunning} className="button-secondary min-h-11 justify-center disabled:opacity-45">
            <Square className="h-4 w-4" aria-hidden="true" />
            {t.chatStop}
          </button>
          <button type="button" onClick={clearRoom} className="button-quiet min-h-11 justify-center">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t.chatClear}</span>
          </button>
        </div>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t.chatLogLabel}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-background/40 p-4"
      >
        {currentRoom.messages.length === 0 && (
          <p className="py-10 text-center text-sm leading-relaxed text-ink-muted">{t.chatEmpty}</p>
        )}
        {currentRoom.messages.map((message) => {
          const isUser = message.authorId === USER_HANDLE;
          const persona = roster.find((item) => item!.id === message.authorId);
          return (
            <article
              key={message.id}
              className={`max-w-[85%] rounded-2xl border p-4 sm:max-w-[75%] ${
                isUser
                  ? 'ml-auto border-brass/45 bg-surface'
                  : 'border-border bg-surface/80'
              }`}
            >
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isUser ? 'var(--color-brass)' : persona?.colorHex }}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-ink">
                  {isUser ? t.chatYou : persona?.name}
                </span>
                {persona && (
                  <span className="text-[11px] text-ink-muted">
                    {modelLabel(persona.model)} · {providerLabel(persona.provider)}
                  </span>
                )}
              </header>
              <p className="break-words text-sm leading-relaxed text-ink">{renderBody(message.body)}</p>
              {message.attachments && message.attachments.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {message.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed ${
                        attachment.problem
                          ? 'border-sage/40 bg-sage/10 text-ink-muted'
                          : 'border-border bg-background/60 text-ink-muted'
                      }`}
                    >
                      <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                      <span className="min-w-0 break-all">
                        <span className="font-medium text-ink">{attachment.name}</span>{' '}
                        {attachment.problem
                          ? t.chatAttachmentUnread.replace('{reason}', attachment.problem)
                          : t.chatAttachmentRead}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
        {isRunning && (
          <p className="flex items-center gap-2 text-xs text-ink-muted" role="status">
            <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
            {t.chatThinking}
          </p>
        )}
        {pauseNote && (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-surface/60 p-3 text-xs leading-relaxed text-ink-muted">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
            {pauseNote}
          </p>
        )}
      </div>

      <form onSubmit={handleAttach} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="chat-link" className="sr-only">
          {t.chatAttachLabel}
        </label>
        <input
          id="chat-link"
          name="chat-link"
          type="url"
          inputMode="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder={t.chatAttachPlaceholder}
          disabled={isRunning || isReadingLink}
          autoComplete="off"
          className="min-h-11 w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:opacity-60 sm:w-72"
        />
        <button
          type="submit"
          disabled={isRunning || isReadingLink || !link.trim()}
          className="button-secondary min-h-11 justify-center self-end disabled:cursor-not-allowed disabled:opacity-45 sm:self-auto"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {isReadingLink ? t.chatAttachReading : t.chatAttach}
        </button>
      </form>

      {/* Pinned but not sent. Shown as chips because "it read it silently and dropped it" is the
          failure mode here: a link with no visible state is a link nobody trusts. */}
      {currentRoom.pending.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {currentRoom.pending.map((attachment) => (
            <li
              key={attachment.id}
              className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${
                attachment.problem
                  ? 'border-sage/40 bg-sage/10 text-ink-muted'
                  : 'border-brass/40 bg-brass/10 text-ink-muted'
              }`}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{attachment.name}</span>{' '}
                {attachment.problem ? t.chatAttachmentUnread.replace('{reason}', attachment.problem) : t.chatAttachmentRead}
              </span>
              <button
                type="button"
                onClick={() => removePending(attachment.id)}
                disabled={isRunning}
                aria-label={t.chatAttachRemove}
                className="shrink-0 rounded-full p-0.5 text-ink-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-45"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="chat-composer" className="sr-only">
          {t.chatComposerLabel}
        </label>
        <textarea
          id="chat-composer"
          name="chat-composer"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line — the convention every messenger uses.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={t.chatPlaceholder}
          disabled={isRunning}
          autoComplete="off"
          className="min-h-11 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isRunning || !draft.trim()}
          className="button-primary min-h-11 justify-center self-end disabled:cursor-not-allowed disabled:opacity-45 sm:self-auto"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {t.chatSend}
        </button>
      </form>

      {blocked && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
          {t.chatCapNote.replace('{cap}', String(planById(currentPlanId).maxActiveAdvisors))}
        </p>
      )}
    </div>
  );
};