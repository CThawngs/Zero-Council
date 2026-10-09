import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvisorPersona,
  ApiKeyConfig,
  DeliberationSession,
  Language,
  ModelProvider,
  ViewType,
  frameworkIdOf,
} from '../types';
import {
  DeliberationCancelled,
  runDeliberation,
  type CommunicationMode,
  type Round,
} from '@/lib/deliberation/engine';
import { initialApiKeys, initialPersonas, initialSessions, localizePersona } from '../data/mockData';
import { copy, modeLabel, translations, type Copy } from '../i18n';
import {
  DEFAULT_MAX_TURNS,
  DEFAULT_ROOM_BUDGET,
  DEFAULT_TURN_TIMEOUT_MS,
  RESUME_ALL,
  USER_HANDLE,
  isResumeDirective,
  isStopDirective,
  parseMentions,
  runTurn,
  type ChatAttachment,
  type ChatBot,
  type ChatMessage,
  type ChatMode,
  type TurnFailure,
  type WhyStop,
} from '../chat/engine';
import { byokGenerator } from '../chat/byok';
import { UnreadableLinkError, readLinkInBrowser } from '../chat/read-link-web';
import { clearStoredRoom, readStoredRoom, writeStoredRoom } from '../chat/storage';
import { scriptedGenerator } from '../chat/scripted';
import { planById, type PlanId } from '../data/plans';

/** One live room. Deliberately not a `DeliberationSession`: that shape has no message list. */
export interface ChatRoom {
  title: string;
  mode: ChatMode;
  /** Advisor ids in join order — the order the roster speaks in. */
  roster: string[];
  messages: ChatMessage[];
  /** Pinned to the next message but not sent. Sending moves them onto that message. */
  pending: ChatAttachment[];
  /** Bot turns taken by the last user message, and why the loop parked. */
  turns: number;
  stoppedBy: WhyStop | null;
  /** Why a generator produced nothing, when something went wrong rather than merely ended. */
  failures: TurnFailure[];
  /** Advisors held by a `stop @bot` directive; they are skipped until `@all` or a room clear. */
  held: string[];
}

type ToastKey = keyof (typeof copy)['en'];
type ToastValues = Record<string, string>;
type ToastMessage = { key: ToastKey; values?: ToastValues };

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  t: (typeof copy)[Language];
  sessions: DeliberationSession[];
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  currentSession: DeliberationSession;
  startNewSession: (question?: string, framework?: DeliberationSession['framework']) => void;
  setCurrentFramework: (framework: DeliberationSession['framework']) => void;
  setCurrentMode: (mode: CommunicationMode) => void;
  runRound: (prompt: string) => Promise<void>;
  cancelRound: () => void;
  isDeliberating: boolean;
  selectedRoundIndex: number;
  selectRound: (index: number) => void;
  purgeSessions: () => void;
  personas: AdvisorPersona[];
  addPersona: (persona: AdvisorPersona) => void;
  apiKeys: ApiKeyConfig[];
  connectApiKey: (provider: ModelProvider, key: string) => void;
  removeApiKey: (provider: ModelProvider) => void;
  revokeAllKeys: () => void;
  isFrameworkModalOpen: boolean;
  openFrameworkModal: () => void;
  closeFrameworkModal: () => void;
  isCounterDraftModalOpen: boolean;
  openCounterDraftModal: () => void;
  closeCounterDraftModal: () => void;
  currentPlanId: PlanId;
  isJoinRoomOpen: boolean;
  openJoinRoom: () => void;
  closeJoinRoom: () => void;
  joinRoom: (roster: AdvisorPersona[], mode: ChatMode) => void;
  currentRoom: ChatRoom | null;
  sendMessage: (body: string) => Promise<void>;
  stopRoom: () => void;
  clearRoom: () => void;
  /** True while the room is working, so the UI can offer Stop instead of a second send. */
  isRoomBusy: boolean;
  /** Reads a link NOW and pins the text to the next message. Never called mid-round. */
  attachLink: (url: string) => Promise<void>;
  removePending: (id: string) => void;
  isReadingLink: boolean;
  canAddPersona: boolean;
  personaCap: number;
  toastMessage: ToastMessage | null;
  showToast: (key: ToastKey, values?: ToastValues) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const nextSessionId = () => `session-${crypto.randomUUID()}`;

const scenarioFixture = (t: Copy) => ({
  good: { title: t.favorableTitle, subtitle: t.illustrativeOnly, description: t.favorableDescription, actions: [t.favorableActionOne, t.favorableActionTwo] },
  normal: { title: t.baselineTitle, subtitle: t.illustrativeOnly, description: t.baselineDescription, actions: [t.baselineActionOne, t.baselineActionTwo] },
  bad: { title: t.difficultTitle, subtitle: t.illustrativeOnly, description: t.difficultDescription, actions: [t.difficultActionOne, t.difficultActionTwo] },
});

const stancesOf = (personas: AdvisorPersona[]) =>
  personas.reduce<Record<string, string>>((map, persona) => {
    map[persona.id] = persona.stance;
    return map;
  }, {});

const toChatBots = (roster: AdvisorPersona[]): ChatBot[] =>
  roster.map((persona) => ({ id: persona.id, name: persona.name }));

const createSession = async (
  question: string,
  framework: DeliberationSession['framework'],
  mode: CommunicationMode,
  personas: AdvisorPersona[],
  language: Language
): Promise<DeliberationSession> => {
  const t = copy[language];
  const round = await runDeliberation({
    mode,
    framework: frameworkIdOf(framework),
    prompt: question,
    language,
    advisorIds: personas.map((persona) => persona.id),
    advisorStances: stancesOf(personas),
    roundIndex: 1,
  });
  return {
    id: nextSessionId(),
    title: question,
    summary: t.sampleSessionSummary,
    framework,
    mode,
    timestamp: new Date().toISOString(),
    relativeTime: t.sampleNow,
    status: 'Deliberating',
    advisors: personas,
    rounds: [round],
    scenarios: scenarioFixture(t),
  };
};

const localizeSession = (session: DeliberationSession, language: Language): DeliberationSession => {
  const t = copy[language];
  const localizedTitles: Record<string, string> = {
    'project-proposal': t.initialProjectTitle,
    'team-priority': t.initialTeamTitle,
    'process-change': t.initialProcessTitle,
  };
  const localizedAdvisors = session.advisors.map((persona) => localizePersona(persona, language));
  // Rounds are historical content, not chrome. They keep the language they were
  // produced in — a real engine would answer in whatever language it was asked
  // in, and replaying the transcript must not rewrite history. The UI flags a
  // round whose language differs from the interface.
  return {
    ...session,
    title: localizedTitles[session.id] ?? session.title,
    summary: t.sampleSessionSummary,
    relativeTime: t.sample,
    advisors: localizedAdvisors,
    scenarios: scenarioFixture(t),
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read once. The room and the view have to be decided from the SAME read, or a reload drops the
  // user on the marketing page with a live deliberation sitting unread behind it — which is worse
  // than losing the room, because nothing looks broken.
  const [restored] = useState(() => readStoredRoom());

  const [currentView, setCurrentView] = useState<ViewType>(restored ? 'chat-room' : 'overview');
  const [language, setLanguage] = useState<Language>('en');
  const [sessions, setSessions] = useState<DeliberationSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessions[0].id);
  const [personas, setPersonas] = useState<AdvisorPersona[]>(initialPersonas);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(initialApiKeys);
  const [isFrameworkModalOpen, setIsFrameworkModalOpen] = useState(false);
  const [isCounterDraftModalOpen, setIsCounterDraftModalOpen] = useState(false);
const [isDeliberating, setIsDeliberating] = useState(false);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [currentMode, setCurrentModeState] = useState<CommunicationMode>('independent');
  const abortRef = useRef<AbortController | null>(null);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(() => {
    // Rehydrate on the first render so the room is already there when the view mounts. Without this
    // the user sees an empty chamber flash before the transcript appears, which reads as data loss.
    if (!restored) return null;
    return {
      title: restored.title,
      mode: restored.mode === 'panel' ? 'panel' : 'round-robin',
      roster: restored.roster,
      messages: restored.messages,
      pending: restored.pending ?? [],
      turns: restored.turns,
      stoppedBy: (restored.stoppedBy as WhyStop | null) ?? null,
      failures: (restored.failures as TurnFailure[]) ?? [],
      held: restored.held ?? [],
    };
  });
  const [isRoomBusy, setIsRoomBusy] = useState(false);
  const [isReadingLink, setIsReadingLink] = useState(false);
  /** The one controller for the round in flight; `stopRoom` aborts it. Null when the room is idle. */
  const roomAbortRef = useRef<AbortController | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Plan the account is on. Hardcoded to Free until entitlements land — `effectivePlan` in
   * lib/store/account.ts is the real answer, and it needs auth to exist.
   * ponytail: a constant until auth ships; swap for effectivePlan(currentUser.email).
   */
  const currentPlanId: PlanId = 'free';
  const personaCap = planById(currentPlanId).maxActiveAdvisors;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = copy[language].documentTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy[language].documentDescription);
  }, [language]);

  // Mirror every room change into the tab store. This is the only writer; nothing else touches it.
  useEffect(() => {
    if (currentRoom) writeStoredRoom(currentRoom);
  }, [currentRoom]);

  const localizedSessions = useMemo(
    () => sessions.map((session) => localizeSession(session, language)),
    [language, sessions]
  );

  const localizedPersonas = useMemo(
    () => personas.map((persona) => localizePersona(persona, language)),
    [language, personas]
  );

  const showToast = (key: ToastKey, values?: ToastValues) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage({ key, values });
    toastTimer.current = setTimeout(() => setToastMessage(null), 2500);
  };

  const localizedTitles: Record<string, string> = {
    'project-proposal': copy[language].initialProjectTitle,
    'team-priority': copy[language].initialTeamTitle,
    'process-change': copy[language].initialProcessTitle,
  };

  const startNewSession = (
    question: string = copy[language].initialProjectTitle,
    framework: DeliberationSession['framework'] = 'Good / Normal / Bad Scenarios'
  ) => {
    const normalizedQuestion = question.trim().toLowerCase();
    const existing = sessions.find((session) => {
      const originalTitle = localizedTitles[session.id] ?? session.title;
      return originalTitle.toLowerCase() === normalizedQuestion;
    });
    if (existing) {
      setCurrentSessionId(existing.id);
      setSelectedRoundIndex(existing.rounds.length);
      setCurrentView('session-active');
      return;
    }
    void (async () => {
      setIsDeliberating(true);
      try {
        const session = await createSession(
          question.trim(),
          framework,
          currentMode,
          localizedPersonas,
          language
        );
        setSessions((value) => [session, ...value]);
        setCurrentSessionId(session.id);
        setSelectedRoundIndex(1);
        setCurrentView('session-active');
      } finally {
        setIsDeliberating(false);
      }
    })();
  };

  const setCurrentFramework = (framework: DeliberationSession['framework']) => {
    setSessions((value) =>
      value.map((session) =>
        session.id === currentSessionId ? { ...session, framework } : session
      )
    );
  };

  const setCurrentMode = (mode: CommunicationMode) => {
    setCurrentModeState(mode);
    setSessions((value) =>
      value.map((session) => (session.id === currentSessionId ? { ...session, mode } : session))
    );
    showToast('toastModeChanged', { mode: modeLabel(mode, language) });
  };

  const cancelRound = () => {
    abortRef.current?.abort();
  };

  const runRound = async (prompt: string) => {
    const question = prompt.trim();
    if (!question || isDeliberating) return;
    const session = sessions.find((item) => item.id === currentSessionId);
    if (!session) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsDeliberating(true);
    try {
      const round: Round = await runDeliberation({
        mode: session.mode,
        framework: frameworkIdOf(session.framework),
        prompt: question,
        language,
        advisorIds: session.advisors.map((persona) => persona.id),
        advisorStances: stancesOf(session.advisors),
        roundIndex: session.rounds.length + 1,
        signal: controller.signal,
      });
      setSessions((value) =>
        value.map((item) =>
          item.id === currentSessionId ? { ...item, rounds: [...item.rounds, round] } : item
        )
      );
      setSelectedRoundIndex(round.index);
      showToast('toastRoundAdded', { round: String(round.index) });
    } catch (error) {
      if (error instanceof DeliberationCancelled) showToast('toastRoundCancelled');
      else throw error;
    } finally {
      abortRef.current = null;
      setIsDeliberating(false);
    }
  };

  const selectRound = (index: number) => setSelectedRoundIndex(index);

  const purgeSessions = () => {
    setSessions([]);
    showToast('toastSessionsReset');
  };

  const addPersona = (persona: AdvisorPersona) => {
    // Step 4: the plan cap is a cap, not a label. Checked here so no other caller can route around it.
    if (personas.length >= personaCap) {
      showToast('toastPersonaCap', { cap: String(personaCap) });
      return;
    }
    setPersonas((value) => [persona, ...value]);
    showToast('toastPersona', { name: persona.archetype });
    setCurrentView('personas');
  };

  const joinRoom = (roster: AdvisorPersona[], mode: ChatMode) => {
    const capped = roster.slice(0, personaCap);
    setCurrentRoom({
      title: copy[language].chatRoomTitle,
      mode,
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

  /**
   * Stop means stop. Before the deadline landed this only rewrote a label, so the council kept
   * answering a turn the user had walked away from and any provider call kept billing — the button
   * looked like it worked and nothing had stopped. The abort kills the request in flight; the
   * engine additionally refuses to commit an answer that arrives anyway.
   */
  const stopRoom = () => {
    roomAbortRef.current?.abort();
    setCurrentRoom((room) => (room ? { ...room, stoppedBy: 'cancelled' } : room));
  };

  const clearRoom = () => {
    // Clearing the store too is the point: if it survived, the room the user just discarded would
    // come back on reload and look like the delete button had not worked.
    roomAbortRef.current?.abort();
    clearStoredRoom();
    setCurrentRoom(null);
    setCurrentView('empty-chamber');
  };

  /**
   * Reads the link once, here, and pins its text to the next message.
   *
   * Not during a round: a fetch that hangs mid-round would look exactly like a provider hang, and
   * the room would report the wrong thing. A link that cannot be read is still pinned, carrying the
   * reason — a silently missing attachment reads as "the app ignored what I sent", and the council
   * would answer from the human's words alone without ever saying so.
   */
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
      const reading = await readLinkInBrowser(href);
      attachment.text = reading.text;
    } catch (error) {
      attachment.problem = error instanceof UnreadableLinkError ? error.reason : String(error);
    } finally {
      setIsReadingLink(false);
      setCurrentRoom((room) =>
        room ? { ...room, pending: [...room.pending, attachment] } : room
      );
    }
  };

  const removePending = (id: string) => {
    setCurrentRoom((room) =>
      room ? { ...room, pending: room.pending.filter((item) => item.id !== id) } : room
    );
  };

  const sendMessage = async (body: string) => {
    if (!currentRoom) return;
    const roster = currentRoom.roster
      .map((id) => localizedPersonas.find((persona) => persona.id === id))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    const rosterBots = toChatBots(roster);

    // Directives are matched against the FULL roster, so an advisor can be released and held again
    // by name even while they are currently out of the room.
    const resume = isResumeDirective(body, rosterBots);
    const stopping = isStopDirective(body, rosterBots);
    const held = resume
      ? []
      : stopping
        ? [...new Set([...currentRoom.held, ...parseMentions(body, rosterBots).filter((id) => id !== USER_HANDLE && id !== RESUME_ALL)])]
        : currentRoom.held;

    // An advisor named by `stop @bot` is held FROM this turn, so they never answer the message that
    // silences them; `@all` clears the held set and calls every one of them back.
    const active = resume ? roster : roster.filter((persona) => !held.includes(persona.id));
    const activeBots = toChatBots(active);

    const userMessage: ChatMessage = {
      id: `${currentRoom.messages.length}`,
      authorId: USER_HANDLE,
      body,
      mentioned: parseMentions(body, activeBots),
      // Pinned attachments travel WITH this message. Reading them in the engine would mean one
      // fetch per advisor per turn; the text was already read when they were pinned.
      ...(currentRoom.pending.length > 0 ? { attachments: currentRoom.pending } : {}),
    };

    const parked: ChatRoom = {
      ...currentRoom,
      messages: [...currentRoom.messages, userMessage],
      pending: [],
      held,
    };
    setCurrentRoom(parked);
    setIsRoomBusy(true);

    // `stop @bot` is a control message, not a prompt, so it must not run a round: the @ would read as a
    // request for that advisor's answer, and because they are now held it resolved to nobody and the
    // room reported "nobody answered" — a lie about what happened. `@all` DOES run a round: the user
    // is telling the council to carry on, so silence would be its own failure.
    if (stopping) {
      setIsRoomBusy(false);
      return;
    }

    const controller = new AbortController();
    roomAbortRef.current = controller;

    try {
      const result = await runTurn({
      roster: activeBots,
      mode: currentRoom.mode,
      // WITHOUT this turn's user message — runTurn appends it. Passing `parked.messages` here
      // duplicated every user message in the transcript.
      history: currentRoom.messages,
      userMessage,
      // Each advisor answers through its own vendor, so the room is a mix: one key per provider, and any
      // advisor whose vendor has no key falls back to the scripted reply instead of failing the round.
      // The engine cannot see this choice — it only ever sees `BotTurn`, which is the whole point of
      // the generator seam.
      generate: (request) => {
        const persona = active.find((p) => p.id === request.bot.id);
        const provider = persona?.provider;
        const key = provider ? keys[provider] : undefined;
        if (!provider || !key || !persona) {
          return scriptedGenerator(activeBots, { lensOf: (bot) => active.find((p) => p.id === bot.id)?.stance ?? '' })(request);
        }
        return byokGenerator(
          { provider, model: persona.model, apiKey: key },
          { personaOf: (bot) => active.find((p) => p.id === bot.id)?.instructions }
        )(request);
      },
      maxTurns: DEFAULT_MAX_TURNS,
      roomBudget: DEFAULT_ROOM_BUDGET,
      turnsUsed: currentRoom.turns,
      language,
      roundIndex: parked.messages.filter((message) => message.authorId === USER_HANDLE).length,
      signal: controller.signal,
      turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS,
      // Each advisor appears the moment it answers instead of the room staying blank until the
      // whole round ends. The state update is functional because a stalled round can otherwise
      // overwrite an appended message with the transcript it started from.
      onTurn: (message) => {
        setCurrentRoom((room) =>
          room ? { ...room, messages: [...room.messages, message] } : room
        );
      },
    });

      setCurrentRoom((room) =>
        room
          ? {
              ...room,
              messages: result.messages,
              turns: currentRoom.turns + result.speakers.length,
              stoppedBy: result.stoppedBy,
              failures: result.failures,
            }
          : room
      );
    } finally {
      roomAbortRef.current = null;
      setIsRoomBusy(false);
    }
  };

  // Keys live in memory for the life of the tab and nowhere else: not in storage, not on our server.
  // Reloading clears them, which is the trade for never handing a key to anyone but the vendor.
  const [keys, setKeys] = useState<Partial<Record<ModelProvider, string>>>({});

  const connectApiKey = (provider: ModelProvider, key: string) => {
    setKeys((value) => ({ ...value, [provider]: key }));
    setApiKeys((value) =>
      value.map((item) => (item.provider === provider ? { ...item, connected: true } : item))
    );
    showToast('toastProviderOn', { provider });
  };

  const removeApiKey = (provider: ModelProvider) => {
    setKeys((value) => {
      const next = { ...value };
      delete next[provider];
      return next;
    });
    setApiKeys((value) =>
      value.map((item) => (item.provider === provider ? { ...item, connected: false } : item))
    );
    showToast('toastProviderOff', { provider });
  };

  const revokeAllKeys = () => {
    setKeys({});
    setApiKeys((value) => value.map((item) => ({ ...item, connected: false })));
    showToast('toastProvidersCleared');
  };

  const currentSession =
    localizedSessions.find((session) => session.id === currentSessionId) ||
    localizedSessions[0] ||
    localizeSession(initialSessions[0], language);

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        language,
        setLanguage,
        t: copy[language],
        sessions: localizedSessions,
        currentSessionId,
        setCurrentSessionId,
        currentSession,
        startNewSession,
        setCurrentFramework,
        setCurrentMode,
        runRound,
        cancelRound,
        isDeliberating,
        selectedRoundIndex,
        selectRound,
        purgeSessions,
        personas: localizedPersonas,
        addPersona,
        apiKeys,
        connectApiKey,
        removeApiKey,
        revokeAllKeys,
        isFrameworkModalOpen,
        openFrameworkModal: () => setIsFrameworkModalOpen(true),
        closeFrameworkModal: () => setIsFrameworkModalOpen(false),
        isCounterDraftModalOpen,
        openCounterDraftModal: () => setIsCounterDraftModalOpen(true),
        closeCounterDraftModal: () => setIsCounterDraftModalOpen(false),
        currentPlanId,
        personaCap,
        canAddPersona: personas.length < personaCap,
        isJoinRoomOpen,
        openJoinRoom: () => setIsJoinRoomOpen(true),
        closeJoinRoom: () => setIsJoinRoomOpen(false),
        joinRoom,
        currentRoom,
        sendMessage,
        stopRoom,
        clearRoom,
        isRoomBusy,
        attachLink,
        removePending,
        isReadingLink,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const nav = translations;
