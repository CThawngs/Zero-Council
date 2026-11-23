import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { planById } from '../data/plans';
import {
  AlertCircle,
  ArrowUp,
  AtSign,
  Check,
  ClipboardList,
  ExternalLink,
  FileText,
  Film,
  Globe,
  ImageIcon,
  KeyRound,
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
import { USER_HANDLE } from '../chat/engine';
import { attachmentStatus } from '../chat/attachment-status';
import {
  CHAT_UX_COPY,
  applyMentionReplacement,
  buildMentionCandidates,
  compactMentionKey,
  detectMentionQuery,
  filterMentionCandidates,
  formatTurnFailureReason,
  tokenizeMentions,
  triggerMentionAtCursor,
  type MentionCandidate,
} from '../chat/mentions';
import { useBotSettingsPanel } from './BotSettingsPanel';
import { CouncilOrb } from './CouncilOrb';
import { MentionAutocomplete } from './MentionAutocomplete';
import { hasRichContent } from '../chat/content-render';
import { ContentRenderPanel } from './ContentRenderPanel';
import { ExpandableText } from './ExpandableText';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderBody = (body: string, names: string[] = [], onAccent = false) =>
  tokenizeMentions(body, names).map((segment, index) => {
    if (segment.kind === 'text') {
      return <span key={index}>{segment.text}</span>;
    }
    if (onAccent) {
      return (
        <span
          key={index}
          data-mention-pill={segment.kind}
          className="inline-block rounded-md border border-border/80 bg-surface px-1.5 py-0.5 text-[0.92em] font-semibold text-ink shadow-2xs"
        >
          {segment.text}
        </span>
      );
    }
    const toneClass =
      segment.kind === 'user'
        ? 'border-sage/50 bg-surface text-ink shadow-2xs'
        : 'border-brass/45 bg-surface text-ink shadow-2xs';
    return (
      <span
        key={index}
        data-mention-pill={segment.kind}
        className={`inline-block rounded-md border px-1.5 py-0.5 text-[0.92em] font-semibold ${toneClass}`}
      >
        {segment.text}
      </span>
    );
  });

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
    apiKeys,
    getProviderSecret,
    botCap,
    goToPricing,
    setCurrentView,
    openContentPanel,
    currentPlanId,
    language,
    t,
  } = useApp();

  const panel = useBotSettingsPanel();
  const ux = CHAT_UX_COPY[language];

  const [draft, setDraft] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [dismissedAtStart, setDismissedAtStart] = useState<number | null>(null);
  const [activeMentionIdx, setActiveMentionIdx] = useState(0);
  const [link, setLink] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [renamingThread, setRenamingThread] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState('');

  const isRunning = isRoomBusy;
  const plan = planById(currentPlanId);

  const matchId = (p: { id: string }, id: string) => {
    if (p.id === id) return true;
    const strip = (s: string) => (s.startsWith('bot:') ? s.slice(4) : s);
    return strip(p.id) === strip(id);
  };

  const roster = useMemo(
    () =>
      currentRoom
        ? currentRoom.roster
            .map((id) => personas.find((persona) => matchId(persona, id)))
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
        : [],
    [currentRoom, personas]
  );
  const rosterNames = useMemo(() => roster.map((persona) => persona.name), [roster]);

  const isSolo = currentRoom
    ? currentRoom.kind === 'solo' || currentRoom.roster.length === 1
    : false;

  const soloThreads =
    isSolo && currentRoom?.botId
      ? conversations.filter((c) => c.kind === 'solo' && c.botId === currentRoom.botId)
      : [];

  const disabledSet = useMemo(
    () => new Set(roomRosterPartition.disabledIds),
    [roomRosterPartition.disabledIds]
  );
  const soloBotLocked = isSolo && roomRosterPartition.activeIds.length === 0;
  const groupLockedCount = !isSolo ? roomRosterPartition.disabledIds.length : 0;

  // Determine which active bots in this room have a verified connected API key vs preview fallback.
  const anyConnectedKey = useMemo(
    () =>
      apiKeys.some(
        (item) =>
          item.connected && (Boolean(item.hasKey) || Boolean(getProviderSecret(item.provider)))
      ),
    [apiKeys, getProviderSecret]
  );

  const isPersonaConnected = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const persona of roster) {
      const direct = apiKeys.some(
        (item) =>
          item.provider === persona.provider &&
          item.connected &&
          (Boolean(item.hasKey) || Boolean(getProviderSecret(item.provider)))
      );
      const isUserBot = persona.id.startsWith('bot:');
      map.set(persona.id, direct || (!isUserBot && anyConnectedKey));
    }
    return map;
  }, [roster, apiKeys, getProviderSecret, anyConnectedKey]);

  const activeRoster = useMemo(
    () => roster.filter((persona) => !disabledSet.has(persona.id)),
    [roster, disabledSet]
  );
  const unconnectedActiveBots = useMemo(
    () => activeRoster.filter((persona) => !isPersonaConnected.get(persona.id)),
    [activeRoster, isPersonaConnected]
  );

  const mentionCandidates = useMemo(
    () =>
      buildMentionCandidates({
        roster: roster.map((persona) => ({
          id: persona.id,
          name: persona.name,
          archetype: persona.archetype,
          providerLabel: providerLabel(persona.provider),
          modelLabel: modelLabel(persona.model),
          colorHex: persona.colorHex,
          connected: Boolean(isPersonaConnected.get(persona.id)),
          locked: disabledSet.has(persona.id),
        })),
        isSolo,
        language,
      }),
    [roster, isPersonaConnected, disabledSet, isSolo, language]
  );

  const completedHandles = useMemo(
    () => ['all', 'everyone', 'user', 'you', ...rosterNames],
    [rosterNames]
  );

  const rawMentionMatch =
    !isRunning && !soloBotLocked
      ? detectMentionQuery(draft, cursorPos, completedHandles)
      : null;
  const mentionMatch =
    rawMentionMatch && dismissedAtStart !== rawMentionMatch.start ? rawMentionMatch : null;
  const filteredCandidates = useMemo(
    () => (mentionMatch ? filterMentionCandidates(mentionCandidates, mentionMatch.query) : []),
    [mentionCandidates, mentionMatch]
  );
  const mentionOpen =
    mentionMatch !== null &&
    (filteredCandidates.length > 0 ||
      (mentionMatch.query.trim().length <= 16 && !mentionMatch.query.includes(' ')));
  const safeMentionIdx =
    filteredCandidates.length > 0
      ? Math.min(activeMentionIdx, filteredCandidates.length - 1)
      : 0;

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
          : t.chatAdvisorFailed.replace(
              '{reason}',
              formatTurnFailureReason(currentRoom.failures[0], language)
            );
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
    if (!mentionOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        composerCardRef.current &&
        !composerCardRef.current.contains(target) &&
        mentionMatch
      ) {
        setDismissedAtStart(mentionMatch.start);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [mentionOpen, mentionMatch]);

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

  const selectMentionCandidate = (candidate: MentionCandidate) => {
    if (!mentionMatch) return;
    const next = applyMentionReplacement(draft, mentionMatch, candidate.handle);
    setDraft(next.text);
    setCursorPos(next.cursor);
    setDismissedAtStart(null);
    setActiveMentionIdx(0);
    requestAnimationFrame(() => {
      const box = composerRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const handleMentionButtonClick = () => {
    if (isRunning || soloBotLocked) return;
    const box = composerRef.current;
    const caret = box?.selectionStart ?? draft.length;
    if (mentionOpen && mentionMatch) {
      if (mentionMatch.query === '') {
        const next = triggerMentionAtCursor(draft, caret);
        setDraft(next.text);
        setCursorPos(next.cursor);
      }
      setDismissedAtStart(mentionMatch.start);
      box?.focus();
      return;
    }
    const next = triggerMentionAtCursor(draft, caret);
    setDraft(next.text);
    setCursorPos(next.cursor);
    setDismissedAtStart(null);
    setActiveMentionIdx(0);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRunning || soloBotLocked) return;
    const body =
      draft.trim() || (currentRoom.pending.length > 0 ? ux.defaultAttachmentPrompt : '');
    if (!body) return;
    setDraft('');
    setCursorPos(0);
    setDismissedAtStart(null);
    setActiveMentionIdx(0);
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
    const next = `${draft}${draft && !/\s$/.test(draft) ? ' ' : ''}@${handle} `;
    setDraft(next);
    setCursorPos(next.length);
    setDismissedAtStart(null);
    requestAnimationFrame(() => {
      const box = composerRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(next.length, next.length);
    });
  };

  const commitThreadRename = async () => {
    if (currentRoom.conversationId && threadTitleDraft.trim()) {
      await renameConversation(currentRoom.conversationId, threadTitleDraft.trim());
    }
    setRenamingThread(false);
  };

  const visibleAvatars = roster.slice(0, 4);
  const overflowCount = Math.max(0, roster.length - visibleAvatars.length);

  const noKeyMessage =
    !soloBotLocked && unconnectedActiveBots.length > 0
      ? isSolo
        ? ux.noKeySoloNote
        : unconnectedActiveBots.length >= activeRoster.length
          ? ux.noKeyGroupAllNote
          : ux.noKeyGroupPartialNote.replace(
              '{names}',
              unconnectedActiveBots.map((p) => p.name).join(', ')
            )
      : null;

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[60] flex flex-col bg-background p-2 sm:p-4'
          : 'mx-auto flex h-[calc(100dvh-76px)] w-full max-w-4xl flex-col py-1 sm:py-4'
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
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-surface shadow-[var(--shadow-lift)] ${
          dragging ? 'border-brass ring-2 ring-brass/30' : 'border-border'
        }`}
      >
        {/* Compact Room Header — complements BotSettingsPanel right-bar with zero clutter */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
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
                <span className="badge-neutral hidden shrink-0 text-[10px] xs:inline-flex sm:inline-flex">
                  {isSolo
                    ? t.soloBadge
                    : t.groupBadge.replace('{count}', String(roster.length))}
                </span>
                {!isSolo && (
                  <span className="badge-neutral hidden shrink-0 text-[10px] md:inline-flex">
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

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {isRunning && (
              <button
                type="button"
                onClick={stopRoom}
                aria-label={t.chatStop}
                title={t.chatStop}
                className="button-secondary min-h-8 px-2.5 text-xs justify-center"
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
                className="button-secondary min-h-8 px-2.5 text-xs justify-center disabled:opacity-45"
              >
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{t.chatWrapUp}</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearRoom}
              aria-label={t.chatClear}
              title={t.chatClear}
              className="button-quiet min-h-8 px-2 text-xs justify-center"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.chatClear}</span>
            </button>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
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

        {/* Solo Bot Multi-Thread Switcher & CRUD Bar */}
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
                    onChange={(e) => setThreadTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitThreadRename();
                      if (e.key === 'Escape') setRenamingThread(false);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-brass bg-surface px-2 py-1 text-xs text-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void commitThreadRename()}
                    aria-label={ux.saveChanges}
                    className="icon-button h-7 w-7 min-h-0 min-w-0 shrink-0 text-sage"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingThread(false)}
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
                    onClick={() => {
                      setThreadTitleDraft(currentRoom.title);
                      setRenamingThread(true);
                    }}
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

        {/* Plan Downgrade / Expiry Bot-Disabling Banner */}
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

        {/* Honest No-Key Preview Banner — tells user clearly when bots run in offline preview vs live BYOK */}
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
              {!panel.visible && (
                <button
                  type="button"
                  id="chat-open-panel-cta"
                  onClick={panel.toggle}
                  className="inline-flex min-h-7 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink transition hover:border-brass/50"
                >
                  <Settings2 className="h-3 w-3" aria-hidden="true" />
                  <span>{isSolo ? ux.openSettingsCtaSolo : ux.openSettingsCtaGroup}</span>
                </button>
              )}
            </div>
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
                  <button
                    type="button"
                    onClick={() => insertMention('all')}
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

          {currentRoom.messages.map((message) => {
            const isUser = message.authorId === USER_HANDLE;
            const persona = roster.find((item) => matchId(item, message.authorId));

            const attachments =
              message.attachments && message.attachments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {/* Rich Media Previews (Images & Videos) */}
                  {message.attachments.some(
                    (att) =>
                      (att.kind === 'image' && att.dataUrl) ||
                      (att.kind === 'video' &&
                        (att.previewUrl || (att.frames && att.frames.length > 0)))
                  ) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {message.attachments.map((att) => {
                        if (att.kind === 'image' && att.dataUrl) {
                          return (
                            <div
                              key={`${att.id}-img`}
                              className="overflow-hidden rounded-xl border border-border/60 bg-black/10"
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
                              className="overflow-hidden rounded-xl border border-border/60 bg-black/20"
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
                              className="overflow-hidden rounded-xl border border-border/60 bg-black/10"
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
                      const hasProblem = Boolean(attachment.problem);
                      const chipClasses = hasProblem
                        ? isUser
                          ? 'border-terracotta/50 bg-surface/95 text-ink'
                          : 'border-terracotta/45 bg-terracotta/10 text-ink'
                        : isUser
                          ? 'border-current/30 bg-black/10'
                          : 'border-border bg-background/60 text-ink-muted';
                      const iconClasses = hasProblem
                        ? 'text-terracotta'
                        : isUser
                          ? ''
                          : 'text-brass';
                      return (
                        <li
                          key={attachment.id}
                          className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed ${chipClasses}`}
                        >
                          <AttachmentGlyph
                            attachment={attachment}
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconClasses}`}
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
                                  isUser && !hasProblem ? '' : 'text-ink'
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
                    {/* Clamp long user prompts while keeping @mention pills and readable contrast on accent background */}
                    <ExpandableText
                      key={message.id}
                      text={message.body}
                      maxLines={5}
                      className="text-sm leading-relaxed"
                      buttonClassName="text-current opacity-85 hover:opacity-100"
                      showMoreLabel={t.summaryShowMore}
                      showLessLabel={t.summaryShowLess}
                    >
                      {renderBody(message.body, rosterNames, true)}
                    </ExpandableText>
                    {attachments}
                  </div>
                </article>
              );
            }

            const color = persona?.colorHex ?? 'var(--color-ink-muted)';
            const rich = hasRichContent(message.body);
            return (
              <article key={message.id} className="chat-pop flex items-start gap-2.5 sm:gap-3">
                <Avatar name={persona?.name ?? '?'} color={color} />
                <div className="min-w-0 max-w-[88%] sm:max-w-[min(72%,46rem)]">
                  <header className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                      {persona?.name ?? message.authorId}
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
                    {/* Support both inline expand/collapse and full panel modal for rich advisor replies */}
                    {rich ? (
                      <ExpandableText
                        key={message.id}
                        as="div"
                        text={message.body}
                        maxHeight={280}
                        showMoreLabel={t.summaryShowMore}
                        showLessLabel={t.summaryShowLess}
                      >
                        <ContentRenderPanel
                          content={message.body}
                          compact
                          showHeader={false}
                          renderMentionText={(plain) => renderBody(plain, rosterNames)}
                        />
                      </ExpandableText>
                    ) : (
                      <ExpandableText
                        key={message.id}
                        text={message.body}
                        maxLines={5}
                        className="text-sm leading-relaxed text-ink"
                        showMoreLabel={t.summaryShowMore}
                        showLessLabel={t.summaryShowLess}
                      >
                        {renderBody(message.body, rosterNames)}
                      </ExpandableText>
                    )}
                    {rich && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            openContentPanel({
                              title: persona?.name ?? t.contentPanelTitle,
                              content: message.body,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
                        >
                          <Maximize2 className="h-3 w-3" aria-hidden="true" />
                          <span>{t.contentPanelOpen}</span>
                        </button>
                      </div>
                    )}
                    {attachments}
                  </div>
                </div>
              </article>
            );
          })}

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

          {pauseNote && (
            <p className="mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-border bg-background/60 px-3.5 py-3 text-xs leading-relaxed text-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <span>{pauseNote}</span>
            </p>
          )}
        </div>

        {/* Composer Footer */}
        <div className="border-t border-border bg-background/50 px-2.5 py-2 sm:px-5 sm:py-3">
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
                  onSelect={selectMentionCandidate}
                  onHover={setActiveMentionIdx}
                />
              )}

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

              <form onSubmit={handleSubmit} className="flex flex-col">
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
                    setDraft(nextValue);
                    setCursorPos(nextCursor);
                    setActiveMentionIdx(0);

                    const nextMatch = detectMentionQuery(nextValue, nextCursor, completedHandles);
                    // Bulk paste of an already-complete handle (e.g. "stop @The Pragmatist") stays un-intercepted
                    // so immediate Enter submits, while interactive '@' typing or prefix queries open the menu.
                    const isBulkExactHandle =
                      delta > 3 &&
                      !nextValue.endsWith('@') &&
                      nextMatch !== null &&
                      nextMatch.query.length > 0 &&
                      mentionCandidates.some(
                        (c) => compactMentionKey(c.handle) === compactMentionKey(nextMatch.query)
                      );
                    if (isBulkExactHandle && nextMatch) {
                      setDismissedAtStart(nextMatch.start);
                    } else {
                      setDismissedAtStart(null);
                    }
                  }}
                  onClick={(event) => {
                    setCursorPos(event.currentTarget.selectionStart ?? draft.length);
                  }}
                  onKeyUp={(event) => {
                    if (
                      event.key === 'ArrowLeft' ||
                      event.key === 'ArrowRight' ||
                      event.key === 'Home' ||
                      event.key === 'End'
                    ) {
                      setCursorPos(event.currentTarget.selectionStart ?? draft.length);
                    }
                  }}
                  onPaste={(event) => {
                    if (event.clipboardData.files.length === 0) return;
                    event.preventDefault();
                    void takeFiles(event.clipboardData.files);
                  }}
                  onKeyDown={(event) => {
                    if (mentionOpen && filteredCandidates.length > 0) {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveMentionIdx((safeMentionIdx + 1) % filteredCandidates.length);
                        return;
                      }
                      if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveMentionIdx(
                          (safeMentionIdx - 1 + filteredCandidates.length) %
                            filteredCandidates.length
                        );
                        return;
                      }
                      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
                        event.preventDefault();
                        selectMentionCandidate(filteredCandidates[safeMentionIdx]);
                        return;
                      }
                    }
                    if (mentionOpen && event.key === 'Escape' && mentionMatch) {
                      event.preventDefault();
                      event.stopPropagation();
                      setDismissedAtStart(mentionMatch.start);
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
                      onClick={() => setShowLink((value) => !value)}
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
                      onClick={handleMentionButtonClick}
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
                        title={t.chatCapNote.replace('{cap}', String(plan.maxActiveAdvisors))}
                      >
                        <AlertCircle className="h-4 w-4 text-brass" aria-hidden="true" />
                        <span className="sr-only">
                          {t.chatCapNote.replace('{cap}', String(plan.maxActiveAdvisors))}
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
      </div>
    </div>
  );
};
