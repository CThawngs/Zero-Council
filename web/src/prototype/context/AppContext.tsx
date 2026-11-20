'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AdvisorPersona,
  ApiKeyConfig,
  ConversationKind,
  DeliberationSession,
  Language,
  ModelProvider,
  SavedConversation,
  UserBot,
  ViewType,
  frameworkIdOf,
  legalDocumentOf,
} from '../types';
import {
  DeliberationCancelled,
  runDeliberation,
  type CommunicationMode,
  type GenerateFn,
  type Round,
} from '@/lib/deliberation/engine';
import {
  initialApiKeys,
  initialPersonas,
  initialSessions,
  localizePersona,
} from '../data/mockData';
import { deleteSessionFromList, renameSessionInList } from '../sessions-crud';
import { copy, modeLabel, translations, type Copy } from '../i18n';
import { applyTheme, resolveInitialTheme, THEME_STORAGE_KEY, type Theme } from '../theme';
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
  type ChatAttachment,
  type ChatBot,
  type ChatMessage,
  type ChatMode,
  type TurnFailure,
  type WhyStop,
} from '../chat/engine';
import { byokGenerator, completeByokText } from '../chat/byok';
import { analyzeChatRoomConclusion, matchPersonaId } from '../chat/conclusion';
import { UnreadableLinkError, readLinkInBrowser } from '../chat/read-link-web';
import { UnreadableFileError, readFileInBrowser } from '../chat/read-file-web';
import { MAX_IMAGES_PER_MESSAGE, isImageFile, readImageInBrowser } from '../chat/read-image-web';
import { isVideoFile, readVideoInBrowser } from '../chat/read-video-web';
import { clearStoredRoom, readStoredRoom, writeStoredRoom } from '../chat/storage';
import { scriptedGenerator } from '../chat/scripted';
import { planById, type Plan, type PlanId } from '../data/plans';
import { disabledBotIdsForPlan, partitionRoomRosterByPlan } from '@/lib/store/planLimits';
import { createClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import {
  getServerAnalyticsConsent,
  readAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsent,
} from '../components/CookieNotice';

export interface ChatRoom {
  conversationId?: string;
  kind?: ConversationKind;
  botId?: string;
  title: string;
  mode: ChatMode;
  roster: string[];
  messages: ChatMessage[];
  pending: ChatAttachment[];
  turns: number;
  stoppedBy: WhyStop | null;
  failures: TurnFailure[];
  held: string[];
}

export interface ConnectProviderMeta {
  models?: string[];
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
  isCustom?: boolean;
}

type ToastKey = {
  [K in keyof (typeof copy)['en']]: (typeof copy)['en'][K] extends string ? K : never;
}[keyof (typeof copy)['en']];
type ToastValues = Record<string, string>;
type ToastMessage = { key: ToastKey; values?: ToastValues };

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  theme: Theme;
  toggleTheme: () => void;
  t: (typeof copy)[Language];
  sessions: DeliberationSession[];
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  currentSession: DeliberationSession;
  startNewSession: (
    question?: string,
    framework?: DeliberationSession['framework'],
    advisors?: AdvisorPersona[],
    landOn?: ViewType
  ) => void;
  setCurrentFramework: (framework: DeliberationSession['framework']) => void;
  setCurrentMode: (mode: CommunicationMode) => void;
  runRound: (prompt: string) => Promise<void>;
  cancelRound: () => void;
  isDeliberating: boolean;
  selectedRoundIndex: number;
  selectRound: (index: number) => void;
  purgeSessions: () => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  personas: AdvisorPersona[];
  addPersona: (persona: AdvisorPersona) => void;
  bots: UserBot[];
  botsReady: boolean;
  botCap: number;
  canCreateBot: boolean;
  disabledBotIds: Set<string>;
  isBotDisabled: (botId: string) => boolean;
  createBot: (input: {
    name: string;
    instruction: string;
    provider: ModelProvider;
    model: string;
  }) => Promise<UserBot | null>;
  updateBot: (
    id: string,
    input: { name: string; instruction: string; provider: ModelProvider; model: string }
  ) => Promise<UserBot | null>;
  deleteBot: (id: string) => Promise<void>;
  openBotChat: (botId: string, conversationId?: string) => void;
  createSoloThread: (botId: string, title?: string) => Promise<void>;
  conversations: SavedConversation[];
  createGroupChat: (
    roster: AdvisorPersona[],
    mode: ChatMode,
    title?: string
  ) => Promise<SavedConversation | null>;
  openGroupChat: (conversationId: string) => void;
  updateGroupChat: (
    id: string,
    patch: { title?: string; mode?: ChatMode; roster?: string[] }
  ) => Promise<boolean>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversationById: (id: string) => Promise<void>;
  editingGroupId: string | null;
  openEditGroup: (id: string) => void;
  closeEditGroup: () => void;
  apiKeys: ApiKeyConfig[];
  connectApiKey: (
    provider: ModelProvider,
    key: string,
    model: string,
    meta?: ConnectProviderMeta
  ) => Promise<boolean>;
  updateProviderModels: (
    provider: ModelProvider,
    model: string,
    models: string[]
  ) => Promise<boolean>;
  getProviderSecret: (provider: ModelProvider) => string | undefined;
  removeApiKey: (provider: ModelProvider) => Promise<void>;
  revokeAllKeys: () => Promise<void>;
  isFrameworkModalOpen: boolean;
  openFrameworkModal: () => void;
  closeFrameworkModal: () => void;
  currentPlanId: PlanId;
  planExpiresAt: string | null;
  authUser: { id: string; email: string } | null;
  isAdmin: boolean;
  isFounder: boolean;
  authReady: boolean;
  signOut: () => Promise<void>;
  checkoutPlan: Plan | null;
  consent: AnalyticsConsent | null;
  closeCheckout: () => void;
  requestCheckout: (plan: Plan) => void;
  refreshPlan: () => Promise<void>;
  cancelPlanToFree: () => Promise<boolean>;
  downgradeToPro: () => Promise<boolean>;
  goToPricing: () => void;
  isJoinRoomOpen: boolean;
  openJoinRoom: () => void;
  closeJoinRoom: () => void;
  joinRoom: (roster: AdvisorPersona[], mode: ChatMode, title?: string) => void;
  startCouncilChat: (question: string, advisors?: AdvisorPersona[], mode?: ChatMode) => void;
  wrapUpRoom: () => void;
  openRoomConclusion: () => void;
  currentRoom: ChatRoom | null;
  roomRosterPartition: { activeIds: string[]; disabledIds: string[] };
  sendMessage: (body: string) => Promise<void>;
  stopRoom: () => void;
  clearRoom: () => void;
  isRoomBusy: boolean;
  attachLink: (url: string) => Promise<void>;
  attachFiles: (files: File[]) => Promise<void>;
  removePending: (id: string) => void;
  isReadingLink: boolean;
  isReadingFile: boolean;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  isSearchingWeb: boolean;
  canAddPersona: boolean;
  personaCap: number;
  toastMessage: ToastMessage | null;
  showToast: (key: ToastKey, values?: ToastValues) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const nextSessionId = (() => {
  let seq = 0;
  return () => {
    seq += 1;
    return `session-${seq}`;
  };
})();

const scenarioFixture = (t: Copy) => ({
  good: {
    title: t.favorableTitle,
    subtitle: t.illustrativeOnly,
    description: t.favorableDescription,
    actions: [t.favorableActionOne, t.favorableActionTwo],
  },
  normal: {
    title: t.baselineTitle,
    subtitle: t.illustrativeOnly,
    description: t.baselineDescription,
    actions: [t.baselineActionOne, t.baselineActionTwo],
  },
  bad: {
    title: t.difficultTitle,
    subtitle: t.illustrativeOnly,
    description: t.difficultDescription,
    actions: [t.difficultActionOne, t.difficultActionTwo],
  },
});

const stancesOf = (personas: AdvisorPersona[]) =>
  personas.reduce<Record<string, string>>((map, persona) => {
    map[persona.id] = persona.stance;
    return map;
  }, {});

const toChatBots = (roster: AdvisorPersona[]): ChatBot[] =>
  roster.map((persona) => ({ id: persona.id, name: persona.name }));

export const botPersonaId = (botId: string) => `bot:${botId}`;

const BOT_COLORS: { token: AdvisorPersona['colorToken']; hex: string }[] = [
  { token: 'persona-sage', hex: '#7C9885' },
  { token: 'persona-rose', hex: '#B98389' },
  { token: 'persona-slate', hex: '#6E85A6' },
  { token: 'persona-ochre', hex: '#C2955E' },
];

const botToPersona = (bot: UserBot, index = 0): AdvisorPersona => {
  const palette = BOT_COLORS[index % BOT_COLORS.length];
  return {
    id: botPersonaId(bot.id),
    name: bot.name,
    archetype: bot.name,
    model: bot.model,
    provider: bot.provider,
    colorToken: palette.token,
    colorHex: palette.hex,
    stance: bot.instruction.slice(0, 96),
    instructions: bot.instruction,
    sampleQuote: '',
  };
};


/**
 * Build a `GenerateFn` for deliberation using the user's currently connected BYOK keys.
 *
 * Key selection order:
 *   1. The key for the advisor's own provider (persona.provider), if connected.
 *   2. Any other connected key as fallback, so advisors without a matching
 *      provider still get a real AI response (not fixture) when at least one key exists.
 *
 * Returns `undefined` when no keys are connected — the engine then falls back
 * to fixture (canned) text, which is the same behaviour as before BYOK.
 *
 * Security: keys live only in the in-memory `keys` map (populated from the server
 * on sign-in) and are never stored to localStorage or the DOM.
 */
const buildGenerate = (
  personas: AdvisorPersona[],
  keys: Record<string, string>,
  apiKeys: ApiKeyConfig[]
): GenerateFn | undefined => {
  // Pick the first connected key — used as fallback for any advisor whose
  // own provider key isn't connected.
  const fallbackEntry = apiKeys.find((item) => item.connected && Boolean(keys[item.provider]));
  if (!fallbackEntry) return undefined; // No keys connected — use fixture.

  return async (advisorId, stance, prompt, signal) => {
    const persona = personas.find((p) => p.id === advisorId);

    // Resolve which provider + key to use for this advisor.
    let keyMeta = apiKeys.find((item) => item.provider === persona?.provider && item.connected && Boolean(keys[item.provider]));
    if (!keyMeta) keyMeta = fallbackEntry; // Fallback to any connected key.

    const resolvedKey = keys[keyMeta.provider];
    const resolvedModel = keyMeta.modelName;

    return completeByokText(
      {
        provider: keyMeta.provider,
        model: resolvedModel,
        apiKey: resolvedKey,
        protocol: keyMeta.protocol,
        baseUrl: keyMeta.baseUrl,
      },
      {
        system: stance
          ? `You are an advisor with the following perspective: ${stance}. Be concise and insightful.`
          : 'You are a helpful advisor. Be concise and insightful.',
        prompt,
        signal,
      }
    );
  };
};

const createSession = async (
  question: string,
  framework: DeliberationSession['framework'],
  mode: CommunicationMode,
  personas: AdvisorPersona[],
  language: Language,
  generate?: GenerateFn
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
    generate,
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

const localizeSession = (
  session: DeliberationSession,
  language: Language
): DeliberationSession => {
  const t = copy[language];
  const localizedTitles: Record<string, string> = {
    'project-proposal': t.initialProjectTitle,
    'team-priority': t.initialTeamTitle,
    'process-change': t.initialProcessTitle,
  };
  const isSample = ['project-proposal', 'team-priority', 'process-change'].includes(session.id);
  const localizedAdvisors = session.advisors.map((persona) => localizePersona(persona, language));
  return {
    ...session,
    title: session.titlePinned ? session.title : localizedTitles[session.id] ?? session.title,
    summary: isSample ? t.sampleSessionSummary : session.summary,
    relativeTime: isSample ? t.sample : session.relativeTime,
    advisors: localizedAdvisors,
    scenarios: isSample ? scenarioFixture(t) : session.scenarios,
  };
};

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const AppProvider: React.FC<{
  children: React.ReactNode;
  initialLanguage: Language;
  initialAuthUser?: { id: string; email: string } | null;
}> = ({ children, initialLanguage, initialAuthUser }) => {
  const router = useRouter();
  const [currentView, setCurrentViewState] = useState<ViewType>('overview');

  const setCurrentView = useCallback(
    (next: ViewType) => {
      setCurrentViewState(next);
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;
      if (next === 'sign-in' || next === 'sign-up' || next === 'set-password') {
        if (!pathname.startsWith('/auth')) router.push('/auth');
        return;
      }
      if (next === 'overview' || legalDocumentOf(next) !== null) {
        try {
          sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
        } catch {
          // Ignore storage refusal
        }
        if (pathname !== '/') router.push('/');
        return;
      }
      if (next === 'guide') {
        if (pathname.startsWith('/auth')) router.push('/');
        return;
      }
      if (!pathname.startsWith('/dashboard')) {
        router.push('/dashboard');
      }
    },
    [router]
  );

  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = async (next: Language) => {
    if (next === language) return;
    const response = await fetch('/api/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next }),
    });
    if (!response.ok) {
      throw new Error('Could not save language preference');
    }
    document.documentElement.lang = next;
    document.documentElement.dataset.language = next;
    setLanguageState(next);
  };

  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);
  useIsomorphicLayoutEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);
  const toggleTheme = () => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  };

  const [sessions, setSessions] = useState<DeliberationSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessions[0].id);
  const [personas, setPersonas] = useState<AdvisorPersona[]>(initialPersonas);
  const [bots, setBots] = useState<UserBot[]>([]);
  const [botsReady, setBotsReady] = useState(false);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(initialApiKeys);
  const [isFrameworkModalOpen, setIsFrameworkModalOpen] = useState(false);
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [currentMode, setCurrentModeState] = useState<CommunicationMode>('independent');
  const abortRef = useRef<AbortController | null>(null);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(
    initialAuthUser ?? null
  );
  const [authReady, setAuthReady] = useState(!!initialAuthUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const analyticsConsent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    getServerAnalyticsConsent
  );
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);

  useIsomorphicLayoutEffect(() => {
    const restored = readStoredRoom();
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

  const [isRoomBusy, setIsRoomBusy] = useState(false);
  const [isReadingLink, setIsReadingLink] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const roomAbortRef = useRef<AbortController | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);

  const activePlan = planById(currentPlanId);
  const personaCap = activePlan.maxActiveAdvisors;
  const botCap = activePlan.maxBots;

  const disabledBotIds = useMemo(
    () => disabledBotIdsForPlan(bots, currentPlanId),
    [bots, currentPlanId]
  );

  const isBotDisabled = useCallback(
    (botId: string) => disabledBotIds.has(botId),
    [disabledBotIds]
  );

  const roomRosterPartition = useMemo(() => {
    if (!currentRoom) return { activeIds: [], disabledIds: [] };
    return partitionRoomRosterByPlan(currentRoom.roster, currentPlanId, disabledBotIds);
  }, [currentRoom, currentPlanId, disabledBotIds]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = copy[language].documentTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', copy[language].documentDescription);
  }, [language]);

  useEffect(() => {
    if (currentRoom) writeStoredRoom(currentRoom);
  }, [currentRoom]);

  useEffect(() => {
    let cancelled = false;
    const adoptFromServerIfNeeded = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (!res.ok) return null;
        const body = (await res.json()) as { email?: string };
        return body?.email ? { id: body.email, email: body.email.trim().toLowerCase() } : null;
      } catch {
        return null;
      }
    };
    if (!isSupabaseBrowserConfigured()) {
      if (!initialAuthUser) {
        void adoptFromServerIfNeeded().then((fallbackUser) => {
          if (cancelled) return;
          setAuthUser(fallbackUser);
          setAuthReady(true);
        });
      }
      return () => {
        cancelled = true;
      };
    }
    const supabase = createClient();
    const adopt = (user: { id: string; email?: string | null } | null) => {
      if (cancelled) return;
      if (user?.email) {
        setAuthUser({ id: user.id, email: user.email.trim().toLowerCase() });
        setAuthReady(true);
        return;
      }
      if (initialAuthUser) {
        setAuthUser(initialAuthUser);
        setAuthReady(true);
        return;
      }
      setAuthUser(null);
      setAuthReady(true);
    };
    void supabase.auth
      .getUser()
      .then(({ data }) => adopt(data.user))
      .catch(() => adopt(null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) =>
      adopt(session?.user ?? null)
    );
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [initialAuthUser]);

  const signOut = async () => {
    if (isSupabaseBrowserConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    setAuthUser(null);
    setCheckoutPlan(null);
    try {
      sessionStorage.removeItem('zc:initial-dashboard-redirect');
    } catch {}
    setCurrentViewState('overview');
    router.push('/');
    router.refresh();
    window.scrollTo(0, 0);
  };

  const requestCheckout = (plan: Plan) => {
    if (plan.priceVnd <= 0) return;
    if (!authUser) {
      setCurrentView('sign-in');
      window.scrollTo(0, 0);
      return;
    }
    setCheckoutPlan(plan);
  };

  const refreshPlan = useCallback(async () => {
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin' });
      if (!response.ok) return;
      const body = (await response.json()) as {
        role?: string;
        isFounder?: boolean;
        plan?: { planId?: string; expiresAt?: string } | null;
      };
      setIsAdmin(body?.role === 'admin');
      setIsFounder(Boolean(body?.isFounder));
      const planId = body?.plan?.planId;
      setCurrentPlanId(
        planId === 'pro' || planId === 'ultra' || planId === 'free' ? planId : 'free'
      );
      setPlanExpiresAt(typeof body?.plan?.expiresAt === 'string' ? body.plan.expiresAt : null);
    } catch {}
  }, []);

  const postPlanChange = async (to: 'free' | 'pro'): Promise<boolean> => {
    try {
      const response = await fetch('/api/plan/cancel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      if (!response.ok) return false;
      await refreshPlan();
      return true;
    } catch {
      return false;
    }
  };

  const cancelPlanToFree = async (): Promise<boolean> => postPlanChange('free');

  const downgradeToPro = async (): Promise<boolean> => {
    const ok = await postPlanChange('pro');
    if (ok) setCheckoutPlan(planById('pro'));
    return ok;
  };

  const goToPricing = () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      try {
        sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
      } catch {}
      setCurrentViewState('overview');
      router.push('/#pricing');
      return;
    }
    setCurrentViewState('overview');
    const scroll = () =>
      document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  };

  const localizedSessions = useMemo(() => {
    const visible = authUser
      ? sessions.filter(
          (session) => !['project-proposal', 'team-priority', 'process-change'].includes(session.id)
        )
      : sessions;
    return visible.map((session) => localizeSession(session, language));
  }, [language, sessions, authUser]);

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
    framework: DeliberationSession['framework'] = 'Good / Normal / Bad Scenarios',
    advisors: AdvisorPersona[] = localizedPersonas,
    landOn: ViewType = 'session-concluded'
  ) => {
    const rawQuestion = (question ?? '').trim() || copy[language].initialProjectTitle;
    const normalizedQuestion = rawQuestion.toLowerCase();
    const seatingOf = (list: AdvisorPersona[]) =>
      list
        .map((persona) => persona.id)
        .sort()
        .join('|');
    const existing = sessions.find((session) => {
      const originalTitle = localizedTitles[session.id] ?? session.title;
      return (
        originalTitle.toLowerCase() === normalizedQuestion &&
        seatingOf(session.advisors) === seatingOf(advisors)
      );
    });
    if (existing) {
      setCurrentSessionId(existing.id);
      setSelectedRoundIndex(existing.rounds.length);
      setCurrentView(landOn);
      return;
    }
    void (async () => {
      setIsDeliberating(true);
      try {
        let session: DeliberationSession;
        try {
          session = await createSession(
            rawQuestion,
            framework,
            currentMode,
            advisors,
            language,
            buildGenerate(advisors, keys, apiKeys)
          );
        } catch (genError) {
          console.warn('[deliberation] real generation failed, falling back to fixture:', genError);
          session = await createSession(
            rawQuestion,
            framework,
            currentMode,
            advisors,
            language,
            undefined
          );
        }
        setSessions((value) => [session, ...value]);
        setCurrentSessionId(session.id);
        setSelectedRoundIndex(1);
        setCurrentView(landOn);
      } catch (err) {
        console.error('[deliberation] failed to start session:', err);
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
        generate: buildGenerate(session.advisors, keys, apiKeys),
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

  const addPersona = (persona: AdvisorPersona) => {
    const presetCount = personas.filter((p) => !p.id.startsWith('bot:')).length;
    if (presetCount >= personaCap) {
      showToast('toastPersonaCap', { cap: String(personaCap) });
      return;
    }
    setPersonas((value) => [persona, ...value]);
    showToast('toastPersona', { name: persona.archetype });
    setCurrentView('personas');
  };

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
            roster: snapshot.roster,
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
      } catch {}
    },
    [authUser]
  );

  const loadConversationIntoRoom = useCallback((conv: SavedConversation) => {
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
  }, [setCurrentView]);

  const createGroupChat = async (
    roster: AdvisorPersona[],
    mode: ChatMode,
    title?: string
  ): Promise<SavedConversation | null> => {
    const capped = roster.slice(0, personaCap);
    // Group Chat invariant: requires at least 2 bots!
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
      } catch {}
    }

    const localId = `local-group-${Date.now()}`;
    const fallback: SavedConversation = {
      id: localId,
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
        setCurrentView('empty-chamber');
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
    setCurrentView('empty-chamber');
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
      const reading = await readLinkInBrowser(href);
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
        } catch {}
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
            const videoReading = await readVideoInBrowser(file);
            attachment.previewUrl = videoReading.previewUrl;
            attachment.frames = videoReading.frames;
            attachment.text = videoReading.summary;
          } else if (image) {
            if (images >= MAX_IMAGES_PER_MESSAGE * 2) {
              throw new UnreadableFileError(`At most ${MAX_IMAGES_PER_MESSAGE * 2} images per message.`);
            }
            attachment.dataUrl = (await readImageInBrowser(file)).dataUrl;
            images += 1;
          } else {
            const reading = await readFileInBrowser(file);
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

  const [keys, setKeys] = useState<Record<string, string>>({});

  const sendMessage = async (body: string) => {
    if (!currentRoom) return;
    const isSolo = currentRoom.kind === 'solo' || currentRoom.roster.length === 1;
    const { activeIds } = partitionRoomRosterByPlan(
      currentRoom.roster,
      currentPlanId,
      disabledBotIds
    );

    // Enforce plan permission: if every bot in this chat is locked by plan downgrade/expiry, block sending.
    if (activeIds.length === 0) {
      showToast('toastPersonaCap', { cap: String(isSolo ? botCap : personaCap) });
      return;
    }

    const roster = activeIds
      .map((id) => localizedPersonas.find((persona) => persona.id === id))
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
            query?: string;
            results?: { title: string; url: string; snippet: string }[];
            formattedText?: string;
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
        currentRoom.title === copy.en.soloNewThread ||
        currentRoom.title === copy.vi.soloNewThread)
        ? body.slice(0, 60)
        : currentRoom.title;

    const parked: ChatRoom = {
      ...currentRoom,
      title: autoTitle,
      messages: [...currentRoom.messages, userMessage],
      pending: [],
      held,
    };
    setCurrentRoom(parked);
    setIsRoomBusy(true);

    if (stopping) {
      setIsRoomBusy(false);
      void persistRoomSnapshot(parked);
      return;
    }

    const controller = new AbortController();
    roomAbortRef.current = controller;

    try {
      const result = await runTurn({
        roster: activeBots,
        mode: isSolo ? 'round-robin' : currentRoom.mode,
        soloMode: isSolo,
        history: currentRoom.messages,
        userMessage,
        generate: (request) => {
          const persona = active.find((p) => p.id === request.bot.id);
          if (!persona) {
            return scriptedGenerator(activeBots, {
              lensOf: (bot) => active.find((p) => p.id === bot.id)?.stance ?? '',
            })(request);
          }
          const isUserBot = persona.id.startsWith('bot:');
          let resolvedProvider: ModelProvider | undefined = persona.provider;
          let resolvedKey = keys[persona.provider];
          let keyMeta = apiKeys.find((item) => item.provider === persona.provider);
          let resolvedModel = isUserBot
            ? persona.model
            : keyMeta?.connected
              ? keyMeta.modelName
              : persona.model;
          if (!resolvedKey && !isUserBot) {
            const fallbackConnected = apiKeys.find(
              (item) => item.connected && Boolean(keys[item.provider])
            );
            if (fallbackConnected) {
              resolvedProvider = fallbackConnected.provider;
              resolvedKey = keys[fallbackConnected.provider];
              resolvedModel = fallbackConnected.modelName;
              keyMeta = fallbackConnected;
            }
          }
          if (!resolvedProvider || !resolvedKey) {
            return scriptedGenerator(activeBots, {
              lensOf: (bot) => active.find((p) => p.id === bot.id)?.stance ?? '',
            })(request);
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
        turnsUsed: currentRoom.turns,
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
        turns: currentRoom.turns + result.speakers.length,
        stoppedBy: result.stoppedBy,
        failures: result.failures,
      };
      setCurrentRoom(finalSnapshot);
      void persistRoomSnapshot(finalSnapshot);
    } finally {
      roomAbortRef.current = null;
      setIsRoomBusy(false);
    }
  };

  const openingQuestionRef = useRef<string | null>(null);

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
        if (err instanceof DeliberationCancelled) return;
        console.error('[conclusion] failed to open room conclusion:', err);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsDeliberating(false);
      }
    })();
  };

  // Restore connected providers (all 8 built-ins + any custom OpenAI/Anthropic endpoints).
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    void fetch('/api/providers', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          body: {
            providers?: {
              provider: string;
              model: string;
              models?: string[];
              label?: string;
              protocol?: 'anthropic' | 'openai' | 'google';
              baseUrl?: string;
              key?: string;
            }[];
          } | null
        ) => {
          if (cancelled || !body?.providers) return;
          const restored: Record<string, string> = {};
          const saved = new Map(body.providers.map((entry) => [entry.provider, entry]));
          for (const entry of body.providers) {
            if (entry.key) restored[entry.provider] = entry.key;
          }
          setKeys(restored);
          setApiKeys(() => {
            const builtinUpdated = initialApiKeys.map((item) => {
              const entry = saved.get(item.provider);
              if (!entry) return item;
              return {
                ...item,
                connected: true,
                modelName: entry.model,
                models:
                  entry.models && entry.models.length > 0
                    ? entry.models
                    : [entry.model, ...(item.models ?? [])],
              };
            });
            const builtinIds = new Set(initialApiKeys.map((item) => item.provider));
            const customEntries: ApiKeyConfig[] = body.providers!
              .filter((entry) => !builtinIds.has(entry.provider))
              .map((entry) => ({
                provider: entry.provider,
                modelName: entry.model,
                models: entry.models && entry.models.length > 0 ? entry.models : [entry.model],
                connected: true,
                label: entry.label ?? entry.provider,
                protocol: entry.protocol ?? (entry.provider.startsWith('custom:anthropic:') ? 'anthropic' : 'openai'),
                baseUrl: entry.baseUrl ?? '',
                isCustom: true,
              }));
            return [...builtinUpdated, ...customEntries];
          });
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Load account bots on sign-in.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset readiness when account changes
    setBotsReady(false);
    void fetch('/api/bots', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { bots?: UserBot[] } | null) => {
        if (cancelled) return;
        setBots(body?.bots ?? []);
        setBotsReady(true);
      })
      .catch(() => {
        if (!cancelled) setBotsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

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

  useEffect(() => {
    if (!authUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server plan state
    void refreshPlan();
  }, [authUser, refreshPlan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('paid') !== '1') return;
    url.searchParams.delete('paid');
    window.history.replaceState(null, '', url.toString());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot toast on return
    showToast('toastPaymentSuccess');
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror server bots into personas roster
    setPersonas((value) => [
      ...value.filter((persona) => !persona.id.startsWith('bot:')),
      ...bots.map((bot, idx) => botToPersona(bot, idx)),
    ]);
  }, [bots]);

  const createBot = async (input: {
    name: string;
    instruction: string;
    provider: ModelProvider;
    model: string;
  }): Promise<UserBot | null> => {
    try {
      const response = await fetch('/api/bots', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { bot: UserBot };
      setBots((value) => [...value, body.bot]);
      return body.bot;
    } catch {
      return null;
    }
  };

  const updateBot = async (
    id: string,
    input: { name: string; instruction: string; provider: ModelProvider; model: string }
  ): Promise<UserBot | null> => {
    try {
      const response = await fetch('/api/bots', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...input }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { bot: UserBot };
      setBots((value) => value.map((bot) => (bot.id === id ? body.bot : bot)));
      return body.bot;
    } catch {
      return null;
    }
  };

  const deleteBot = async (id: string) => {
    await fetch(`/api/bots?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => undefined);
    setBots((value) => value.filter((bot) => bot.id !== id));
    const soloThreads = conversations.filter((c) => c.kind === 'solo' && c.botId === id);
    for (const thread of soloThreads) {
      void deleteConversationById(thread.id);
    }
  };

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
      } catch {}
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

  const connectApiKey = async (
    provider: ModelProvider,
    key: string,
    model: string,
    meta: ConnectProviderMeta = {}
  ): Promise<boolean> => {
    const modelList =
      meta.models && meta.models.length > 0
        ? [...new Set([model, ...meta.models])]
        : [model];
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          models: modelList,
          key,
          ...(meta.label ? { label: meta.label } : {}),
          ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
        }),
      });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    setKeys((value) => ({ ...value, [provider]: key }));
    setApiKeys((value) => {
      const exists = value.some((item) => item.provider === provider);
      if (exists) {
        return value.map((item) =>
          item.provider === provider
            ? {
                ...item,
                connected: true,
                modelName: model,
                models: modelList,
                ...(meta.label ? { label: meta.label } : {}),
                ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
              }
            : item
        );
      }
      return [
        ...value,
        {
          provider,
          modelName: model,
          models: modelList,
          connected: true,
          label: meta.label ?? provider,
          protocol: meta.protocol ?? 'openai',
          baseUrl: meta.baseUrl ?? '',
          isCustom: true,
        },
      ];
    });
    showToast('toastProviderOn', { provider: meta.label ?? provider });
    return true;
  };

  const updateProviderModels = async (
    provider: ModelProvider,
    model: string,
    models: string[]
  ): Promise<boolean> => {
    const deduped = [...new Set([model, ...models])];
    try {
      const response = await fetch('/api/providers', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, models: deduped }),
      });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    setApiKeys((value) =>
      value.map((item) =>
        item.provider === provider ? { ...item, modelName: model, models: deduped } : item
      )
    );
    return true;
  };

  const getProviderSecret = (provider: ModelProvider): string | undefined => keys[provider];

  const removeApiKey = async (provider: ModelProvider) => {
    await fetch(`/api/providers?provider=${encodeURIComponent(provider)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => undefined);
    setKeys((value) => {
      const next = { ...value };
      delete next[provider];
      return next;
    });
    setApiKeys((value) =>
      value
        .filter((item) => !(item.provider === provider && item.isCustom))
        .map((item) => (item.provider === provider ? { ...item, connected: false } : item))
    );
    showToast('toastProviderOff', { provider });
  };

  const revokeAllKeys = async () => {
    await fetch('/api/providers', { method: 'DELETE', credentials: 'same-origin' }).catch(
      () => undefined
    );
    setKeys({});
    setApiKeys(initialApiKeys.map((item) => ({ ...item, connected: false })));
    showToast('toastProvidersCleared');
  };

  const currentSession =
    localizedSessions.find((session) => session.id === currentSessionId) ||
    localizedSessions[0] ||
    localizeSession(initialSessions[0], language);

  const presetPersonaCount = personas.filter((p) => !p.id.startsWith('bot:')).length;

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        language,
        setLanguage,
        theme,
        toggleTheme,
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
        renameSession,
        deleteSession,
        personas: localizedPersonas,
        addPersona,
        bots,
        botsReady,
        botCap,
        canCreateBot: bots.length < botCap,
        disabledBotIds,
        isBotDisabled,
        createBot,
        updateBot,
        deleteBot,
        openBotChat,
        createSoloThread,
        conversations,
        createGroupChat,
        openGroupChat,
        updateGroupChat,
        renameConversation,
        deleteConversationById,
        editingGroupId,
        openEditGroup: (id: string) => {
          setEditingGroupId(id);
          setIsJoinRoomOpen(true);
        },
        closeEditGroup: closeRoomModal,
        apiKeys,
        connectApiKey,
        updateProviderModels,
        getProviderSecret,
        removeApiKey,
        revokeAllKeys,
        isFrameworkModalOpen,
        openFrameworkModal: () => setIsFrameworkModalOpen(true),
        closeFrameworkModal: () => setIsFrameworkModalOpen(false),
        currentPlanId,
        planExpiresAt,
        authUser,
        isAdmin,
        isFounder,
        authReady,
        signOut,
        checkoutPlan,
        consent: analyticsConsent,
        closeCheckout: () => setCheckoutPlan(null),
        requestCheckout,
        refreshPlan,
        cancelPlanToFree,
        downgradeToPro,
        goToPricing,
        personaCap,
        canAddPersona: presetPersonaCount < personaCap,
        isJoinRoomOpen,
        openJoinRoom: () => {
          setEditingGroupId(null);
          setIsJoinRoomOpen(true);
        },
        closeJoinRoom: closeRoomModal,
        joinRoom,
        startCouncilChat,
        wrapUpRoom,
        openRoomConclusion,
        currentRoom,
        roomRosterPartition,
        sendMessage,
        stopRoom,
        clearRoom,
        isRoomBusy,
        attachLink,
        removePending,
        isReadingLink,
        isReadingFile,
        attachFiles,
        webSearchEnabled,
        setWebSearchEnabled,
        isSearchingWeb,
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
