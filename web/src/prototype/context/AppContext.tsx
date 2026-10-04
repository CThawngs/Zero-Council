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
import { DeliberationCancelled } from '@/lib/deliberation/engine';
import { runDeliberation } from '@/lib/deliberation/fixture';
import type { CommunicationMode, Round, RoundProgress } from '@/lib/deliberation/engine';
import { initialApiKeys, initialPersonas, initialSessions, localizePersona } from '../data/mockData';
import { copy, modeLabel, translations, type Copy } from '../i18n';

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
  runRound: (prompt: string) => Promise<boolean>;
  cancelRound: () => void;
  isDeliberating: boolean;
  roundProgress: RoundProgress | null;
  selectedRoundIndex: number;
  selectRound: (index: number) => void;
  purgeSessions: () => void;
  personas: AdvisorPersona[];
  addPersona: (persona: AdvisorPersona) => void;
  apiKeys: ApiKeyConfig[];
  connectApiKey: (provider: ModelProvider) => void;
  removeApiKey: (provider: ModelProvider) => void;
  revokeAllKeys: () => void;
  isFrameworkModalOpen: boolean;
  openFrameworkModal: () => void;
  closeFrameworkModal: () => void;
  isCounterDraftModalOpen: boolean;
  openCounterDraftModal: () => void;
  closeCounterDraftModal: () => void;
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

const createSession = async (
  question: string,
  framework: DeliberationSession['framework'],
  mode: CommunicationMode,
  personas: AdvisorPersona[],
  language: Language,
  signal: AbortSignal,
  onContribution?: (progress: RoundProgress) => void
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
    signal,
    onContribution,
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
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [language, setLanguage] = useState<Language>('en');
  const [sessions, setSessions] = useState<DeliberationSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessions[0].id);
  const [personas, setPersonas] = useState<AdvisorPersona[]>(initialPersonas);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(initialApiKeys);
  const [isFrameworkModalOpen, setIsFrameworkModalOpen] = useState(false);
  const [isCounterDraftModalOpen, setIsCounterDraftModalOpen] = useState(false);
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [roundProgress, setRoundProgress] = useState<RoundProgress | null>(null);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [currentMode, setCurrentModeState] = useState<CommunicationMode>('independent');
  const abortRef = useRef<AbortController | null>(null);
  // `isDeliberating` is state, so two clicks in the same tick both read it as
  // false and start two rounds with the same index. This ref flips immediately.
  const busyRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = copy[language].documentTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy[language].documentDescription);
  }, [language]);

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
      if (busyRef.current) return;
      busyRef.current = true;
      // A session being created must not leave the previous round running into
      // a view the user already left.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsDeliberating(true);
      setRoundProgress(null);
      try {
        const session = await createSession(
          question.trim(),
          framework,
          currentMode,
          localizedPersonas,
          language,
          controller.signal,
          setRoundProgress
        );
        setSessions((value) => [session, ...value]);
        setCurrentSessionId(session.id);
        setSelectedRoundIndex(1);
        setCurrentView('session-active');
      } catch (error) {
        if (!(error instanceof DeliberationCancelled)) {
          showToast('toastRoundFailed');
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        busyRef.current = false;
        setIsDeliberating(false);
        setRoundProgress(null);
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

  /** @returns true when the round was committed, false when it was cancelled or failed. */
  const runRound = async (prompt: string): Promise<boolean> => {
    const question = prompt.trim();
    if (!question || busyRef.current) return false;
    const session = sessions.find((item) => item.id === currentSessionId);
    if (!session) return false;

    busyRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsDeliberating(true);
    setRoundProgress(null);
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
        onContribution: setRoundProgress,
      });
      if (controller.signal.aborted) throw new DeliberationCancelled();
      setSessions((value) =>
        value.map((item) =>
          item.id === currentSessionId ? { ...item, rounds: [...item.rounds, round] } : item
        )
      );
      setSelectedRoundIndex(round.index);
      showToast('toastRoundAdded', { round: String(round.index) });
      return true;
    } catch (error) {
      if (error instanceof DeliberationCancelled) showToast('toastRoundCancelled');
      else showToast('toastRoundFailed');
      return false;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
      setIsDeliberating(false);
      setRoundProgress(null);
    }
  };

  const selectRound = (index: number) => setSelectedRoundIndex(index);

  const purgeSessions = () => {
    setSessions([]);
    showToast('toastSessionsReset');
  };

  const addPersona = (persona: AdvisorPersona) => {
    setPersonas((value) => [persona, ...value]);
    showToast('toastPersona', { name: persona.archetype });
    setCurrentView('personas');
  };

  const connectApiKey = (provider: ModelProvider) => {
    setApiKeys((value) =>
      value.map((item) => (item.provider === provider ? { ...item, connected: true } : item))
    );
    showToast('toastProviderOn', { provider });
  };

  const removeApiKey = (provider: ModelProvider) => {
    setApiKeys((value) =>
      value.map((item) => (item.provider === provider ? { ...item, connected: false } : item))
    );
    showToast('toastProviderOff', { provider });
  };

  const revokeAllKeys = () => {
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
        roundProgress,
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
