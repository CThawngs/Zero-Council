import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvisorPersona,
  ApiKeyConfig,
  DeliberationSession,
  Language,
  ModelProvider,
  Theme,
  ViewType,
} from '../types';
import { initialApiKeys, initialPersonas, initialSessions, localizePersona } from '../data/mockData';
import { copy, translations } from '../i18n';

type ToastKey = keyof (typeof copy)['en'];
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
  startNewSession: (question?: string, framework?: DeliberationSession['framework']) => void;
  setCurrentFramework: (framework: DeliberationSession['framework']) => void;
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

const createSession = (
  question: string,
  framework: DeliberationSession['framework'],
  personas: AdvisorPersona[],
  language: Language
): DeliberationSession => {
  const t = copy[language];
  return {
    id: nextSessionId(),
    title: question,
    summary: t.sampleSessionSummary,
    framework,
    timestamp: new Date().toISOString(),
    relativeTime: t.sampleNow,
    status: 'Deliberating',
    advisors: personas,
    testimonies: personas.slice(0, 3).map((persona) => ({
      advisorId: persona.id,
      heading: persona.name,
      stanceBadge: persona.stance,
      primaryText: persona.sampleQuote,
      secondaryText: persona.instructions,
    })),
    synthesis: {
      chairTitle: t.sampleChair,
      chairRole: t.sampleNarrator,
      statusBadge: t.fixtureNotConsensus,
      coreOutput: t.sampleTakeaway,
      stipulations: [t.sampleStipulationOne, t.sampleStipulationTwo],
      nextAction: t.sampleNextAction,
      quote: t.sampleQuote,
    },
    scenarios: {
      good: { title: t.favorableTitle, subtitle: t.illustrativeOnly, description: t.favorableDescription, actions: [t.favorableActionOne, t.favorableActionTwo] },
      normal: { title: t.baselineTitle, subtitle: t.illustrativeOnly, description: t.baselineDescription, actions: [t.baselineActionOne, t.baselineActionTwo] },
      bad: { title: t.difficultTitle, subtitle: t.illustrativeOnly, description: t.difficultDescription, actions: [t.difficultActionOne, t.difficultActionTwo] },
    },
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
  return {
    ...session,
    title: localizedTitles[session.id] ?? session.title,
    summary: t.sampleSessionSummary,
    relativeTime: t.sample,
    advisors: localizedAdvisors,
    testimonies: localizedAdvisors.map((persona) => ({
      advisorId: persona.id,
      heading: persona.name,
      stanceBadge: persona.stance,
      primaryText: persona.sampleQuote,
      secondaryText: persona.instructions,
    })),
    synthesis: {
      chairTitle: t.sampleChair,
      chairRole: t.sampleNarrator,
      statusBadge: t.fixtureNotConsensus,
      coreOutput: t.sampleTakeaway,
      stipulations: [t.sampleStipulationOne, t.sampleStipulationTwo],
      nextAction: t.sampleNextAction,
      quote: t.sampleQuote,
    },
    scenarios: {
      good: { title: t.favorableTitle, subtitle: t.illustrativeOnly, description: t.favorableDescription, actions: [t.favorableActionOne, t.favorableActionTwo] },
      normal: { title: t.baselineTitle, subtitle: t.illustrativeOnly, description: t.baselineDescription, actions: [t.baselineActionOne, t.baselineActionTwo] },
      bad: { title: t.difficultTitle, subtitle: t.illustrativeOnly, description: t.difficultDescription, actions: [t.difficultActionOne, t.difficultActionTwo] },
    },
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [sessions, setSessions] = useState<DeliberationSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessions[0].id);
  const [personas, setPersonas] = useState<AdvisorPersona[]>(initialPersonas);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(initialApiKeys);
  const [isFrameworkModalOpen, setIsFrameworkModalOpen] = useState(false);
  const [isCounterDraftModalOpen, setIsCounterDraftModalOpen] = useState(false);
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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = () => setTheme((value) => (value === 'dark' ? 'light' : 'dark'));

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
      setCurrentView('session-active');
      return;
    }
    const session = createSession(question.trim(), framework, localizedPersonas, language);
    setSessions((value) => [session, ...value]);
    setCurrentSessionId(session.id);
    setCurrentView('session-active');
  };

  const setCurrentFramework = (framework: DeliberationSession['framework']) => {
    setSessions((value) =>
      value.map((session) =>
        session.id === currentSessionId ? { ...session, framework } : session
      )
    );
  };

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
        theme,
        toggleTheme,
        t: copy[language],
        sessions: localizedSessions,
        currentSessionId,
        setCurrentSessionId,
        currentSession,
        startNewSession,
        setCurrentFramework,
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
