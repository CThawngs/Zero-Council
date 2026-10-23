import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { byokGenerator } from '../chat/byok';
import { UnreadableLinkError, readLinkInBrowser } from '../chat/read-link-web';
import { clearStoredRoom, readStoredRoom, writeStoredRoom } from '../chat/storage';
import { scriptedGenerator } from '../chat/scripted';
import { planById, type Plan, type PlanId } from '../data/plans';
import { createClient } from '@/lib/supabase/client';
import {
  getServerAnalyticsConsent,
  readAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsent,
} from '../components/CookieNotice';

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

/**
 * Toast messages are always plain strings, so only string-valued copy keys qualify. A bare
 * `keyof typeof copy['en']` also picks up nested objects — the legal documents — and every toast
 * then has to defend against a value it can only render as `[object Object]`.
 */
type ToastKey = {
  [K in keyof (typeof copy)['en']]: (typeof copy)['en'][K] extends string ? K : never;
}[keyof (typeof copy)['en']];
type ToastValues = Record<string, string>;
type ToastMessage = { key: ToastKey; values?: ToastValues };

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  language: Language;
  setLanguage: (language: Language) => void;
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
    /** Where to land once the session exists. Default is the live session page. */
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
  /** The signed-in account, or null. Null is the normal state for a visitor, not an error. */
  authUser: { id: string; email: string } | null;
  /**
   * False until the first session read resolves. Checkout stays disabled while this is false:
   * treating "not checked yet" as "signed out" would bounce a signed-in user to the login page
   * on a slow connection, and treating it as "signed in" would let an anonymous visitor start a
   * purchase that the server then refuses with a bare 401.
   */
  authReady: boolean;
  signOut: () => Promise<void>;
  /** Plan awaiting payment. Non-null opens the checkout drawer. */
  checkoutPlan: Plan | null;
  /** `null` until the visitor answers the cookie dialog. Analytics loads only on `'granted'`. */
  consent: AnalyticsConsent | null;
  closeCheckout: () => void;
  /**
   * The one entry point to buying. Redirects to sign-in when nobody is signed in, and only then
   * opens checkout. The server refuses anonymous orders too — this stops the dead end client-side
   * instead of after the click.
   */
  requestCheckout: (plan: Plan) => void;
  /**
   * Send the visitor to the pricing table on the landing page.
   *
   * Billing and Settings sit inside the workspace, where the table does not exist. Switching to
   * the overview alone would dump them at the top of the page, so the scroll waits for that view
   * to mount — one frame is not always enough for the section to be in the document.
   */
  goToPricing: () => void;
  /** True when the visitor must register before paying: never claims a signed-in user is anonymous. */
  isJoinRoomOpen: boolean;
  openJoinRoom: () => void;
  closeJoinRoom: () => void;
  joinRoom: (roster: AdvisorPersona[], mode: ChatMode, title?: string) => void;
  /** Opens a room with the default roster and puts `question` to it as the first message. */
  startCouncilChat: (question: string, advisors?: AdvisorPersona[], mode?: ChatMode) => void;
  /** Ends the meeting: aborts a round in flight, then shows the recap of what was said. */
  wrapUpRoom: () => void;
  /** Opens the framework conclusion (Chair's recommendation + scenario branches) for this room's question and advisors. */
  openRoomConclusion: () => void;
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

 feature/council-complete-sync
// `useLayoutEffect` warns when it runs on the server; `useEffect` there is a no-op, which is what we want.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
/**
 * Unimplemted code to allow
 * server access to localStorage
 */
// 1. Storage EventListener in the browser (to check for new update to storage)
function subscribeLanguage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

// 2. Snapshot on Client (from localStorage)
function getLanguageSnapshot(): Language {
  try {
    const saved = localStorage.getItem('zero_council_lang');
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {}
  return 'en';
}
// 3. Snapshot on Server (Next.js SSR default to 'en')
function getLanguageServerSnapshot(): Language {
  return 'en';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read once. The room and the view have to be decided from the SAME read, or a reload drops the
  // user on the marketing page with a live deliberation sitting unread behind it — which is worse
  // than losing the room, because nothing looks broken.
  const [restored] = useState(() => readStoredRoom());
 main

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The first client render MUST equal what the server rendered, and the server has no sessionStorage.
  // This used to read the stored room inside a `useState` initializer, so a tab that still held a room
  // hydrated with a different tree than the HTML it was given. React then threw the server HTML away
  // and client-rendered everything, including the `<Script>` in the root layout — which is the
  // "Encountered a script tag while rendering React component" overlay. A tab with no room never
  // tripped it, which is why deleting the room made the error go away.
  //
  // So both start at the server's answer, and the restore happens once, after hydration but before
  // paint (see the layout effect below). The room and the view are still set from the SAME read in
  // one batch, so a reload cannot land on the marketing page with a live room sitting unread behind it.
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  // Starts at the server's answer ('en'), like the room and the theme: reading storage in this
  // initializer would hydrate a Vietnamese tree against English HTML. The saved choice is adopted
  // before first paint below. `zc-lang` was only ever read, never written, so a visitor who picked
  // Vietnamese lost it on every reload — and, relying on the browser's translate bar instead, hit its
  // DOM-rewriting crashes. Writing it here is what the cookie notice already says the app does.
  const [language, setLanguageState] = useState<Language>('en');
  useIsomorphicLayoutEffect(() => {
    try {
 feature/council-complete-sync
      if (localStorage.getItem('zc-lang') === 'vi') setLanguageState('vi');
    } catch {
      // Storage blocked: stay on the default.
    }
  }, []);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem('zc-lang', next);
    } catch {
      // Private mode: the choice still applies for this page view, it just will not persist.
    }
  };
  // The first client render has to match the server's, and the server cannot know the visitor's theme,
  // so it renders 'light'. The initializer used to read <html data-theme> instead, which the bootstrap
  // script has already set to 'dark' for anyone on a dark system: the header then hydrated with a Sun
  // where the server had drawn a Moon, React found the trees different and discarded the server HTML.
  // So start at the server's answer and adopt the real one before the browser paints (layout effect),
  // which is the "adopt it on mount" step the comment in theme.ts has always described.
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);
  useIsomorphicLayoutEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

    if (typeof localStorage === 'undefined') return 'en';
    const s = localStorage.getItem('zc-lang');
    return s === 'vi' ? 'vi' : 'en';
  } catch { return 'en'; }
  });

  // Both server and initial client render start at 'light' so the HTML
  // matches and hydration succeeds.  The bootstrap script has already set
  // `data-theme` on <html> before paint, so the user never sees a flash.
  // After mount the effect below reads the real attribute and adopts it.
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    const actual =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme((prev) => (prev === actual ? prev : actual));
  }, []);

 main
  const toggleTheme = () => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private-mode storage refusal is not worth surfacing: the theme still
        // applies for this page view, it just will not persist.
      }
      return next;
    });
  };
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
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  /**
   * Non-essential cookie consent. `null` means the visitor has not been asked yet, which is
   * deliberately NOT the same as consent: analytics only loads on an explicit `'granted'`.
   *
   * `useSyncExternalStore` rather than `useState`, because `localStorage` does not exist on the
   * server. A lazy `useState` initializer read the browser store while the server rendered
   * `null`, so a visitor who had already answered got a different first client render than the
   * server produced — React threw a hydration mismatch and re-rendered the whole tree.
   * `getServerSnapshot` returns `null` for the server AND the first client render, so the two
   * agree; the real value arrives on the following render, after hydration has finished.
   */
  const analyticsConsent = useSyncExternalStore(subscribeAnalyticsConsent, readAnalyticsConsent, getServerAnalyticsConsent);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);

  // Restore a room the tab still holds. A layout effect rather than a plain effect: it runs before the
  // browser paints, so the user never sees the empty page flash before the transcript appears (which
  // reads as data loss). Runs once; nothing writes the store until a room exists, so this cannot clobber it.
  useIsomorphicLayoutEffect(() => {
    const restored = readStoredRoom();
    if (!restored) return;
    setCurrentRoom({
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
    setCurrentView('chat-room');
  }, []);
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

  /**
   * Read the session once on mount, then follow it.
   *
   * `authReady` is flipped in BOTH paths on purpose. A Supabase failure leaves nobody signed in,
   * and that has to end as "ready and anonymous" — leaving it pending would freeze every purchase
   * button for the rest of the session instead of routing the visitor to login.
   */
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const adopt = (user: { id: string; email?: string | null } | null) => {
      if (cancelled) return;
      setAuthUser(user?.email ? { id: user.id, email: user.email.trim().toLowerCase() } : null);
      setAuthReady(true);
    };
    void supabase.auth.getUser().then(({ data }) => adopt(data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) =>
      adopt(session?.user ?? null)
    );
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({
      scope: 'local'
    });
    setAuthUser(null);
    setCheckoutPlan(null);
    window.location.href = '/';
    setCurrentView('overview');
    window.scrollTo(0, 0);
  };

  /**
   * Buying always needs an identified account: the grant and any coupon use are recorded against
   * an email, so an anonymous order could never deliver what it paid for.
   *
   * Anonymous visitors are sent to sign-in WITHOUT the plan being stored. Holding it and opening
   * checkout after login is the friendlier flow, but it shows a payment drawer on top of the
   * sign-in form — which reads as "you are being charged before you have an account". Refusing
   * early and letting the server refuse again is the honest version of the same rule.
   */
  const requestCheckout = (plan: Plan) => {
    if (plan.priceVnd <= 0) return;
    if (!authUser) {
      setCurrentView('sign-in');
      window.scrollTo(0, 0);
      return;
    }
    setCheckoutPlan(plan);
  };

  const goToPricing = () => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
      window.location.assign('/#pricing');
      return;
    }
    setCurrentView('overview');
    const scroll = () => document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const localizedTitles: Record<string, string> = {
    'project-proposal': copy[language].initialProjectTitle,
    'team-priority': copy[language].initialTeamTitle,
    'process-change': copy[language].initialProcessTitle,
  };

  const startNewSession = (
    question: string = copy[language].initialProjectTitle,
    framework: DeliberationSession['framework'] = 'Good / Normal / Bad Scenarios',
    advisors: AdvisorPersona[] = localizedPersonas,
    landOn: ViewType = 'session-active'
  ) => {
    const normalizedQuestion = question.trim().toLowerCase();
    // Same question with a different seating is a different meeting, not a reopen of the old one.
    const seatingOf = (list: AdvisorPersona[]) => list.map((persona) => persona.id).sort().join('|');
    const existing = sessions.find((session) => {
      const originalTitle = localizedTitles[session.id] ?? session.title;
      return originalTitle.toLowerCase() === normalizedQuestion && seatingOf(session.advisors) === seatingOf(advisors);
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
        const session = await createSession(
          question.trim(),
          framework,
          currentMode,
          advisors,
          language
        );
        setSessions((value) => [session, ...value]);
        setCurrentSessionId(session.id);
        setSelectedRoundIndex(1);
        setCurrentView(landOn);
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

  /**
 * Clear the deliberation list *and* the cached transcript.
 *
 * These used to be two different places. `setSessions([])` emptied the React state while the
 * room object — every message, every roster — stayed in `sessionStorage`. The user clicked "purge",
 * saw the list empty, reloaded, and the transcript came back. A button that reports success while
 * the data is still there is worse than no button, so both stores are cleared together.
 */
const purgeSessions = () => {
    setSessions([]);
    setCurrentRoom(null);
    clearStoredRoom();
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

  const joinRoom = (roster: AdvisorPersona[], mode: ChatMode, title?: string) => {
    const capped = roster.slice(0, personaCap);
    setCurrentRoom({
      title: title ?? copy[language].chatRoomTitle,
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
      rounds: COUNCIL_ROUNDS,
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

  /**
   * The decision form's primary button lands here. `joinRoom` only queues a state update, so
   * `sendMessage` called in the same tick would still see no room and return silently. The question
   * is parked in a ref and sent by the effect below, on the render where the room exists.
   */
  const openingQuestionRef = useRef<string | null>(null);

  const startCouncilChat = (question: string, advisors?: AdvisorPersona[], mode: ChatMode = 'round-robin') => {
    const body = question.trim();
    if (!body) return;
    const title = body.length > 72 ? `${body.slice(0, 69).trimEnd()}…` : body;
    const seated = (advisors ?? localizedPersonas).slice(0, personaCap);
    // Asking again for a question whose meeting is already open reopens it. Starting a new room here
    // would throw away a transcript the user has not finished reading.
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
    // A round from the previous room is still in flight. When it settles it writes its result into
    // whatever room is current, so a room opened now would be overwritten by the old transcript and
    // its opening question never sent. Abort it and open the new room once it has let go.
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
    // sendMessage is rebuilt every render and reads the room from that render; this effect runs on
    // the render where the new room first exists, which is exactly the one it must read.
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

  // The room is a free conversation; the framework conclusion is the structured read-out of the same
  // question. The conclusion is built by the deliberation engine from the question and the advisors,
  // not from the transcript, and the recap page says so. Creating the session is async, so the view
  // change has to wait for it (`landOn`): switching now would show whatever session was open before.
  const openRoomConclusion = () => {
    if (!currentRoom) return;
    const seated = currentRoom.roster
      .map((id) => localizedPersonas.find((persona) => persona.id === id))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    if (seated.length === 0) return;
    const question = currentRoom.messages.find((message) => message.authorId === USER_HANDLE)?.body ?? currentRoom.title;
    startNewSession(question, 'Good / Normal / Bad Scenarios', seated, 'session-concluded');
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
        authUser,
        authReady,
        signOut,
        checkoutPlan,
        consent: analyticsConsent,
        closeCheckout: () => setCheckoutPlan(null),
        requestCheckout,
        goToPricing,
        personaCap,
        canAddPersona: personas.length < personaCap,
        isJoinRoomOpen,
        openJoinRoom: () => setIsJoinRoomOpen(true),
        closeJoinRoom: () => setIsJoinRoomOpen(false),
        joinRoom,
        startCouncilChat,
        wrapUpRoom,
        openRoomConclusion,
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
