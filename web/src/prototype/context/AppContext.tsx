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
  cookieLanguage,
  legalDocumentOf,
} from '../types';
import type { CommunicationMode, Round } from '@/lib/deliberation/types';
import { INITIAL_PROVIDERS, localizePersona } from '../data/catalog';
import { deleteSessionFromList, renameSessionInList } from '../sessions-crud';
import { copy, translations } from '../i18n';
import { applyTheme, readTheme, resolveInitialTheme, THEME_STORAGE_KEY, type Theme } from '../theme';
import type { ContentPanelPayload } from '../chat/content-render';
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
  type TurnError,
  type TurnFailure,
  type TurnFailureReason,
  type WhyStop,
} from '../chat/engine';
import { byokGenerator, completeByokText } from '../chat/byok';
import { sanitizeApiKey } from '@/lib/byok/verify';
import {
  ConclusionAnalysisError,
  analyzeChatRoomConclusion,
  matchPersonaId,
} from '../chat/conclusion';
import { UnreadableLinkError, readLinkInBrowser } from '../chat/read-link-web';
import { UnreadableFileError, readFileInBrowser } from '../chat/read-file-web';
import { MAX_IMAGES_PER_MESSAGE, isImageFile, readImageInBrowser } from '../chat/read-image-web';
import { isVideoFile, readVideoInBrowser } from '../chat/read-video-web';
import { clearStoredRoom, readStoredRoom, writeStoredRoom } from '../chat/storage';
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
  failureReason?: TurnFailureReason;
  turnError?: TurnError | null;
  held: string[];
}

export interface ConnectProviderMeta {
  models?: string[];
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
  isCustom?: boolean;
}

/** Outcome of saving a provider key: the server's stable error code on failure. */
export type ConnectApiKeyResult = { ok: true; warning?: string } | { ok: false; error: string };

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
  openFirstBotOrWizard: (excludeBotId?: string) => void;
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
  ) => Promise<ConnectApiKeyResult>;
  updateProviderModels: (
    provider: ModelProvider,
    model: string,
    models: string[]
  ) => Promise<boolean>;
  getProviderSecret: (provider: ModelProvider) => string | undefined;
  removeApiKey: (provider: ModelProvider) => Promise<void>;
  revokeAllKeys: () => Promise<void>;
  contentPanel: ContentPanelPayload | null;
  openContentPanel: (payload: ContentPanelPayload) => void;
  closeContentPanel: () => void;
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
  conclusionError: { reason: TurnFailureReason; message: string } | null;
  clearConclusionError: () => void;
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

const emptyConcludedSession = (language: Language): DeliberationSession => {
  const t = copy[language];
  const round: Round = {
    index: 1,
    mode: 'independent',
    framework: 'scenarios',
    prompt: '',
    language,
    contributions: [],
    chair: { summary: '', dissent: '', recommendation: '' },
    frameworkOutput: { kind: 'scenarios', matrix: null },
  };
  return {
    id: 'empty',
    title: '',
    summary: '',
    framework: 'Good / Normal / Bad Scenarios',
    mode: 'independent',
    timestamp: new Date(0).toISOString(),
    relativeTime: '',
    status: 'Concluded',
    advisors: [],
    rounds: [round],
    scenarios: {
      good: { title: t.favorableTitle, subtitle: '', description: '', actions: [] },
      normal: { title: t.baselineTitle, subtitle: '', description: '', actions: [] },
      bad: { title: t.difficultTitle, subtitle: '', description: '', actions: [] },
    },
  };
};

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
const completeByokTextViaServer = async (
  credentials: {
    provider: string;
    model: string;
    apiKey?: string;
    protocol?: 'anthropic' | 'openai' | 'google';
    baseUrl?: string;
    botId?: string;
  },
  options: { system: string; prompt: string; maxTokens?: number; signal?: AbortSignal }
): Promise<string> => {
  if (credentials.apiKey) {
    return completeByokText(
      { ...credentials, apiKey: credentials.apiKey },
      options
    );
  }
  const response = await fetch('/api/providers/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'text',
      provider: credentials.provider,
      model: credentials.model,
      ...(credentials.botId ? { botId: credentials.botId } : {}),
      system: options.system,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
    }),
    signal: options.signal,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    text?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || payload?.ok !== true || typeof payload.text !== 'string') {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR');
  }
  return payload.text;
};

const localizeSession = (
  session: DeliberationSession,
  language: Language
): DeliberationSession => ({
  ...session,
  advisors: session.advisors.map((persona) => localizePersona(persona, language)),
});

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
    document.documentElement.lang = next;
    document.documentElement.dataset.language = next;
    try {
      document.cookie = `${cookieLanguage}=${next}; path=/; max-age=31536000; samesite=lax`;
      localStorage.setItem('zc-lang-sync', next);
    } catch {}
    setLanguageState(next);
    try {
      await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: next }),
      });
    } catch {
      // Client cookie fallback above keeps SSR and client synced even if offline.
    }
  };

  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);
  useIsomorphicLayoutEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const next: Theme =
          event.newValue === 'dark' || event.newValue === 'light'
            ? event.newValue
            : window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
        applyTheme(next);
        setTheme(next);
      } else if (event.key === 'zc-lang-sync' && (event.newValue === 'en' || event.newValue === 'vi')) {
        document.documentElement.lang = event.newValue;
        document.documentElement.dataset.language = event.newValue;
        setLanguageState(event.newValue);
      }
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = (event: MediaQueryListEvent) => {
      if (readTheme() !== null) return;
      const next: Theme = event.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    window.addEventListener('storage', onStorage);
    media.addEventListener('change', onMediaChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      media.removeEventListener('change', onMediaChange);
    };
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    setTheme(next);
  };

  const [sessions, setSessions] = useState<DeliberationSession[]>([]);
  const [contentPanel, setContentPanel] = useState<ContentPanelPayload | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [personas, setPersonas] = useState<AdvisorPersona[]>([]);
  const [bots, setBots] = useState<UserBot[]>([]);
  const [botsReady, setBotsReady] = useState(false);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(INITIAL_PROVIDERS);
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [conclusionError, setConclusionError] = useState<{
    reason: TurnFailureReason;
    message: string;
  } | null>(null);
  const clearConclusionError = useCallback(() => setConclusionError(null), []);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
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
    const pathname = window.location.pathname;
    if (pathname === '/admin') {
      document.title = copy[language].adminPageTitle;
      return;
    }
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
      const response = await fetch('/api/me', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
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
            throw new Error('PROVIDER_NOT_CONNECTED');
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
                throw new Error(typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR');
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
              hasKey?: boolean;
              maskedKey?: string;
            }[];
          } | null
        ) => {
          if (cancelled || !body?.providers) return;
          const saved = new Map(body.providers.map((entry) => [entry.provider, entry]));
          setKeys({});
          setApiKeys(() => {
            const builtinUpdated = INITIAL_PROVIDERS.map((item) => {
              const entry = saved.get(item.provider);
              if (!entry) return item;
              return {
                ...item,
                connected: true,
                hasKey: entry.hasKey ?? true,
                ...(entry.maskedKey ? { maskedKey: entry.maskedKey } : {}),
                modelName: entry.model,
                models:
                  entry.models && entry.models.length > 0
                    ? entry.models
                    : [entry.model, ...(item.models ?? [])],
              };
            });
            const builtinIds = new Set(INITIAL_PROVIDERS.map((item) => item.provider));
            const customEntries: ApiKeyConfig[] = body.providers!
              .filter((entry) => !builtinIds.has(entry.provider))
              .map((entry) => ({
                provider: entry.provider,
                modelName: entry.model,
                models: entry.models && entry.models.length > 0 ? entry.models : [entry.model],
                connected: true,
                hasKey: entry.hasKey ?? true,
                ...(entry.maskedKey ? { maskedKey: entry.maskedKey } : {}),
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

  /** Redirects to the first available bot chat, or falls back to bot-wizard when no bots exist. */
  const openFirstBotOrWizard = (excludeBotId?: string) => {
    const firstBot = bots.find((item) => item.id !== excludeBotId);
    if (firstBot) {
      openBotChat(firstBot.id);
      return;
    }
    setCurrentView('bot-wizard');
  };

  const connectApiKey = async (
    provider: ModelProvider,
    rawKey: string,
    model: string,
    meta: ConnectProviderMeta = {}
  ): Promise<ConnectApiKeyResult> => {
    const key = sanitizeApiKey(rawKey);
    const modelList =
      meta.models && meta.models.length > 0
        ? [...new Set([model, ...meta.models])]
        : [model];
    let savedBaseUrl = meta.baseUrl;
    let warning: string | undefined;
    let serverMaskedKey: string | undefined;
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
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        warning?: unknown;
        provider?: { baseUrl?: unknown; maskedKey?: unknown };
      } | null;
      if (!response.ok) {
        return { ok: false, error: typeof payload?.error === 'string' ? payload.error : 'SAVE_FAILED' };
      }
      if (typeof payload?.provider?.baseUrl === 'string') savedBaseUrl = payload.provider.baseUrl;
      if (typeof payload?.warning === 'string') warning = payload.warning;
      if (typeof payload?.provider?.maskedKey === 'string') serverMaskedKey = payload.provider.maskedKey;
    } catch {
      return { ok: false, error: 'NETWORK_FAILED' };
    }
    const finalMeta = { ...meta, ...(savedBaseUrl ? { baseUrl: savedBaseUrl } : {}) };
    // Never retain plaintext provider keys in browser state once persisted server-side.
    setKeys((value) => {
      if (!(provider in value)) return value;
      const next = { ...value };
      delete next[provider];
      return next;
    });
    setApiKeys((value) => {
      const exists = value.some((item) => item.provider === provider);
      if (exists) {
        return value.map((item) =>
          item.provider === provider
            ? {
                ...item,
                connected: true,
                hasKey: true,
                ...(serverMaskedKey ? { maskedKey: serverMaskedKey } : {}),
                modelName: model,
                models: modelList,
                ...(finalMeta.label ? { label: finalMeta.label } : {}),
                ...(finalMeta.baseUrl ? { baseUrl: finalMeta.baseUrl } : {}),
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
          hasKey: true,
          ...(serverMaskedKey ? { maskedKey: serverMaskedKey } : {}),
          label: finalMeta.label ?? provider,
          protocol: finalMeta.protocol ?? 'openai',
          baseUrl: finalMeta.baseUrl ?? '',
          isCustom: true,
        },
      ];
    });
    showToast('toastProviderOn', { provider: finalMeta.label ?? provider });
    return warning ? { ok: true, warning } : { ok: true };
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
        .map((item) =>
          item.provider === provider
            ? { ...item, connected: false, hasKey: false, maskedKey: undefined }
            : item
        )
    );
    showToast('toastProviderOff', { provider });
  };

  const revokeAllKeys = async () => {
    await fetch('/api/providers', { method: 'DELETE', credentials: 'same-origin' }).catch(
      () => undefined
    );
    setKeys({});
    setApiKeys(
      INITIAL_PROVIDERS.map((item) => ({
        ...item,
        connected: false,
        hasKey: false,
        maskedKey: undefined,
      }))
    );
    showToast('toastProvidersCleared');
  };

  const currentSession =
    localizedSessions.find((session) => session.id === currentSessionId) ||
    localizedSessions[0] ||
    emptyConcludedSession(language);

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
        openFirstBotOrWizard,
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
        contentPanel,
        openContentPanel: (payload) => setContentPanel(payload),
        closeContentPanel: () => setContentPanel(null),
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
        conclusionError,
        clearConclusionError,
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

export const useOptionalApp = () => useContext(AppContext);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const nav = translations;
