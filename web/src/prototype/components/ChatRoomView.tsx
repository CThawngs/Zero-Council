import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { planById } from '../data/plans';
import {
  AlertCircle,
  ArrowUp,
  Check,
  ClipboardList,
  ExternalLink,
  FileText,
  Film,
  Globe,
  ImageIcon,
  Link2,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Paperclip,
  Pencil,
  Plus,
  Settings2,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { ACCEPT_ATTRIBUTE } from '../chat/read-file-web';
import { IMAGE_EXTENSIONS } from '../chat/read-image-web';
import { VIDEO_EXTENSIONS } from '../chat/read-video-web';
import type { ChatAttachment } from '../chat/engine';
import { attachmentStatus } from '../chat/attachment-status';
import { CouncilOrb } from './CouncilOrb';
import { USER_HANDLE } from '../chat/engine';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderBody = (body: string, names: string[] = [], onBrass = false) => {
  const known = names
    .flatMap((name) => [name, name.replace(/^(the|a|an)\s+/i, '')])
    .filter((name, index, all) => name && all.indexOf(name) === index)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  const pattern = new RegExp(
    `(@(?:${[...known, 'all', 'every'].join('|')}|[\\p{L}\\p{N}][\\p{L}\\p{N}_-]*))`,
    'giu'
  );
  return body.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <span
        key={index}
        className={`rounded-md px-1.5 py-0.5 text-[0.92em] font-semibold ${
          onBrass ? '' : 'bg-brass/15 text-brass'
        }`}
        style={
          onBrass
            ? { backgroundColor: 'color-mix(in srgb, var(--color-accent-ink) 20%, transparent)' }
            : undefined
        }
      >
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
};

const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter((word) => word && !/^(the|a|an)$/i.test(word));
  const letters = (words.length > 0 ? words : [name]).slice(0, 2).map((word) => word.charAt(0));
  return letters.join('').toUpperCase();
};

export const AttachmentGlyph = ({
  attachment,
  className,
}: {
  attachment: ChatAttachment;
  className: string;
}) => {
  if (attachment.kind === 'image' && attachment.dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={attachment.dataUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />;
  }
  if (attachment.kind === 'video') return <Film className={className} aria-hidden="true" />;
  if (attachment.kind === 'image') return <ImageIcon className={className} aria-hidden="true" />;
  if (attachment.kind === 'file') return <FileText className={className} aria-hidden="true" />;
  return <Link2 className={className} aria-hidden="true" />;
};

const FILE_INPUT_ACCEPT = `${ACCEPT_ATTRIBUTE},${IMAGE_EXTENSIONS.join(',')},${VIDEO_EXTENSIONS.join(',')},video/*`;

export const Avatar: React.FC<{ name: string; color: string; size?: 'sm' | 'md' }> = ({
  name,
  color,
  size = 'md',
}) => (
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
    roomRosterPartition,
    conversations,
    openBotChat,
    createSoloThread,
    renameConversation,
    deleteConversationById,
    openEditGroup,
    sendMessage,
    stopRoom,
    wrapUpRoom,
    clearRoom,
    attachLink,
    attachFiles,
    removePending,
    isRoomBusy,
    isReadingLink,
    isReadingFile,
    webSearchEnabled,
    setWebSearchEnabled,
    isSearchingWeb,
    personas,
    botCap,
    goToPricing,
    setCurrentView,
    currentPlanId,
    t,
  } = useApp();

  const [draft, setDraft] = useState('');
  const [link, setLink] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [renamingThread, setRenamingThread] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState('');

  const isRunning = isRoomBusy;
  const plan = planById(currentPlanId);

  const roster = currentRoom
    ? currentRoom.roster
        .map((id) => personas.find((persona) => persona.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
    : [];
  const rosterNames = roster.map((persona) => persona.name);

  const isSolo = currentRoom
    ? currentRoom.kind === 'solo' || currentRoom.roster.length === 1
    : false;

  const soloThreads =
    isSolo && currentRoom?.botId
      ? conversations.filter((c) => c.kind === 'solo' && c.botId === currentRoom.botId)
      : [];

  const disabledSet = new Set(roomRosterPartition.disabledIds);
  const soloBotLocked = isSolo && roomRosterPartition.activeIds.length === 0;
  const groupLockedCount = !isSolo ? roomRosterPartition.disabledIds.length : 0;

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
        return currentRoom.failures[0]?.kind === 'timeout'
          ? t.chatAdvisorTimedOut
          : t.chatAdvisorFailed.replace('{reason}', currentRoom.failures[0]?.kind ?? 'error');
      default:
        return null;
    }
  })();

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [currentRoom?.messages.length, isRunning]);

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
        <button
          type="button"
          onClick={() => setCurrentView('empty-chamber')}
          className="button-primary min-h-11"
        >
          {t.chatStartFirst}
        </button>
      </div>
    );
  }

  const blocked = !isSolo && roster.length >= plan.maxActiveAdvisors;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRunning || soloBotLocked) return;
    const body =
      draft.trim() ||
      (currentRoom.pending.length > 0 ? 'Analyze the attached files and media.' : '');
    if (!body) return;
    setDraft('');
    await sendMessage(body);
  };

  const handleAttach = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = link.trim();
    if (!href || isReadingLink) return;
    setLink('');
    await attachLink(href);
  };

  const takeFiles = async (list: FileList | File[] | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0 || isRunning || isReadingFile || soloBotLocked) return;
    await attachFiles(files);
  };

  const insertMention = (handle: string) => {
    setDraft((value) => `${value}${value && !/\s$/.test(value) ? ' ' : ''}@${handle} `);
    composerRef.current?.focus();
  };

  const commitThreadRename = async () => {
    if (currentRoom.conversationId && threadTitleDraft.trim()) {
      await renameConversation(currentRoom.conversationId, threadTitleDraft.trim());
    }
    setRenamingThread(false);
  };

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[60] flex flex-col bg-background p-2 sm:p-4'
          : 'mx-auto flex h-[calc(100dvh-76px)] w-full max-w-4xl flex-col py-2 sm:py-5'
      }
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) {
          void takeFiles(e.dataTransfer.files);
        }
      }}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)] ${
          dragging ? 'border-brass ring-2 ring-brass/30' : 'border-border'
        }`}
      >
        {/* Room Header */}
        <header className="flex flex-col gap-3 border-b border-border bg-surface/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 -space-x-2" aria-hidden="true">
              {roster.map((persona) => (
                <span
                  key={persona.id}
                  className={`rounded-full ring-2 ring-surface ${
                    disabledSet.has(persona.id) ? 'opacity-45 grayscale' : ''
                  }`}
                >
                  <Avatar name={persona.name} color={persona.colorHex} />
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-serif text-lg leading-tight text-ink sm:text-xl">
                  {currentRoom.title}
                </h1>
                <span className="badge-neutral shrink-0 text-[10px]">
                  {isSolo
                    ? t.soloBadge
                    : t.groupBadge.replace('{count}', String(roster.length))}
                </span>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isRunning ? 'animate-pulse bg-brass' : soloBotLocked ? 'bg-terracotta' : 'bg-sage'
                    }`}
                    aria-hidden="true"
                  />
                  {t.chatEyebrow}
                </span>
                <span aria-hidden="true">·</span>
                <span className="min-w-0 truncate">
                  {roster
                    .map((persona) =>
                      disabledSet.has(persona.id)
                        ? `${persona.name} (${t.botDisabledBadge})`
                        : persona.name
                    )
                    .join(', ')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap shrink-0 items-center gap-1.5 sm:gap-2">
            {!isSolo && (
              <span className="badge-neutral self-center">
                {currentRoom.mode === 'panel' ? t.modePanel : t.modeRoundRobin}
              </span>
            )}
            {!isSolo && currentRoom.conversationId && (
              <button
                type="button"
                id="chat-edit-group-btn"
                onClick={() => openEditGroup(currentRoom.conversationId!)}
                aria-label={t.groupEditTitle}
                title={t.groupEditTitle}
                className="button-secondary min-h-10 px-3 justify-center"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{t.groupEditTitle}</span>
              </button>
            )}
            <button
              type="button"
              onClick={stopRoom}
              disabled={!isRunning}
              className="button-secondary min-h-10 px-3 justify-center disabled:opacity-45"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.chatStop}</span>
            </button>
            {!isSolo && (
              <button
                type="button"
                onClick={wrapUpRoom}
                disabled={!currentRoom.messages.some((message) => message.authorId !== USER_HANDLE)}
                title={t.chatWrapUpHint}
                className="button-secondary min-h-10 px-3 justify-center disabled:opacity-45"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{t.chatWrapUp}</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearRoom}
              className="button-quiet min-h-10 px-2.5 justify-center"
            >
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
              {expanded ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        {/* Solo Bot Multi-Thread Switcher & CRUD Bar */}
        {isSolo && currentRoom.botId && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2 text-xs sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 font-semibold uppercase tracking-wider text-ink-muted">
                {t.soloThreadsLabel}:
              </span>
              {renamingThread ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    id="solo-thread-rename-input"
                    type="text"
                    autoFocus
                    value={threadTitleDraft}
                    onChange={(e) => setThreadTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitThreadRename();
                      if (e.key === 'Escape') setRenamingThread(false);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-brass bg-surface px-2 py-1 text-xs text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void commitThreadRename()}
                    aria-label={t.save}
                    className="icon-button min-h-7 min-w-7"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingThread(false)}
                    aria-label={t.cancel}
                    className="icon-button min-h-7 min-w-7"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <select
                  id="solo-thread-select"
                  value={currentRoom.conversationId ?? ''}
                  onChange={(event) => {
                    if (event.target.value && currentRoom.botId) {
                      openBotChat(currentRoom.botId, event.target.value);
                    }
                  }}
                  aria-label={t.soloThreadsLabel}
                  className="min-w-0 max-w-[16rem] truncate rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink outline-none focus:border-brass"
                >
                  {soloThreads.length === 0 ? (
                    <option value={currentRoom.conversationId ?? ''}>{currentRoom.title}</option>
                  ) : (
                    soloThreads.map((thread) => (
                      <option key={thread.id} value={thread.id}>
                        {thread.title} ({thread.messages.length})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="solo-new-thread-btn"
                onClick={() => void createSoloThread(currentRoom.botId!)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-brass transition hover:border-brass"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t.soloNewThread}
              </button>
              {currentRoom.conversationId && !renamingThread && (
                <>
                  <button
                    type="button"
                    id="solo-rename-thread-btn"
                    onClick={() => {
                      setThreadTitleDraft(currentRoom.title);
                      setRenamingThread(true);
                    }}
                    aria-label={t.renameSession}
                    className="icon-button min-h-7 min-w-7"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {soloThreads.length > 1 && (
                    <button
                      type="button"
                      id="solo-delete-thread-btn"
                      onClick={() => void deleteConversationById(currentRoom.conversationId!)}
                      aria-label={t.deleteSession}
                      className="icon-button min-h-7 min-w-7 hover:text-terracotta"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Plan Downgrade / Expiry Bot-Disabling Banner */}
        {(soloBotLocked || groupLockedCount > 0) && (
          <div
            role="alert"
            id="plan-locked-banner"
            className="flex flex-col gap-2 border-b border-brass/30 bg-brass/10 px-4 py-2.5 text-xs text-ink sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <p className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <span>
                {soloBotLocked
                  ? t.botDisabledSoloBanner
                      .replace('{plan}', plan.name)
                      .replace('{cap}', String(botCap))
                  : t.botDisabledGroupNote
                      .replace('{count}', String(groupLockedCount))
                      .replace('{plan}', plan.name)}
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

        {/* Chat Log */}
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={t.chatLogLabel}
          className="chat-log min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-6"
          style={
            expanded ? { paddingInline: 'max(1.5rem, calc((100% - 56rem) / 2))' } : undefined
          }
        >
          {currentRoom.messages.length === 0 && (
            <div className="flex flex-col items-center px-4 py-6 text-center">
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
                        onClick={() => insertMention(persona.name)}
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
                </div>
              )}
              {!isSolo && roster[0] && (
                <p className="mt-5 max-w-md text-xs leading-relaxed text-ink-muted">
                  {t.chatOrderHint.replace('{name}', roster[0].name)}
                </p>
              )}
            </div>
          )}

          {currentRoom.messages.map((message) => {
            const isUser = message.authorId === USER_HANDLE;
            const persona = roster.find((item) => item.id === message.authorId);

            const attachments =
              message.attachments && message.attachments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {/* Rich Media Previews (Images & Videos) */}
                  {message.attachments.some(
                    (att) =>
                      (att.kind === 'image' && att.dataUrl) ||
                      (att.kind === 'video' && (att.previewUrl || (att.frames && att.frames.length > 0)))
                  ) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {message.attachments.map((att) => {
                        if (att.kind === 'image' && att.dataUrl) {
                          return (
                            <div
                              key={`${att.id}-img`}
                              className="overflow-hidden rounded-xl border border-black/15 bg-black/10"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="max-h-52 w-full object-cover"
                              />
                            </div>
                          );
                        }
                        if (att.kind === 'video' && att.previewUrl) {
                          return (
                            <div
                              key={`${att.id}-vid`}
                              className="overflow-hidden rounded-xl border border-black/15 bg-black/20"
                            >
                              <video
                                src={att.previewUrl}
                                controls
                                preload="metadata"
                                className="max-h-52 w-full object-contain"
                              />
                            </div>
                          );
                        }
                        if (att.kind === 'video' && att.frames && att.frames[0]) {
                          return (
                            <div
                              key={`${att.id}-frame`}
                              className="overflow-hidden rounded-xl border border-black/15 bg-black/10"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={att.frames[0]}
                                alt={att.name}
                                className="max-h-48 w-full object-cover"
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Attachment & Web Search Source Chips */}
                  <ul className="space-y-1.5">
                    {message.attachments.map((attachment) => {
                      const isExternalUrl =
                        attachment.kind === 'link' && /^https?:\/\//i.test(attachment.href);
                      return (
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
                          <AttachmentGlyph
                            attachment={attachment}
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              isUser && !attachment.problem ? '' : 'text-brass'
                            }`}
                          />
                          <span className="min-w-0 flex-1 break-all">
                            {isExternalUrl ? (
                              <a
                                href={attachment.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold underline decoration-current/40 hover:decoration-current"
                              >
                                <span>{attachment.name}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                              </a>
                            ) : (
                              <span
                                className={`font-medium ${
                                  isUser && !attachment.problem ? '' : 'text-ink'
                                }`}
                              >
                                {attachment.name}
                              </span>
                            )}{' '}
                            {attachmentStatus(attachment, t)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null;

            if (isUser) {
              return (
                <article key={message.id} className="chat-pop flex flex-col items-end gap-1.5">
                  <span className="pr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t.chatYou}
                  </span>
                  <div
                    className="max-w-[88%] rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm sm:max-w-[min(72%,46rem)]"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-accent-ink)',
                    }}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {renderBody(message.body, rosterNames, true)}
                    </p>
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
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                      {persona?.name}
                    </span>
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
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                      {renderBody(message.body, rosterNames)}
                    </p>
                    {attachments}
                  </div>
                </div>
              </article>
            );
          })}

          {isSearchingWeb && (
            <div className="chat-pop flex items-center gap-2 text-xs text-brass" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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

          {pauseNote && (
            <p className="mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-border bg-background/60 px-3.5 py-3 text-xs leading-relaxed text-ink-muted">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              {pauseNote}
            </p>
          )}
        </div>

        {/* Composer Footer */}
        <div className="border-t border-border bg-background/50 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="mx-auto w-full max-w-3xl space-y-2">
            {isReadingFile && (
              <p role="status" className="flex items-center gap-2 text-[11px] text-ink-muted">
                <FileText
                  className="h-3.5 w-3.5 shrink-0 animate-pulse text-brass"
                  aria-hidden="true"
                />
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
                        ? 'border-sage/40 bg-sage/10 text-ink-muted'
                        : 'border-brass/40 bg-brass/10 text-ink-muted'
                    }`}
                  >
                    <AttachmentGlyph
                      attachment={attachment}
                      className="h-3.5 w-3.5 shrink-0 text-brass"
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

            <div className="rounded-2xl border border-border bg-surface shadow-sm transition focus-within:border-brass">
              <form
                onSubmit={handleAttach}
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
                  onChange={(event) => setLink(event.target.value)}
                  placeholder={t.chatAttachPlaceholder}
                  disabled={isRunning || isReadingLink || soloBotLocked}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink placeholder:text-ink-muted/60 focus:outline-none disabled:opacity-60"
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

              <form onSubmit={handleSubmit} className="flex items-end gap-1 p-1.5 sm:gap-1.5">
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
                    void takeFiles(picked);
                  }}
                />
                <button
                  type="button"
                  id="chat-attach-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRunning || isReadingFile || soloBotLocked}
                  aria-label={t.chatAttachFileLabel}
                  title={t.chatAttachFileLabel}
                  className="icon-button shrink-0 disabled:opacity-45"
                  style={{
                    width: '2.4rem',
                    height: '2.4rem',
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
                  onClick={() => setShowLink((value) => !value)}
                  disabled={soloBotLocked}
                  aria-label={t.chatAttachLabel}
                  aria-expanded={showLink}
                  title={t.chatAttachLabel}
                  className="icon-button shrink-0 disabled:opacity-45"
                  style={{
                    width: '2.4rem',
                    height: '2.4rem',
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
                  className={`icon-button shrink-0 px-2 transition disabled:opacity-45 ${
                    webSearchEnabled ? 'text-brass' : 'text-ink-muted'
                  }`}
                  style={{
                    height: '2.4rem',
                    minHeight: 0,
                    minWidth: '2.4rem',
                    borderColor: webSearchEnabled ? 'var(--color-accent)' : 'transparent',
                    background: webSearchEnabled
                      ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
                      : 'transparent',
                  }}
                >
                  <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
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
                  onPaste={(event) => {
                    if (event.clipboardData.files.length === 0) return;
                    event.preventDefault();
                    void takeFiles(event.clipboardData.files);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={t.chatPlaceholder}
                  disabled={isRunning || soloBotLocked}
                  autoComplete="off"
                  className="max-h-40 min-h-10 w-full resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:outline-none disabled:opacity-60"
                />

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
                  style={{ width: '2.4rem', height: '2.4rem', minHeight: 0, padding: 0 }}
                >
                  <ArrowUp className="h-5 w-5" aria-hidden="true" />
                </button>
              </form>
            </div>

            <div className="flex min-h-6 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {webSearchEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brass/50 bg-brass/10 px-2.5 py-0.5 text-[11px] font-semibold text-brass">
                    <Globe className="h-3 w-3" aria-hidden="true" />
                    {t.chatWebSearchOn}
                  </span>
                )}

                {!isSolo && currentRoom.messages.length > 0 && (
                  <>
                    {roster.map((persona) => {
                      const locked = disabledSet.has(persona.id);
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => insertMention(persona.name)}
                          disabled={isRunning || locked}
                          title={locked ? t.botDisabledBadge : undefined}
                          className="flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: persona.colorHex }}
                            aria-hidden="true"
                          />
                          <span>{`@${persona.name}`}</span>
                          {locked && <Lock className="h-2.5 w-2.5 text-brass" aria-hidden="true" />}
                        </button>
                      );
                    })}
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
                    title={t.chatCapNote.replace('{cap}', String(plan.maxActiveAdvisors))}
                  >
                    <AlertCircle className="h-4 w-4 text-brass" aria-hidden="true" />
                    <span className="sr-only">
                      {t.chatCapNote.replace('{cap}', String(plan.maxActiveAdvisors))}
                    </span>
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
