/**
 * Interactive Solo & Group Council chat room view with @mentions, attachments, web search, and retry cards.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/catalog';
import { planById } from '../data/plans';
import {
  CHAT_UX_COPY,
  applyMentionReplacement,
  buildMentionCandidates,
  detectMentionQuery,
  filterMentionCandidates,
  triggerMentionAtCursor,
  type MentionCandidate,
} from '../chat/mentions';
import { useBotSettingsPanel } from './BotSettingsPanel';
import { Modal } from './Modal';
import { ChatComposer } from './chat-room/ChatComposer';
import { ChatRoomHeader } from './chat-room/ChatRoomHeader';
import { ChatTranscriptLog } from './chat-room/ChatTranscriptLog';
import {
  AttachmentGlyph,
  Avatar,
  buildTurnFailureCard,
  matchPersonaId,
} from './chat-room/helpers';

export { AttachmentGlyph, Avatar };

export const ChatRoomView: React.FC = () => {
  const {
    currentRoom,
    roomRosterPartition,
    conversations,
    renameConversation,
    sendMessage,
    clearRoom,
    attachLink,
    attachFiles,
    isRoomBusy,
    isReadingLink,
    isReadingFile,
    isSearchingWeb,
    personas,
    apiKeys,
    getProviderSecret,
    openFirstBotOrWizard,
    showToast,
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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const isRunning = isRoomBusy;
  const plan = planById(currentPlanId);

  const roster = useMemo(
    () =>
      currentRoom
        ? currentRoom.roster
            .map((id) => personas.find((persona) => matchPersonaId(persona, id)))
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
      default:
        return null;
    }
  })();

  const turnFailureCard = buildTurnFailureCard({
    isRunning,
    currentRoom,
    roster,
    t,
    ux,
  });

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
          onClick={() => openFirstBotOrWizard()}
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

  const handleClearClick = () => {
    if (currentRoom.messages.length === 0 && !currentRoom.conversationId) {
      clearRoom();
      return;
    }
    setClearConfirmOpen(true);
  };

  const confirmClearRoom = () => {
    setClearConfirmOpen(false);
    clearRoom();
    showToast('chatClearedToast');
  };

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
      data-chat-pane={expanded ? 'expanded' : 'full'}
      className={
        expanded
          ? 'fixed inset-0 z-[60] flex flex-col bg-surface'
          : '-mx-4 -my-5 flex h-[calc(100dvh-76px)] flex-col bg-surface sm:-mx-6 sm:-my-7 lg:-mx-8 lg:-my-9'
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
        data-chat-pane-surface
        className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-surface ${
          dragging ? 'ring-2 ring-inset ring-brass/40' : ''
        }`}
      >
        <ChatRoomHeader
          currentRoom={currentRoom}
          roster={roster}
          disabledSet={disabledSet}
          isSolo={isSolo}
          isRunning={isRunning}
          soloBotLocked={soloBotLocked}
          groupLockedCount={groupLockedCount}
          planName={plan.name}
          noKeyMessage={noKeyMessage}
          panelVisible={panel.visible}
          expanded={expanded}
          soloThreads={soloThreads}
          renamingThread={renamingThread}
          threadTitleDraft={threadTitleDraft}
          ux={ux}
          onToggleExpanded={() => setExpanded((value) => !value)}
          onClearClick={handleClearClick}
          onTogglePanel={panel.toggle}
          onThreadTitleDraftChange={setThreadTitleDraft}
          onStartRenameThread={() => {
            setThreadTitleDraft(currentRoom.title);
            setRenamingThread(true);
          }}
          onCancelRenameThread={() => setRenamingThread(false)}
          onCommitRenameThread={() => void commitThreadRename()}
        />

        <ChatTranscriptLog
          logRef={logRef}
          currentRoom={currentRoom}
          roster={roster}
          rosterNames={rosterNames}
          disabledSet={disabledSet}
          isSolo={isSolo}
          isRunning={isRunning}
          isSearchingWeb={isSearchingWeb}
          expanded={expanded}
          turnFailureCard={turnFailureCard}
          pauseNote={pauseNote}
          onInsertMention={insertMention}
        />

        <ChatComposer
          currentRoom={currentRoom}
          draft={draft}
          link={link}
          showLink={showLink}
          isRunning={isRunning}
          soloBotLocked={soloBotLocked}
          blocked={blocked}
          maxActiveAdvisors={plan.maxActiveAdvisors}
          mentionOpen={mentionOpen}
          mentionMatch={mentionMatch}
          mentionCandidates={mentionCandidates}
          filteredCandidates={filteredCandidates}
          safeMentionIdx={safeMentionIdx}
          completedHandles={completedHandles}
          ux={ux}
          composerRef={composerRef}
          composerCardRef={composerCardRef}
          fileInputRef={fileInputRef}
          onDraftChange={(nextValue, nextCursor, dismissStart) => {
            setDraft(nextValue);
            setCursorPos(nextCursor);
            setActiveMentionIdx(0);
            setDismissedAtStart(dismissStart);
          }}
          onCursorChange={setCursorPos}
          onSetActiveMentionIdx={setActiveMentionIdx}
          onDismissMention={setDismissedAtStart}
          onSelectMentionCandidate={selectMentionCandidate}
          onMentionButtonClick={handleMentionButtonClick}
          onLinkChange={setLink}
          onToggleShowLink={() => setShowLink((value) => !value)}
          onAttachLinkSubmit={(e) => void handleAttach(e)}
          onTakeFiles={(list) => void takeFiles(list)}
          onSubmit={(e) => void handleSubmit(e)}
        />
      </div>

      <Modal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title={t.chatClearConfirmTitle}
        description={t.chatClearConfirmBody}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setClearConfirmOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.chatClearKeepAction}
            </button>
            <button
              type="button"
              id="confirm-clear-room-btn"
              onClick={confirmClearRoom}
              className="button-danger min-h-11 justify-center"
            >
              {t.chatClearConfirmAction}
            </button>
          </>
        }
      />
    </div>
  );
};
