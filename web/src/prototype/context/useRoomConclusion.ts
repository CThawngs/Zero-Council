/**
 * Sub-hook managing concluded deliberation sessions (`sessions`) and AI Chair synthesis (`openRoomConclusion`).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  AdvisorPersona,
  ApiKeyConfig,
  DeliberationSession,
  Language,
  SavedConversation,
  ViewType,
} from '../types';
import type { CommunicationMode, Round } from '@/lib/deliberation/types';
import { deleteSessionFromList, renameSessionInList } from '../sessions-crud';
import { copy } from '../i18n';
import { USER_HANDLE, type TurnFailureReason } from '../chat/engine';
import {
  ConclusionAnalysisError,
  analyzeChatRoomConclusion,
  matchPersonaId,
} from '../chat/conclusion';
import { clearStoredRoom } from '../chat/storage';
import {
  completeByokTextViaServer,
  emptyConcludedSession,
  localizeSession,
  nextSessionId,
} from './helpers';
import type { ChatRoom, ToastKey, ToastValues } from './types';

export function useRoomConclusion({
  authUser,
  language,
  personaCap,
  personas,
  localizedPersonas,
  apiKeys,
  keys,
  currentRoom,
  setCurrentRoom,
  setConversations,
  roomAbortRef,
  setCurrentView,
  showToast,
}: {
  authUser: { id: string; email: string } | null;
  language: Language;
  personaCap: number;
  personas: AdvisorPersona[];
  localizedPersonas: AdvisorPersona[];
  apiKeys: ApiKeyConfig[];
  keys: Record<string, string>;
  currentRoom: ChatRoom | null;
  setCurrentRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>>;
  setConversations: React.Dispatch<React.SetStateAction<SavedConversation[]>>;
  roomAbortRef: React.MutableRefObject<AbortController | null>;
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
    const topic = (
      currentRoom.title ||
      firstUserMessage ||
      copy[language].initialProjectTitle
    ).trim();
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
    wrapUpRoom,
    openRoomConclusion,
  };
}
