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
import type { ChatRoom } from './types';

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
}) {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const roomAbortRef = useRef<AbortController | null>(null);

  useIsomorphicLayoutEffect(() => {
    const restored = readStoredRoom(language);
    if (!restored) return;
    setCurrentRoom({
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
    if (!authUser) return;
    let cancelled = false;
    void fetch('/api/conversations', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { conversations?: SavedConversation[] } | null) => {
        if (cancelled || !body?.conversations) return;
        setConversations(body.conversations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const roomRosterPartition = useMemo(() => {
    if (!currentRoom) return { activeIds: [], disabledIds: [] };
    return partitionRoomRosterByPlan(currentRoom.roster, currentPlanId, disabledBotIds);
  }, [currentRoom, currentPlanId, disabledBotIds]);

  const persistRoomSnapshot = useCallback(
    async (snapshot: ChatRoom) => {
      if (!authUser || !snapshot.conversationId) return;
      try {
        const res = await fetch('/api/conversations', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: snapshot.conversationId,
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
        if (body.conversation) {
          setConversations((list) =>
            [body.conversation!, ...list.filter((item) => item.id !== body.conversation!.id)].sort(
              (a, b) => b.updatedAt.localeCompare(a.updatedAt)
            )
          );
        }
      } catch {
        // Best-effort remote snapshot; local storage already holds the latest room.
      }
    },
    [authUser]
  );

  const loadConversationIntoRoom = useCallback(
    (conv: SavedConversation) => {
      roomAbortRef.current?.abort();
      setCurrentRoom({
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
    [setCurrentView]
  );

  const createSoloThread = async (botId: string, title?: string) => {
    const bot = bots.find((item) => item.id === botId);
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
          setConversations((prev) => [body.conversation, ...prev]);
          loadConversationIntoRoom(body.conversation);
          return;
        }
      } catch {
        // Fall through to local conversation fallback.
      }
    }

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
    setConversations((prev) => [fallback, ...prev]);
    loadConversationIntoRoom(fallback);
  };

  const openBotChat = (botId: string, conversationId?: string) => {
    if (conversationId) {
      const specific = conversations.find((c) => c.id === conversationId && c.kind === 'solo');
      if (specific) {
        loadConversationIntoRoom(specific);
        return;
      }
    }
    const existing = conversations.find((c) => c.kind === 'solo' && c.botId === botId);
    if (existing) {
      loadConversationIntoRoom(existing);
      return;
    }
    const bot = bots.find((item) => item.id === botId);
    void createSoloThread(botId, bot?.name ?? copy[language].soloNewThread);
  };

  /** Redirects to the first available bot chat, or falls back to `bot-wizard` when no bots exist. */
  const openFirstBotOrWizard = (excludeBotId?: string) => {
    const firstBot = bots.find((item) => item.id !== excludeBotId);
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
          setConversations((prev) => [body.conversation, ...prev]);
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
    setConversations((prev) => [fallback, ...prev]);
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
    setCurrentRoom({
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
    const found = conversations.find((c) => c.id === conversationId && c.kind === 'group');
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
        setConversations((list) =>
          list.map((item) => (item.id === id ? body.conversation : item))
        );
        setCurrentRoom((room) =>
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
    setConversations((list) =>
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
    setCurrentRoom((room) =>
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
    if (authUser && !id.startsWith('local-')) {
      await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      }).catch(() => undefined);
    }
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    if (currentRoom?.conversationId === id) {
      roomAbortRef.current?.abort();
      clearStoredRoom();
      const sameBotNext =
        currentRoom.kind === 'solo' && currentRoom.botId
          ? remaining.find((c) => c.kind === 'solo' && c.botId === currentRoom.botId)
          : undefined;
      if (sameBotNext) {
        loadConversationIntoRoom(sameBotNext);
      } else {
        setCurrentRoom(null);
        openFirstBotOrWizard();
      }
    }
  };

  const stopRoom = () => {
    roomAbortRef.current?.abort();
    setCurrentRoom((room) => (room ? { ...room, stoppedBy: 'cancelled' } : room));
  };

  const clearRoom = () => {
    if (currentRoom?.conversationId) {
      void deleteConversationById(currentRoom.conversationId);
      return;
    }
    roomAbortRef.current?.abort();
    clearStoredRoom();
    setCurrentRoom(null);
    openFirstBotOrWizard();
  };

  return {
    conversations,
    setConversations,
    currentRoom,
    setCurrentRoom,
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
    stopRoom,
    clearRoom,
  };
}
