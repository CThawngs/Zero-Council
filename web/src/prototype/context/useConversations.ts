/**
 * Domain hook managing durable solo & group conversations (`conversations`), active room state
 * (`currentRoom`), browser storage hydration/persistence, and group creation/editing modals.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdvisorPersona,
  Language,
  SavedConversation,
  UserBot,
  ViewType,
} from '../types';
import { copy } from '../i18n';
import type { ChatMode, TurnFailure, WhyStop } from '../chat/engine';
import { clearStoredRoom, readStoredRoom, writeStoredRoom } from '../chat/storage';
import type { PlanId } from '../data/plans';
import { partitionRoomRosterByPlan } from '@/lib/store/planLimits';
import { botPersonaId, botToPersona, useIsomorphicLayoutEffect } from './helpers';
import type { ChatRoom, ToastKey, ToastValues } from './types';

/** Returns true strictly when `conv` is a 1-on-1 (`solo`) conversation owned by `botId`. */
export function isSoloConversationForBot(conv: SavedConversation, botId: string): boolean {
  if (conv.kind !== 'solo') return false;
  return conv.botId === botId || conv.roster.includes(botPersonaId(botId));
}

/** Captures a deduplicated snapshot of all solo conversation IDs belonging to `botId`. */
export function snapshotBotSoloConversationIds(
  conversations: readonly SavedConversation[],
  botId: string
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const conv of conversations) {
    if (isSoloConversationForBot(conv, botId) && !seen.has(conv.id)) {
      seen.add(conv.id);
      ids.push(conv.id);
    }
  }
  return ids;
}

/** Returns true when `room` is an active solo room for `botId` or points to one of `purgedIds`. */
export function isSoloRoomForBot(
  room: Pick<ChatRoom, 'kind' | 'botId' | 'conversationId' | 'roster'> | null | undefined,
  botId: string,
  purgedIds?: ReadonlySet<string>
): boolean {
  if (!room) return false;
  if (room.conversationId && purgedIds?.has(room.conversationId)) return true;
  if (room.kind !== 'solo') return false;
  return room.botId === botId || room.roster.includes(botPersonaId(botId));
}

/** FIFO async queue preventing concurrent `DELETE /api/conversations` file-store writes. */
export function createSerialQueue() {
  let tail: Promise<void> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

/**
 * Deletes a single conversation on the server when authenticated and persisted (`!local-*`),
 * preserving immediate local deletion for unauthenticated or `local-*` conversations.
 */
export async function executeDeleteRemoteConversation(
  id: string,
  isAuthenticated: boolean,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!isAuthenticated || id.startsWith('local-')) {
    return true;
  }
  try {
    const res = await fetchImpl(`/api/conversations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BotSoloPurgeDeps {
  botId: string;
  isAuthenticated: boolean;
  getConversations: () => SavedConversation[];
  updateConversations: (updater: (prev: SavedConversation[]) => SavedConversation[]) => void;
  getCurrentRoom: () => ChatRoom | null;
  updateCurrentRoom: (updater: (prev: ChatRoom | null) => ChatRoom | null) => void;
  abortActiveTurn: () => void;
  clearStoredRoomFn: () => void;
  markConversationDeleted: (id: string) => void;
  purgingBotIds: Set<string>;
  enqueueDelete: <T>(task: () => Promise<T>) => Promise<T>;
  fetchImpl?: typeof fetch;
}

/**
 * Deterministically purges all solo conversations for `botId`:
 * - Snapshots target solo conversation IDs and serializes/awaits each server `DELETE`.
 * - Removes deleted entries via functional state updates without clobbering concurrent changes.
 * - Aborts/clears an active target-bot solo room at most once and never triggers `sameBotNext`.
 * - Throws if a remote `DELETE` fails so callers do not silently report success.
 */
export async function executeBotSoloConversationPurge({
  botId,
  isAuthenticated,
  getConversations,
  updateConversations,
  getCurrentRoom,
  updateCurrentRoom,
  abortActiveTurn,
  clearStoredRoomFn,
  markConversationDeleted,
  purgingBotIds,
  enqueueDelete,
  fetchImpl = fetch,
}: BotSoloPurgeDeps): Promise<void> {
  purgingBotIds.add(botId);
  try {
    const initialIds = snapshotBotSoloConversationIds(getConversations(), botId);
    const initialSet = new Set(initialIds);

    let abortedActiveBotRoom = false;
    if (isSoloRoomForBot(getCurrentRoom(), botId, initialSet)) {
      abortActiveTurn();
      abortedActiveBotRoom = true;
    }

    const purgedIds = new Set<string>();
    const processedIds = new Set<string>();
    let pendingIds = initialIds;

    while (pendingIds.length > 0) {
      for (const convId of pendingIds) {
        processedIds.add(convId);
        const ok = await enqueueDelete(() =>
          executeDeleteRemoteConversation(convId, isAuthenticated, fetchImpl)
        );
        if (!ok) {
          const activeRoom = getCurrentRoom();
          if (activeRoom?.conversationId && purgedIds.has(activeRoom.conversationId)) {
            clearStoredRoomFn();
            updateCurrentRoom((room) =>
              room?.conversationId && purgedIds.has(room.conversationId) ? null : room
            );
          }
          throw new Error(`CONVERSATION_PURGE_FAILED:${convId}`);
        }
        purgedIds.add(convId);
        markConversationDeleted(convId);
        updateConversations((prev) => prev.filter((item) => item.id !== convId));
      }
      pendingIds = snapshotBotSoloConversationIds(getConversations(), botId).filter(
        (id) => !processedIds.has(id)
      );
    }

    if (isSoloRoomForBot(getCurrentRoom(), botId, purgedIds)) {
      if (!abortedActiveBotRoom) {
        abortActiveTurn();
      }
      clearStoredRoomFn();
      updateCurrentRoom((room) =>
        room && isSoloRoomForBot(room, botId, purgedIds) ? null : room
      );
    }
  } finally {
    purgingBotIds.delete(botId);
  }
}

export interface SingleConversationDeleteDeps {
  id: string;
  isAuthenticated: boolean;
  getConversations: () => SavedConversation[];
  updateConversations: (updater: (prev: SavedConversation[]) => SavedConversation[]) => void;
  getCurrentRoom: () => ChatRoom | null;
  updateCurrentRoom: (updater: (prev: ChatRoom | null) => ChatRoom | null) => void;
  abortActiveTurn: () => void;
  clearStoredRoomFn: () => void;
  markConversationDeleted: (id: string) => void;
  purgingBotIds: ReadonlySet<string>;
  deletedBotIds: ReadonlySet<string>;
  loadConversationIntoRoom: (conv: SavedConversation) => void;
  openFirstBotOrWizard: (excludeBotId?: string) => void;
  enqueueDelete: <T>(task: () => Promise<T>) => Promise<T>;
  onFailure?: () => void;
  fetchImpl?: typeof fetch;
}

/**
 * Deletes a single conversation safely using serialized server `DELETE` and functional state
 * updates, refusing to mutate client state on remote failure or resurrect deleted bots.
 */
export async function executeSingleConversationDelete({
  id,
  isAuthenticated,
  getConversations,
  updateConversations,
  getCurrentRoom,
  updateCurrentRoom,
  abortActiveTurn,
  clearStoredRoomFn,
  markConversationDeleted,
  purgingBotIds,
  deletedBotIds,
  loadConversationIntoRoom,
  openFirstBotOrWizard,
  enqueueDelete,
  onFailure,
  fetchImpl = fetch,
}: SingleConversationDeleteDeps): Promise<boolean> {
  const existsInClient =
    getConversations().some((item) => item.id === id) ||
    getCurrentRoom()?.conversationId === id;
  if (!existsInClient) {
    return true;
  }

  const ok = await enqueueDelete(() =>
    executeDeleteRemoteConversation(id, isAuthenticated, fetchImpl)
  );
  if (!ok) {
    onFailure?.();
    return false;
  }

  markConversationDeleted(id);
  updateConversations((prev) => prev.filter((item) => item.id !== id));
  const remaining = getConversations();

  const activeRoom = getCurrentRoom();
  if (activeRoom?.conversationId === id) {
    abortActiveTurn();
    clearStoredRoomFn();
    const activeBotId = activeRoom.kind === 'solo' ? activeRoom.botId : undefined;
    const isBotBeingRemoved =
      Boolean(activeBotId) &&
      (purgingBotIds.has(activeBotId!) || deletedBotIds.has(activeBotId!));
    const sameBotNext =
      activeBotId && !isBotBeingRemoved
        ? remaining.find((c) => c.kind === 'solo' && c.botId === activeBotId)
        : undefined;
    if (sameBotNext) {
      loadConversationIntoRoom(sameBotNext);
    } else {
      updateCurrentRoom((room) => (room?.conversationId === id ? null : room));
      openFirstBotOrWizard(isBotBeingRemoved ? activeBotId : undefined);
    }
  }
  return true;
}

export function useConversations({
  authUser,
  language,
  currentPlanId,
  personaCap,
  disabledBotIds,
  bots,
  personas,
  setCurrentView,
  setCurrentViewState,
  showToast,
}: {
  authUser: { id: string; email: string } | null;
  language: Language;
  currentPlanId: PlanId;
  personaCap: number;
  disabledBotIds: Set<string>;
  bots: UserBot[];
  personas: AdvisorPersona[];
  setCurrentView: (view: ViewType) => void;
  setCurrentViewState: (view: ViewType) => void;
  showToast?: (key: ToastKey, values?: ToastValues) => void;
}) {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const roomAbortRef = useRef<AbortController | null>(null);

  const conversationsRef = useRef<SavedConversation[]>(conversations);
  const currentRoomRef = useRef<ChatRoom | null>(currentRoom);
  const botsRef = useRef<UserBot[]>(bots);

  useIsomorphicLayoutEffect(() => {
    conversationsRef.current = conversations;
    currentRoomRef.current = currentRoom;
    botsRef.current = bots;
  }, [conversations, currentRoom, bots]);

  const deletedConversationIdsRef = useRef<Set<string>>(new Set());
  const purgingBotIdsRef = useRef<Set<string>>(new Set());
  const deletedBotIdsRef = useRef<Set<string>>(new Set());
  const enqueueDeleteRef = useRef(createSerialQueue());

  useEffect(() => {
    for (const bot of bots) {
      deletedBotIdsRef.current.delete(bot.id);
    }
  }, [bots]);

  const isBlockedRoom = useCallback((candidate: ChatRoom | null): boolean => {
    if (!candidate) return false;
    if (
      candidate.conversationId &&
      deletedConversationIdsRef.current.has(candidate.conversationId)
    ) {
      return true;
    }
    if (
      candidate.kind === 'solo' &&
      candidate.botId &&
      (purgingBotIdsRef.current.has(candidate.botId) ||
        deletedBotIdsRef.current.has(candidate.botId))
    ) {
      return true;
    }
    return false;
  }, []);

  const updateConversations: React.Dispatch<React.SetStateAction<SavedConversation[]>> =
    useCallback((action) => {
      const eagerNext =
        typeof action === 'function' ? action(conversationsRef.current) : action;
      conversationsRef.current = eagerNext;
      setConversations((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        conversationsRef.current = next;
        return next;
      });
    }, []);

  const updateCurrentRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>> =
    useCallback(
      (action) => {
        const eagerCandidate =
          typeof action === 'function' ? action(currentRoomRef.current) : action;
        if (!isBlockedRoom(eagerCandidate)) {
          currentRoomRef.current = eagerCandidate;
        }
        setCurrentRoom((prev) => {
          const next = typeof action === 'function' ? action(prev) : action;
          if (isBlockedRoom(next)) {
            return prev;
          }
          currentRoomRef.current = next;
          return next;
        });
      },
      [isBlockedRoom]
    );

  useIsomorphicLayoutEffect(() => {
    const restored = readStoredRoom(language);
    if (!restored) return;
    updateCurrentRoom({
      conversationId: restored.conversationId,
      kind: restored.kind,
      botId: restored.botId,
      title: restored.title,
      mode: restored.mode === 'panel' ? 'panel' : 'round-robin',
      roster: restored.roster,
      messages: restored.messages,
      pending: restored.pending ?? [],
      turns: restored.turns,
      stoppedBy: (restored.stoppedBy as WhyStop | null) ?? null,
      failures: (restored.failures as TurnFailure[]) ?? [],
      held: restored.held ?? [],
    });
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
      setCurrentViewState('chat-room');
    }
  }, []);

  useEffect(() => {
    if (currentRoom) writeStoredRoom(currentRoom);
  }, [currentRoom]);

  // Load durable solo & group conversations on sign-in.
  useEffect(() => {
    deletedConversationIdsRef.current.clear();
    deletedBotIdsRef.current.clear();
    if (!authUser) return;
    let cancelled = false;
    void fetch('/api/conversations', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { conversations?: SavedConversation[] } | null) => {
        if (cancelled || !body?.conversations) return;
        updateConversations(() =>
          body.conversations!.filter(
            (c) =>
              !deletedConversationIdsRef.current.has(c.id) &&
              !(
                c.kind === 'solo' &&
                c.botId &&
                (purgingBotIdsRef.current.has(c.botId) ||
                  deletedBotIdsRef.current.has(c.botId))
              )
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser, updateConversations]);

  const roomRosterPartition = useMemo(() => {
    if (!currentRoom) return { activeIds: [], disabledIds: [] };
    return partitionRoomRosterByPlan(currentRoom.roster, currentPlanId, disabledBotIds);
  }, [currentRoom, currentPlanId, disabledBotIds]);

  const persistRoomSnapshot = useCallback(
    async (snapshot: ChatRoom) => {
      const convId = snapshot.conversationId;
      if (!authUser || !convId) return;
      if (
        deletedConversationIdsRef.current.has(convId) ||
        (snapshot.kind === 'solo' &&
          snapshot.botId &&
          (purgingBotIdsRef.current.has(snapshot.botId) ||
            deletedBotIdsRef.current.has(snapshot.botId)))
      ) {
        return;
      }
      try {
        const res = await fetch('/api/conversations', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: convId,
            title: snapshot.title,
            mode: snapshot.mode,
            messages: snapshot.messages,
            turns: snapshot.turns,
            stoppedBy: snapshot.stoppedBy,
            failures: snapshot.failures,
            held: snapshot.held,
          }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { conversation?: SavedConversation };
        const saved = body.conversation;
        if (saved) {
          updateConversations((list) => {
            if (
              deletedConversationIdsRef.current.has(saved.id) ||
              (saved.kind === 'solo' &&
                saved.botId &&
                (purgingBotIdsRef.current.has(saved.botId) ||
                  deletedBotIdsRef.current.has(saved.botId))) ||
              !list.some((item) => item.id === saved.id)
            ) {
              return list;
            }
            return [saved, ...list.filter((item) => item.id !== saved.id)].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt)
            );
          });
        }
      } catch {
        // Best-effort remote snapshot; local storage already holds the latest room.
      }
    },
    [authUser, updateConversations]
  );

  const loadConversationIntoRoom = useCallback(
    (conv: SavedConversation) => {
      if (
        deletedConversationIdsRef.current.has(conv.id) ||
        (conv.kind === 'solo' &&
          conv.botId &&
          (purgingBotIdsRef.current.has(conv.botId) ||
            deletedBotIdsRef.current.has(conv.botId)))
      ) {
        return;
      }
      roomAbortRef.current?.abort();
      updateCurrentRoom({
        conversationId: conv.id,
        kind: conv.kind,
        botId: conv.botId,
        title: conv.title,
        mode: conv.mode,
        roster: conv.roster,
        messages: conv.messages,
        pending: [],
        turns: conv.turns,
        stoppedBy: conv.stoppedBy,
        failures: conv.failures,
        held: conv.held,
      });
      setIsJoinRoomOpen(false);
      setEditingGroupId(null);
      setCurrentView('chat-room');
    },
    [setCurrentView, updateCurrentRoom]
  );

  const createSoloThread = async (botId: string, title?: string) => {
    if (purgingBotIdsRef.current.has(botId) || deletedBotIdsRef.current.has(botId)) return;
    const bot = botsRef.current.find((item) => item.id === botId);
    const persona =
      personas.find((item) => item.id === botPersonaId(botId)) ??
      (bot ? botToPersona(bot, 0) : undefined);
    if (!persona) return;
    const threadTitle = title?.trim() || copy[language].soloNewThread;

    if (authUser) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'solo',
            botId,
            title: threadTitle,
            mode: 'round-robin',
            roster: [persona.id],
            messages: [],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { conversation: SavedConversation };
          if (purgingBotIdsRef.current.has(botId) || deletedBotIdsRef.current.has(botId)) {
            deletedConversationIdsRef.current.add(body.conversation.id);
            void enqueueDeleteRef.current(() =>
              executeDeleteRemoteConversation(body.conversation.id, true)
            );
            return;
          }
          updateConversations((prev) => [body.conversation, ...prev]);
          loadConversationIntoRoom(body.conversation);
          return;
        }
      } catch {
        // Fall through to local conversation fallback.
      }
    }

    if (purgingBotIdsRef.current.has(botId) || deletedBotIdsRef.current.has(botId)) return;

    const fallback: SavedConversation = {
      id: `local-solo-${Date.now()}`,
      kind: 'solo',
      botId,
      title: threadTitle,
      mode: 'round-robin',
      roster: [persona.id],
      messages: [],
      turns: 0,
      stoppedBy: null,
      failures: [],
      held: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateConversations((prev) => [fallback, ...prev]);
    loadConversationIntoRoom(fallback);
  };

  const openBotChat = (botId: string, conversationId?: string) => {
    if (purgingBotIdsRef.current.has(botId) || deletedBotIdsRef.current.has(botId)) return;
    const liveConversations = conversationsRef.current;
    if (conversationId) {
      const specific = liveConversations.find(
        (c) =>
          c.id === conversationId &&
          c.kind === 'solo' &&
          !deletedConversationIdsRef.current.has(c.id)
      );
      if (specific) {
        loadConversationIntoRoom(specific);
        return;
      }
    }
    const existing = liveConversations.find(
      (c) =>
        c.kind === 'solo' &&
        c.botId === botId &&
        !deletedConversationIdsRef.current.has(c.id)
    );
    if (existing) {
      loadConversationIntoRoom(existing);
      return;
    }
    const bot = botsRef.current.find((item) => item.id === botId);
    if (!bot) return;
    void createSoloThread(botId, bot.name || copy[language].soloNewThread);
  };

  /** Redirects to the first available bot chat, or falls back to `bot-wizard` when no bots exist. */
  const openFirstBotOrWizard = (excludeBotId?: string) => {
    const firstBot = botsRef.current.find(
      (item) =>
        item.id !== excludeBotId &&
        !purgingBotIdsRef.current.has(item.id) &&
        !deletedBotIdsRef.current.has(item.id)
    );
    if (firstBot) {
      openBotChat(firstBot.id);
      return;
    }
    setCurrentView('bot-wizard');
  };

  const createGroupChat = async (
    roster: AdvisorPersona[],
    mode: ChatMode,
    title?: string
  ): Promise<SavedConversation | null> => {
    const capped = roster.slice(0, personaCap);
    if (capped.length < 2) return null;
    const resolvedTitle =
      title && title.trim()
        ? title.trim()
        : capped.map((p) => p.name).join(' · ').slice(0, 80) || copy[language].chatRoomTitle;

    if (authUser) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'group',
            title: resolvedTitle,
            mode,
            roster: capped.map((p) => p.id),
            messages: [],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { conversation: SavedConversation };
          updateConversations((prev) => [body.conversation, ...prev]);
          loadConversationIntoRoom(body.conversation);
          return body.conversation;
        }
      } catch {
        // Fall through to local group fallback.
      }
    }

    const fallback: SavedConversation = {
      id: `local-group-${Date.now()}`,
      kind: 'group',
      title: resolvedTitle,
      mode,
      roster: capped.map((p) => p.id),
      messages: [],
      turns: 0,
      stoppedBy: null,
      failures: [],
      held: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateConversations((prev) => [fallback, ...prev]);
    loadConversationIntoRoom(fallback);
    return fallback;
  };

  const joinRoom = (roster: AdvisorPersona[], mode: ChatMode, title?: string) => {
    if (roster.length >= 2) {
      void createGroupChat(roster, mode, title);
      return;
    }
    const capped = roster.slice(0, Math.max(1, personaCap));
    if (capped.length === 0) return;
    const rawBotId = capped[0].id.startsWith('bot:') ? capped[0].id.slice(4) : undefined;
    updateCurrentRoom({
      kind: capped.length === 1 ? 'solo' : 'group',
      botId: rawBotId,
      title: title ?? copy[language].chatRoomTitle,
      mode: capped.length === 1 ? 'round-robin' : mode,
      roster: capped.map((persona) => persona.id),
      messages: [],
      pending: [],
      turns: 0,
      stoppedBy: null,
      failures: [],
      held: [],
    });
    setIsJoinRoomOpen(false);
    setCurrentView('chat-room');
  };

  const openGroupChat = (conversationId: string) => {
    const found = conversationsRef.current.find(
      (c) => c.id === conversationId && c.kind === 'group'
    );
    if (found) loadConversationIntoRoom(found);
  };

  const closeRoomModal = () => {
    setEditingGroupId(null);
    setIsJoinRoomOpen(false);
  };

  const updateGroupChat = async (
    id: string,
    patch: { title?: string; mode?: ChatMode; roster?: string[] }
  ): Promise<boolean> => {
    if (patch.roster && patch.roster.length < 2) return false;
    if (authUser && !id.startsWith('local-')) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { conversation: SavedConversation };
        updateConversations((list) =>
          list.map((item) => (item.id === id ? body.conversation : item))
        );
        updateCurrentRoom((room) =>
          room && room.conversationId === id
            ? {
                ...room,
                title: body.conversation.title,
                mode: body.conversation.mode,
                roster: body.conversation.roster,
              }
            : room
        );
        closeRoomModal();
        return true;
      } catch {
        return false;
      }
    }
    updateConversations((list) =>
      list.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(patch.title ? { title: patch.title } : {}),
              ...(patch.mode ? { mode: patch.mode } : {}),
              ...(patch.roster ? { roster: patch.roster } : {}),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    updateCurrentRoom((room) =>
      room && room.conversationId === id
        ? {
            ...room,
            ...(patch.title ? { title: patch.title } : {}),
            ...(patch.mode ? { mode: patch.mode } : {}),
            ...(patch.roster ? { roster: patch.roster } : {}),
          }
        : room
    );
    closeRoomModal();
    return true;
  };

  const renameConversation = async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    await updateGroupChat(id, { title: clean });
  };

  const deleteConversationById = async (id: string) => {
    await executeSingleConversationDelete({
      id,
      isAuthenticated: Boolean(authUser),
      getConversations: () => conversationsRef.current,
      updateConversations,
      getCurrentRoom: () => currentRoomRef.current,
      updateCurrentRoom,
      abortActiveTurn: () => roomAbortRef.current?.abort(),
      clearStoredRoomFn: clearStoredRoom,
      markConversationDeleted: (convId) => {
        deletedConversationIdsRef.current.add(convId);
      },
      purgingBotIds: purgingBotIdsRef.current,
      deletedBotIds: deletedBotIdsRef.current,
      loadConversationIntoRoom,
      openFirstBotOrWizard,
      enqueueDelete: enqueueDeleteRef.current,
      onFailure: () => showToast?.('authGenericError'),
    });
  };

  const purgeBotSoloConversations = async (botId: string) => {
    await executeBotSoloConversationPurge({
      botId,
      isAuthenticated: Boolean(authUser),
      getConversations: () => conversationsRef.current,
      updateConversations,
      getCurrentRoom: () => currentRoomRef.current,
      updateCurrentRoom,
      abortActiveTurn: () => roomAbortRef.current?.abort(),
      clearStoredRoomFn: clearStoredRoom,
      markConversationDeleted: (convId) => {
        deletedConversationIdsRef.current.add(convId);
      },
      purgingBotIds: purgingBotIdsRef.current,
      enqueueDelete: enqueueDeleteRef.current,
    });
  };

  const markBotDeleted = useCallback((botId: string) => {
    deletedBotIdsRef.current.add(botId);
  }, []);

  const stopRoom = () => {
    roomAbortRef.current?.abort();
    updateCurrentRoom((room) => (room ? { ...room, stoppedBy: 'cancelled' } : room));
  };

  const clearRoom = () => {
    const active = currentRoomRef.current;
    if (active?.conversationId) {
      void deleteConversationById(active.conversationId);
      return;
    }
    roomAbortRef.current?.abort();
    clearStoredRoom();
    updateCurrentRoom(null);
    openFirstBotOrWizard();
  };

  return {
    conversations,
    setConversations: updateConversations,
    currentRoom,
    setCurrentRoom: updateCurrentRoom,
    roomAbortRef,
    roomRosterPartition,
    editingGroupId,
    isJoinRoomOpen,
    openEditGroup: (id: string) => {
      setEditingGroupId(id);
      setIsJoinRoomOpen(true);
    },
    closeEditGroup: closeRoomModal,
    openJoinRoom: () => {
      setEditingGroupId(null);
      setIsJoinRoomOpen(true);
    },
    closeJoinRoom: closeRoomModal,
    persistRoomSnapshot,
    createSoloThread,
    openBotChat,
    openFirstBotOrWizard,
    createGroupChat,
    joinRoom,
    openGroupChat,
    updateGroupChat,
    renameConversation,
    deleteConversationById,
    purgeBotSoloConversations,
    markBotDeleted,
    stopRoom,
    clearRoom,
  };
}
