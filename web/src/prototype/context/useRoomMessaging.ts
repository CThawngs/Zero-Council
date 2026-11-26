/**
 * Domain hook managing active room message dispatch, turn retries, attachments (links, files,
 * images, video keyframes), live web search, and AI Chair conclusion synthesis (`sessions`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdvisorPersona,
  ApiKeyConfig,
  DeliberationSession,
  Language,
  ModelProvider,
  SavedConversation,
  ViewType,
} from '../types';
import type { CommunicationMode, Round } from '@/lib/deliberation/types';
import { deleteSessionFromList, renameSessionInList } from '../sessions-crud';
import { copy } from '../i18n';
import {
  COUNCIL_ROUNDS,
  DEFAULT_MAX_TURNS,
  DEFAULT_ROOM_BUDGET,
  DEFAULT_TURN_TIMEOUT_MS,
  RESUME_ALL,
  USER_HANDLE,
  isResumeDirective,
  isStopDirective,
  parseMentions,
  runTurn,
  type BotTurn,
  type ChatAttachment,
  type ChatBot,
  type ChatMessage,
  type ChatMode,
  type TurnFailureReason,
} from '../chat/engine';
import { byokGenerator } from '../chat/byok';
import {
  ConclusionAnalysisError,
  analyzeChatRoomConclusion,
  matchPersonaId,
} from '../chat/conclusion';
import { UnreadableLinkError, readLinkInBrowser } from '../chat/read-link-web';
import { UnreadableFileError, readFileInBrowser } from '../chat/read-file-web';
import { MAX_IMAGES_PER_MESSAGE, isImageFile, readImageInBrowser } from '../chat/read-image-web';
import { isVideoFile, readVideoInBrowser } from '../chat/read-video-web';
import { clearStoredRoom } from '../chat/storage';
import type { PlanId } from '../data/plans';
import { partitionRoomRosterByPlan } from '@/lib/store/planLimits';
import {
  completeByokTextViaServer,
  emptyConcludedSession,
  localizeSession,
  nextSessionId,
  toChatBots,
} from './helpers';
import type { ChatRoom, ToastKey, ToastValues } from './types';

export function useRoomMessaging({
  authUser,
  language,
  currentPlanId,
  personaCap,
  botCap,
  disabledBotIds,
  personas,
  localizedPersonas,
  apiKeys,
  keys,
  currentRoom,
  setCurrentRoom,
  setConversations,
  roomAbortRef,
  persistRoomSnapshot,
  joinRoom,
  setCurrentView,
  showToast,
}: {
  authUser: { id: string; email: string } | null;
  language: Language;
  currentPlanId: PlanId;
  personaCap: number;
  botCap: number;
  disabledBotIds: Set<string>;
  personas: AdvisorPersona[];
  localizedPersonas: AdvisorPersona[];
  apiKeys: ApiKeyConfig[];
  keys: Record<string, string>;
  currentRoom: ChatRoom | null;
  setCurrentRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>>;
  setConversations: React.Dispatch<React.SetStateAction<SavedConversation[]>>;
  roomAbortRef: React.MutableRefObject<AbortController | null>;
  persistRoomSnapshot: (snapshot: ChatRoom) => Promise<void>;
  joinRoom: (roster: AdvisorPersona[], mode: ChatMode, title?: string) => void;
  setCurrentView: (view: ViewType) => void;
  showToast: (key: ToastKey, values?: ToastValues) => void;
}) {
  const [sessions, setSessions] = useState<DeliberationSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [conclusionError, setConclusionError] = useState<{
    reason: TurnFailureReason;
    message: string;
  } | null>(null);
  const clearConclusionError = useCallback(() => setConclusionError(null), []);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const [isRoomBusy, setIsRoomBusy] = useState(false);
  const [isReadingLink, setIsReadingLink] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const openingQuestionRef = useRef<string | null>(null);

  const localizedSessions = useMemo(
    () => sessions.map((session) => localizeSession(session, language)),
    [language, sessions]
  );

  const currentSession =
    localizedSessions.find((session) => session.id === currentSessionId) ||
    localizedSessions[0] ||
    emptyConcludedSession(language);

  const cancelRound = () => {
    abortRef.current?.abort();
  };

  const selectRound = (index: number) => setSelectedRoundIndex(index);

  const purgeSessions = () => {
    setSessions([]);
    setConversations([]);
    setCurrentRoom(null);
    clearStoredRoom();
    if (authUser) {
      void fetch('/api/conversations', { method: 'DELETE', credentials: 'same-origin' }).catch(
        () => undefined
      );
    }
    showToast('toastSessionsReset');
  };

  const renameSession = (id: string, title: string) => {
    setSessions((value) => renameSessionInList(value, id, title));
  };

  const deleteSession = (id: string) => {
    setSessions((value) => deleteSessionFromList(value, id));
  };

  const attachLink = async (url: string) => {
    const href = url.trim();
    if (!href) return;
    setIsReadingLink(true);
    const attachment: ChatAttachment = {
      id: `att-${Date.now()}`,
      kind: 'link',
      name: href,
      href,
    };
    try {
      const reading = await readLinkInBrowser(href, { language });
      attachment.text = reading.text;
    } catch (error) {
      let resolvedViaServer = false;
      if (authUser) {
        try {
          const res = await fetch('/api/read-link', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: href }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              title?: string;
              text?: string;
              truncated?: boolean;
            };
            if (data.text) {
              attachment.text = data.text;
              attachment.truncated = Boolean(data.truncated);
              if (data.title) attachment.name = data.title;
              resolvedViaServer = true;
            }
          }
        } catch {
          // Server link reader failed; record original browser error below.
        }
      }
      if (!resolvedViaServer) {
        attachment.problem = error instanceof UnreadableLinkError ? error.reason : String(error);
      }
    } finally {
      setIsReadingLink(false);
      setCurrentRoom((room) =>
        room ? { ...room, pending: [...room.pending, attachment] } : room
      );
    }
  };

  const attachFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsReadingFile(true);
    let images = (currentRoom?.pending ?? []).filter(
      (item) => item.kind === 'image' && !item.problem
    ).length;
    try {
      for (const file of files) {
        const video = isVideoFile(file);
        const image = !video && isImageFile(file);
        const kind: ChatAttachment['kind'] = video ? 'video' : image ? 'image' : 'file';
        const attachment: ChatAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          name: file.name,
          href: `${kind}:${file.name}`,
        };
        try {
          if (video) {
            const videoReading = await readVideoInBrowser(file, { language });
            attachment.previewUrl = videoReading.previewUrl;
            attachment.frames = videoReading.frames;
            attachment.text = videoReading.summary;
          } else if (image) {
            if (images >= MAX_IMAGES_PER_MESSAGE * 2) {
              throw new UnreadableFileError(
                copy[language].chatMaxImagesError.replace('{max}', String(MAX_IMAGES_PER_MESSAGE * 2))
              );
            }
            attachment.dataUrl = (await readImageInBrowser(file, { language })).dataUrl;
            images += 1;
          } else {
            const reading = await readFileInBrowser(file, { language });
            attachment.text = reading.text;
            if (reading.truncated) attachment.truncated = true;
          }
        } catch (error) {
          attachment.problem = error instanceof UnreadableFileError ? error.reason : String(error);
        }
        setCurrentRoom((room) =>
          room ? { ...room, pending: [...room.pending, attachment] } : room
        );
      }
    } finally {
      setIsReadingFile(false);
    }
  };

  const removePending = (id: string) => {
    setCurrentRoom((room) =>
      room ? { ...room, pending: room.pending.filter((item) => item.id !== id) } : room
    );
  };

  const executeRoomTurn = async ({
    parked,
    historyBeforeTurn,
    userMessage,
    turnsBeforeTurn,
    active,
    activeBots,
    isSolo,
  }: {
    parked: ChatRoom;
    historyBeforeTurn: ChatMessage[];
    userMessage: ChatMessage;
    turnsBeforeTurn: number;
    active: AdvisorPersona[];
    activeBots: ChatBot[];
    isSolo: boolean;
  }) => {
    const controller = new AbortController();
    roomAbortRef.current = controller;

    try {
      const result = await runTurn({
        roster: activeBots,
        mode: isSolo ? 'round-robin' : parked.mode,
        soloMode: isSolo,
        history: historyBeforeTurn,
        userMessage,
        generate: (request) => {
          const persona = active.find((p) => p.id === request.bot.id);
          if (!persona) {
            throw new Error('PROVIDER_NOT_CONNECTED');
          }
          const isUserBot = persona.id.startsWith('bot:');
          const resolvedProvider: ModelProvider | undefined = persona.provider;
          const resolvedKey = keys[persona.provider];
          const keyMeta = apiKeys.find((item) => item.provider === persona.provider);
          const hasServerKey = Boolean(keyMeta?.connected && keyMeta?.hasKey);
          const resolvedModel = isUserBot
            ? persona.model
            : keyMeta?.connected
              ? keyMeta.modelName
              : persona.model;
          if (!resolvedProvider || (!resolvedKey && !hasServerKey)) {
            throw new Error(`PROVIDER_NOT_CONNECTED [provider=${persona.provider}]`);
          }
          if (!resolvedKey) {
            const { signal: turnSignal, ...serializableTurn } = request;
            const botPersona = active.find((p) => p.id === request.bot.id)?.instructions;
            return fetch('/api/providers/chat', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: 'turn',
                provider: resolvedProvider,
                model: resolvedModel,
                ...(isUserBot ? { botId: persona.id.slice(4) } : {}),
                persona: botPersona,
                turnRequest: serializableTurn,
              }),
              signal: turnSignal,
            }).then(async (response) => {
              const payload = (await response.json().catch(() => null)) as {
                ok?: boolean;
                turn?: BotTurn;
                error?: unknown;
              } | null;
              if (!response.ok || payload?.ok !== true || !payload.turn) {
                const rawCode =
                  typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR';
                throw new Error(`${rawCode} [provider=${resolvedProvider}]`);
              }
              return payload.turn;
            });
          }
          return byokGenerator(
            {
              provider: resolvedProvider,
              model: resolvedModel,
              apiKey: resolvedKey,
              protocol: keyMeta?.protocol,
              baseUrl: keyMeta?.baseUrl,
            },
            { personaOf: (bot) => active.find((p) => p.id === bot.id)?.instructions }
          )(request);
        },
        maxTurns: isSolo ? 1 : DEFAULT_MAX_TURNS,
        rounds: isSolo ? 1 : COUNCIL_ROUNDS,
        roomBudget: DEFAULT_ROOM_BUDGET,
        turnsUsed: turnsBeforeTurn,
        language,
        roundIndex: parked.messages.filter((message) => message.authorId === USER_HANDLE).length,
        signal: controller.signal,
        turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS,
        onTurn: (message) => {
          setCurrentRoom((room) =>
            room ? { ...room, messages: [...room.messages, message] } : room
          );
        },
      });

      const finalSnapshot: ChatRoom = {
        ...parked,
        messages: result.messages,
        turns: turnsBeforeTurn + result.speakers.length,
        stoppedBy: result.stoppedBy,
        failures: result.failures,
        failureReason: result.failureReason,
        turnError: result.turnError ?? null,
      };
      setCurrentRoom(finalSnapshot);
      void persistRoomSnapshot(finalSnapshot);
    } finally {
      roomAbortRef.current = null;
      setIsRoomBusy(false);
    }
  };

  const sendMessage = async (body: string) => {
    if (!currentRoom) return;
    const isSolo = currentRoom.kind === 'solo' || currentRoom.roster.length === 1;
    const { activeIds } = partitionRoomRosterByPlan(
      currentRoom.roster,
      currentPlanId,
      disabledBotIds
    );

    if (activeIds.length === 0) {
      showToast('toastPersonaCap', { cap: String(isSolo ? botCap : personaCap) });
      return;
    }

    const roster = activeIds
      .map((id) => localizedPersonas.find((persona) => matchPersonaId(persona, id)))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    const rosterBots = toChatBots(roster);

    const resume = !isSolo && isResumeDirective(body, rosterBots);
    const stopping = !isSolo && isStopDirective(body, rosterBots);
    const held = isSolo
      ? []
      : resume
        ? []
        : stopping
          ? [
              ...new Set([
                ...currentRoom.held,
                ...parseMentions(body, rosterBots).filter(
                  (id) => id !== USER_HANDLE && id !== RESUME_ALL
                ),
              ]),
            ]
          : currentRoom.held;

    const active = resume ? roster : roster.filter((persona) => !held.includes(persona.id));
    const activeBots = toChatBots(active);

    const turnAttachments: ChatAttachment[] = [...currentRoom.pending];

    if (webSearchEnabled && !stopping) {
      setIsSearchingWeb(true);
      try {
        const searchRes = await fetch(`/api/web-search?q=${encodeURIComponent(body.slice(0, 260))}`, {
          credentials: 'same-origin',
        });
        if (searchRes.ok) {
          const searchPayload = (await searchRes.json()) as {
            results?: { title: string; url: string; snippet: string }[];
          };
          if (searchPayload.results && searchPayload.results.length > 0) {
            for (const source of searchPayload.results.slice(0, 4)) {
              turnAttachments.push({
                id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                kind: 'link',
                name: source.title,
                href: source.url,
                text: source.snippet || source.title,
              });
            }
          }
        }
      } catch {
        // Best-effort live search; proceed with turn even if offline.
      } finally {
        setIsSearchingWeb(false);
      }
    }

    const userMessage: ChatMessage = {
      id: `${currentRoom.messages.length}`,
      authorId: USER_HANDLE,
      body,
      mentioned: isSolo ? [] : parseMentions(body, activeBots),
      ...(turnAttachments.length > 0 ? { attachments: turnAttachments } : {}),
    };

    const autoTitle =
      currentRoom.messages.length === 0 &&
      (currentRoom.title === 'New Chat' ||
        currentRoom.title === 'Group Chat' ||
        currentRoom.title === copy.en.defaultSoloTitle ||
        currentRoom.title === copy.vi.defaultSoloTitle ||
        currentRoom.title === copy.en.defaultGroupTitle ||
        currentRoom.title === copy.vi.defaultGroupTitle ||
        currentRoom.title === copy.en.soloNewThread ||
        currentRoom.title === copy.vi.soloNewThread ||
        currentRoom.title === copy.en.chatRoomTitle ||
        currentRoom.title === copy.vi.chatRoomTitle)
        ? body.slice(0, 60)
        : currentRoom.title;

    const parked: ChatRoom = {
      ...currentRoom,
      title: autoTitle,
      messages: [...currentRoom.messages, userMessage],
      pending: [],
      stoppedBy: null,
      failures: [],
      failureReason: undefined,
      turnError: null,
      held,
    };
    setCurrentRoom(parked);
    setIsRoomBusy(true);

    if (stopping) {
      setIsRoomBusy(false);
      void persistRoomSnapshot(parked);
      return;
    }

    await executeRoomTurn({
      parked,
      historyBeforeTurn: currentRoom.messages,
      userMessage,
      turnsBeforeTurn: currentRoom.turns,
      active,
      activeBots,
      isSolo,
    });
  };

  const retryLastTurn = async () => {
    if (!currentRoom || isRoomBusy) return;
    let lastUserIdx = -1;
    for (let i = currentRoom.messages.length - 1; i >= 0; i -= 1) {
      if (currentRoom.messages[i].authorId === USER_HANDLE) {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;

    const isSolo = currentRoom.kind === 'solo' || currentRoom.roster.length === 1;
    const { activeIds } = partitionRoomRosterByPlan(
      currentRoom.roster,
      currentPlanId,
      disabledBotIds
    );
    if (activeIds.length === 0) {
      showToast('toastPersonaCap', { cap: String(isSolo ? botCap : personaCap) });
      return;
    }

    const roster = activeIds
      .map((id) => localizedPersonas.find((persona) => matchPersonaId(persona, id)))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    const active = isSolo
      ? roster
      : roster.filter((persona) => !currentRoom.held.includes(persona.id));
    const activeBots = toChatBots(active);

    const historyBeforeTurn = currentRoom.messages.slice(0, lastUserIdx);
    const userMessage = currentRoom.messages[lastUserIdx];
    const partialBotReplies = currentRoom.messages.length - (lastUserIdx + 1);
    const turnsBeforeTurn = Math.max(0, currentRoom.turns - partialBotReplies);

    const parked: ChatRoom = {
      ...currentRoom,
      messages: [...historyBeforeTurn, userMessage],
      stoppedBy: null,
      failures: [],
      failureReason: undefined,
      turnError: null,
    };
    setCurrentRoom(parked);
    setIsRoomBusy(true);

    await executeRoomTurn({
      parked,
      historyBeforeTurn,
      userMessage,
      turnsBeforeTurn,
      active,
      activeBots,
      isSolo,
    });
  };

  const startCouncilChat = (
    question: string,
    advisors?: AdvisorPersona[],
    mode: ChatMode = 'round-robin'
  ) => {
    const body = question.trim();
    if (!body) return;
    const title = body.length > 72 ? `${body.slice(0, 69).trimEnd()}…` : body;
    const seated = (advisors ?? localizedPersonas).slice(0, personaCap);
    if (
      currentRoom &&
      currentRoom.messages.length > 0 &&
      currentRoom.title === title &&
      currentRoom.roster.join('|') === seated.map((persona) => persona.id).join('|')
    ) {
      setCurrentView('chat-room');
      return;
    }
    const begin = () => {
      openingQuestionRef.current = body;
      joinRoom(seated, mode, title);
    };
    if (roomAbortRef.current === null) {
      begin();
      return;
    }
    roomAbortRef.current.abort();
    const startedAt = Date.now();
    const wait = setInterval(() => {
      if (roomAbortRef.current === null || Date.now() - startedAt > 5000) {
        clearInterval(wait);
        begin();
      }
    }, 50);
  };

  useEffect(() => {
    const opening = openingQuestionRef.current;
    if (opening === null || !currentRoom || currentRoom.messages.length > 0) return;
    openingQuestionRef.current = null;
    void sendMessage(opening);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom]);

  const wrapUpRoom = () => {
    const wasRunning = roomAbortRef.current !== null;
    roomAbortRef.current?.abort();
    if (wasRunning) {
      setCurrentRoom((room) => (room ? { ...room, stoppedBy: 'cancelled' } : room));
    }
    setCurrentView('room-summary');
  };

  const openRoomConclusion = () => {
    if (!currentRoom || isDeliberating) return;
    const wasRunning = roomAbortRef.current !== null;
    roomAbortRef.current?.abort();
    if (wasRunning) {
      setCurrentRoom((room) => (room ? { ...room, stoppedBy: 'cancelled' } : room));
    }
    let seated = currentRoom.roster
      .map((id) => localizedPersonas.find((persona) => matchPersonaId(persona, id)))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    if (seated.length === 0) {
      seated = currentRoom.roster
        .map((id) => personas.find((persona) => matchPersonaId(persona, id)))
        .filter((persona): persona is AdvisorPersona => Boolean(persona));
    }
    if (seated.length === 0) {
      seated = localizedPersonas.slice(0, personaCap);
    }
    if (seated.length === 0) return;

    const firstUserMessage = currentRoom.messages.find(
      (message) => message.authorId === USER_HANDLE && message.body.trim().length > 0
    )?.body;
    const topic = (currentRoom.title || firstUserMessage || copy[language].initialProjectTitle).trim();
    const promptText = (firstUserMessage || topic).trim();
    const roomMessages = [...currentRoom.messages];
    const mode: CommunicationMode = currentRoom.mode === 'panel' ? 'independent' : 'debate';

    void (async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setConclusionError(null);
      setIsDeliberating(true);
      try {
        const { analysis, contributions } = await analyzeChatRoomConclusion({
          topic,
          messages: roomMessages,
          seated,
          allPersonas: [...localizedPersonas, ...personas],
          apiKeys,
          keys,
          language,
          signal: controller.signal,
          completeFn: completeByokTextViaServer,
        });

        const round: Round = {
          index: 1,
          mode,
          framework: 'scenarios',
          prompt: promptText,
          language,
          contributions,
          chair: analysis.chair,
          frameworkOutput: {
            kind: 'scenarios',
            matrix: null,
          },
        };

        const session: DeliberationSession = {
          id: nextSessionId(),
          title: topic,
          summary: analysis.chair.summary,
          framework: 'Good / Normal / Bad Scenarios',
          mode,
          timestamp: new Date().toISOString(),
          relativeTime: copy[language].sampleNow,
          status: 'Concluded',
          advisors: seated,
          rounds: [round],
          scenarios: analysis.scenarios,
        };

        setSessions((value) => [session, ...value]);
        setCurrentSessionId(session.id);
        setSelectedRoundIndex(1);
        setCurrentView('session-concluded');
      } catch (err) {
        if (
          controller.signal.aborted ||
          (err as { name?: string } | null)?.name === 'AbortError'
        ) {
          return;
        }
        if (err instanceof ConclusionAnalysisError) {
          setConclusionError({ reason: err.reason, message: err.message });
        } else {
          const message = err instanceof Error ? err.message : 'PROVIDER_ERROR';
          setConclusionError({ reason: 'provider-error', message });
        }
        console.error('[conclusion] failed to open room conclusion:', err);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsDeliberating(false);
      }
    })();
  };

  return {
    sessions: localizedSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    cancelRound,
    isDeliberating,
    selectedRoundIndex,
    selectRound,
    purgeSessions,
    renameSession,
    deleteSession,
    conclusionError,
    clearConclusionError,
    isRoomBusy,
    isReadingLink,
    isReadingFile,
    webSearchEnabled,
    setWebSearchEnabled,
    isSearchingWeb,
    attachLink,
    attachFiles,
    removePending,
    sendMessage,
    retryLastTurn,
    startCouncilChat,
    wrapUpRoom,
    openRoomConclusion,
  };
}
