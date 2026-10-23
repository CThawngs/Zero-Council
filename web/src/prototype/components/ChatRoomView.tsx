import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { planById } from '../data/plans';
import { AlertCircle, ArrowUp, ClipboardList, Link2, Maximize2, Minimize2, Square, Trash2, X } from 'lucide-react';
import { CouncilOrb } from './CouncilOrb';
import { USER_HANDLE } from '../chat/engine';

/**
 * One advisor, one card. The bubble carries an explicit border even though it sits on a near-identical
 * background: without it the card reads as floating text rather than as a message, which is the
 * whole affordance of a messenger view.
 */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderBody = (body: string, names: string[] = [], onBrass = false) => {
  // Full names first (longest wins), then the same name without a leading article, then any single
  // word. Without this, "@The Dreamer" would light up as "@The" and leave "Dreamer" as plain text.
  const known = names
    .flatMap((name) => [name, name.replace(/^(the|a|an)\s+/i, '')])
    .filter((name, index, all) => name && all.indexOf(name) === index)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  const pattern = new RegExp(`(@(?:${[...known, 'all', 'every'].join('|')}|[\\p{L}\\p{N}][\\p{L}\\p{N}_-]*))`, 'giu');
  return body.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <span
        key={index}
        className={`rounded-md px-1.5 py-0.5 text-[0.92em] font-semibold ${onBrass ? '' : 'bg-brass/15 text-brass'}`}
        style={onBrass ? { backgroundColor: 'color-mix(in srgb, var(--color-accent-ink) 20%, transparent)' } : undefined}
      >
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
};

/** "The Dreamer" → "D", "Mai Anh" → "MA". Skips a leading article so every avatar is distinct. */
const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter((word) => word && !/^(the|a|an)$/i.test(word));
  const letters = (words.length > 0 ? words : [name]).slice(0, 2).map((word) => word.charAt(0));
  return letters.join('').toUpperCase();
};

export const Avatar: React.FC<{ name: string; color: string; size?: 'sm' | 'md' }> = ({ name, color, size = 'md' }) => (
  <span
    aria-hidden="true"
    className={`flex shrink-0 select-none items-center justify-center rounded-full border font-serif font-semibold text-ink ${
      size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm'
    }`}
    style={{
      backgroundColor: `color-mix(in srgb, ${color} 24%, var(--color-background))`,
      borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    }}
  >
    {initialsOf(name)}
  </span>
);

export const ChatRoomView: React.FC = () => {
  const {
    currentRoom,
    sendMessage,
    stopRoom,
    wrapUpRoom,
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // "Expanded" lifts the room out of the page and over the whole window, so a long debate has room.
  const [expanded, setExpanded] = useState(false);
  // The link field stays mounted (it has always had an id the drive scripts rely on) but only takes
  // space when asked for; a permanent second input row was the single biggest cost in the footer.
  const [showLink, setShowLink] = useState(false);

  // One source of truth for "the room is working". A second flag in this component would drift the
  // moment a round is stopped rather than finished, and the composer would unlock mid-round.
  const isRunning = isRoomBusy;

  const roster = currentRoom
    ? currentRoom.roster.map((id) => personas.find((persona) => persona.id === id)).filter(Boolean)
    : [];
  const rosterNames = roster.map((persona) => persona!.name);

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

  // While expanded the page behind must not scroll, and Esc is the way back — the same contract a
  // lightbox has. Both are undone on the way out, so leaving the view can never strand a locked body.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  // The composer grows with what you type, up to a cap, like every messenger.
  useEffect(() => {
    const box = composerRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 168)}px`;
  }, [draft]);

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

  // Chips type the mention for you: `@Name ` is exactly what the engine's alias table resolves.
  const insertMention = (handle: string) => {
    setDraft((value) => `${value}${value && !/\s$/.test(value) ? ' ' : ''}@${handle} `);
    composerRef.current?.focus();
  };

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[60] flex flex-col bg-background p-2 sm:p-4'
          : 'mx-auto flex h-[calc(100dvh-76px)] w-full max-w-4xl flex-col py-3 sm:py-5'
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)]">
        <header className="flex flex-col gap-3 border-b border-border bg-surface/90 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex shrink-0 -space-x-2" aria-hidden="true">
              {roster.map((persona) => (
                <span key={persona!.id} className="rounded-full ring-2 ring-surface">
                  <Avatar name={persona!.name} color={persona!.colorHex} />
                </span>
              ))}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg leading-tight text-ink sm:text-xl">{currentRoom.title}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${isRunning ? 'animate-pulse bg-brass' : 'bg-sage'}`}
                    aria-hidden="true"
                  />
                  {t.chatEyebrow}
                </span>
                <span aria-hidden="true">·</span>
                <span className="min-w-0 truncate">{roster.map((persona) => persona!.name).join(', ')}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="badge-neutral self-center">
              {currentRoom.mode === 'panel' ? t.modePanel : t.modeRoundRobin}
            </span>
            <button type="button" onClick={stopRoom} disabled={!isRunning} className="button-secondary min-h-11 justify-center disabled:opacity-45">
              <Square className="h-4 w-4" aria-hidden="true" />
              {t.chatStop}
            </button>
            {/* Stop stays what it was — it only aborts a round in flight and is disabled otherwise.
                Ending the meeting is a different intent, so it gets its own button. */}
            <button
              type="button"
              onClick={wrapUpRoom}
              disabled={!currentRoom.messages.some((message) => message.authorId !== USER_HANDLE)}
              title={t.chatWrapUpHint}
              className="button-secondary min-h-11 justify-center disabled:opacity-45"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.chatWrapUp}</span>
            </button>
            <button type="button" onClick={clearRoom} className="button-quiet min-h-11 justify-center">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.chatClear}</span>
            </button>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? t.chatCollapse : t.chatExpand}
              title={expanded ? t.chatCollapse : t.chatExpand}
              className="icon-button shrink-0"
            >
              {expanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </header>

        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={t.chatLogLabel}
          className="chat-log min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-6"
          style={expanded ? { paddingInline: 'max(1.5rem, calc((100% - 56rem) / 2))' } : undefined}
        >
          {currentRoom.messages.length === 0 && (
            <div className="flex flex-col items-center px-4 py-6 text-center">
              <CouncilOrb />
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{t.chatEmpty}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {roster.map((persona) => (
                  <button
                    key={persona!.id}
                    type="button"
                    onClick={() => insertMention(persona!.name)}
                    disabled={isRunning}
                    className="flex items-center gap-2 rounded-full border border-border bg-background/60 py-1 pl-1 pr-3 text-xs font-medium text-ink transition hover:border-brass/60 hover:bg-brass/10 disabled:opacity-45"
                  >
                    <Avatar name={persona!.name} color={persona!.colorHex} size="sm" />
                    <span>{`@${persona!.name}`}</span>
                  </button>
                ))}
              </div>
              {roster[0] && (
                <p className="mt-5 max-w-md text-xs leading-relaxed text-ink-muted">
                  {t.chatOrderHint.replace('{name}', roster[0].name)}
                </p>
              )}
            </div>
          )}
          {currentRoom.messages.map((message) => {
            const isUser = message.authorId === USER_HANDLE;
            const persona = roster.find((item) => item!.id === message.authorId);

            const attachments =
              message.attachments && message.attachments.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {message.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed ${
                        attachment.problem
                          ? 'border-sage/40 bg-sage/10 text-ink-muted'
                          : isUser
                            ? 'border-current/25 bg-black/10'
                            : 'border-border bg-background/60 text-ink-muted'
                      }`}
                    >
                      <Link2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isUser && !attachment.problem ? '' : 'text-brass'}`} aria-hidden="true" />
                      <span className="min-w-0 break-all">
                        <span className={`font-medium ${isUser && !attachment.problem ? '' : 'text-ink'}`}>{attachment.name}</span>{' '}
                        {attachment.problem
                          ? t.chatAttachmentUnread.replace('{reason}', attachment.problem)
                          : t.chatAttachmentRead}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null;

            if (isUser) {
              return (
                <article key={message.id} className="chat-pop flex flex-col items-end gap-1.5">
                  <span className="pr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t.chatYou}</span>
                  <div
                    className="max-w-[88%] rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm sm:max-w-[min(72%,46rem)]"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-ink)' }}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderBody(message.body, rosterNames, true)}</p>
                    {attachments}
                  </div>
                </article>
              );
            }

            const color = persona?.colorHex ?? 'var(--color-ink-muted)';
            return (
              <article key={message.id} className="chat-pop flex items-start gap-3">
                <Avatar name={persona?.name ?? '?'} color={color} />
                <div className="min-w-0 max-w-[88%] sm:max-w-[min(72%,46rem)]">
                  <header className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">{persona?.name}</span>
                    {persona && (
                      <span className="text-[11px] text-ink-muted">
                        {modelLabel(persona.model)} · {providerLabel(persona.provider)}
                      </span>
                    )}
                  </header>
                  <div
                    className="rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 9%, var(--color-surface))`,
                      borderColor: `color-mix(in srgb, ${color} 34%, var(--color-border))`,
                    }}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{renderBody(message.body, rosterNames)}</p>
                    {attachments}
                  </div>
                </div>
              </article>
            );
          })}
          {isRunning && (
            <div className="chat-pop flex items-center gap-3" role="status">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background" aria-hidden="true">
                <span className="typing-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span className="text-xs text-ink-muted">{t.chatThinking}</span>
            </div>
          )}
          {pauseNote && (
            <p className="mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-border bg-background/60 px-3.5 py-3 text-xs leading-relaxed text-ink-muted">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              {pauseNote}
            </p>
          )}
        </div>

        <div className="border-t border-border bg-background/50 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="mx-auto w-full max-w-3xl space-y-2">
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

            <div className="rounded-2xl border border-border bg-background transition focus-within:border-brass focus-within:ring-2 focus-within:ring-brass/20">
              <form
                onSubmit={handleAttach}
                className={`${showLink ? 'flex' : 'hidden'} items-center gap-2 border-b border-border px-3 py-1.5`}
              >
                <label htmlFor="chat-link" className="sr-only">
                  {t.chatAttachLabel}
                </label>
                <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
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
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink placeholder:text-ink-muted/60 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isRunning || isReadingLink || !link.trim()}
                  className="button-quiet shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ minHeight: '2rem', padding: '0.25rem 0.75rem' }}
                >
                  {isReadingLink ? t.chatAttachReading : t.chatAttach}
                </button>
              </form>

              <form onSubmit={handleSubmit} className="flex items-end gap-1.5 p-1.5">
                <button
                  type="button"
                  onClick={() => setShowLink((value) => !value)}
                  aria-label={t.chatAttachLabel}
                  aria-expanded={showLink}
                  title={t.chatAttachLabel}
                  className="icon-button shrink-0"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    minHeight: 0,
                    minWidth: 0,
                    borderColor: 'transparent',
                    background: showLink ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                  }}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <label htmlFor="chat-composer" className="sr-only">
                  {t.chatComposerLabel}
                </label>
                <textarea
                  id="chat-composer"
                  name="chat-composer"
                  ref={composerRef}
                  rows={1}
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
                  className="max-h-40 min-h-10 w-full resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isRunning || !draft.trim()}
                  aria-label={t.chatSend}
                  title={t.chatSend}
                  className="button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ width: '2.5rem', height: '2.5rem', minHeight: 0, padding: 0 }}
                >
                  <ArrowUp className="h-5 w-5" aria-hidden="true" />
                </button>
              </form>
            </div>

            <div className="flex min-h-6 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {currentRoom.messages.length > 0 && (
                  <>
                    {roster.map((persona) => (
                      <button
                        key={persona!.id}
                        type="button"
                        onClick={() => insertMention(persona!.name)}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink disabled:opacity-45"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: persona!.colorHex }} aria-hidden="true" />
                        <span>{`@${persona!.name}`}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => insertMention('all')}
                      disabled={isRunning}
                      className="rounded-full border border-border bg-surface/70 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink disabled:opacity-45"
                    >
                      @all
                    </button>
                  </>
                )}
                {blocked && (
                  <span
                    className="flex items-center"
                    title={t.chatCapNote.replace('{cap}', String(planById(currentPlanId).maxActiveAdvisors))}
                  >
                    <AlertCircle className="h-4 w-4 text-brass" aria-hidden="true" />
                    <span className="sr-only">{t.chatCapNote.replace('{cap}', String(planById(currentPlanId).maxActiveAdvisors))}</span>
                  </span>
                )}
              </div>
              <p className="hidden shrink-0 text-[11px] text-ink-muted/70 lg:block">{t.chatHint}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
