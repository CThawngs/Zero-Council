'use client';

/**
 * Top-level React context provider composing Zero Council workspace domains:
 * - View navigation, theme (`light`/`dark`), and bilingual locale (`en`/`vi`)
 * - `useAuthAndBilling`: Supabase session, RBAC flags, 30-day plan passes, PayOS checkout
 * - `useProvidersAndBots`: encrypted BYOK provider metadata, custom bots, plan-based locks
 * - `useConversations`: durable solo & group threads + active room storage sync
 * - `useRoomMessaging`: multi-agent turn execution, attachments, web search, Chair conclusion
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  type Language,
  type ViewType,
  cookieLanguage,
  legalDocumentOf,
} from '../types';
import { copy, translations } from '../i18n';
import {
  applyTheme,
  readTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '../theme';
import type { ContentPanelPayload } from '../chat/content-render';
import { useIsomorphicLayoutEffect } from './helpers';
import { useAuthAndBilling } from './useAuthAndBilling';
import { useProvidersAndBots } from './useProvidersAndBots';
import { useConversations } from './useConversations';
import { useRoomMessaging } from './useRoomMessaging';
import type {
  AppContextType,
  ToastKey,
  ToastMessage,
  ToastValues,
} from './types';

export type {
  ChatRoom,
  ConnectProviderMeta,
  ConnectApiKeyResult,
  AppContextType,
} from './types';
export { botPersonaId } from './helpers';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
  children: React.ReactNode;
  initialLanguage: Language;
  initialAuthUser?: { id: string; email: string } | null;
}> = ({ children, initialLanguage, initialAuthUser }) => {
  const router = useRouter();
  const [currentView, setCurrentViewState] = useState<ViewType>('overview');
  const [contentPanel, setContentPanel] = useState<ContentPanelPayload | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((key: ToastKey, values?: ToastValues) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage({ key, values });
    toastTimer.current = setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const setCurrentView = useCallback(
    (next: ViewType) => {
      setCurrentViewState(next);
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;
      if (next === 'sign-up') {
        if (!pathname.startsWith('/auth') || !window.location.search.includes('mode=signup')) {
          router.push('/auth?mode=signup');
        }
        return;
      }
      if (next === 'sign-in') {
        if (!pathname.startsWith('/auth') || window.location.search.includes('mode=signup')) {
          router.push('/auth');
        }
        return;
      }
      if (next === 'set-password') {
        if (!pathname.startsWith('/auth')) router.push('/auth');
        return;
      }
      if (next === 'overview' || legalDocumentOf(next) !== null) {
        try {
          sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
        } catch {
          // Ignore storage refusal.
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
    } catch {
      // Ignore storage refusal.
    }
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

  useEffect(() => {
    document.documentElement.lang = language;
    if (window.location.pathname === '/admin') {
      document.title = copy[language].adminPageTitle;
      return;
    }
    document.title = copy[language].documentTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', copy[language].documentDescription);
  }, [language]);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage refusal.
    }
    setTheme(next);
  };

  const auth = useAuthAndBilling({
    initialAuthUser,
    router,
    setCurrentView,
    setCurrentViewState,
    showToast,
  });

  const providersAndBots = useProvidersAndBots({
    authUser: auth.authUser,
    language,
    currentPlanId: auth.currentPlanId,
    personaCap: auth.personaCap,
    setCurrentView,
    showToast,
  });

  const conv = useConversations({
    authUser: auth.authUser,
    language,
    currentPlanId: auth.currentPlanId,
    personaCap: auth.personaCap,
    disabledBotIds: providersAndBots.disabledBotIds,
    bots: providersAndBots.bots,
    personas: providersAndBots.personas,
    setCurrentView,
    setCurrentViewState,
  });

  const messaging = useRoomMessaging({
    authUser: auth.authUser,
    language,
    currentPlanId: auth.currentPlanId,
    personaCap: auth.personaCap,
    botCap: auth.botCap,
    disabledBotIds: providersAndBots.disabledBotIds,
    personas: providersAndBots.personas,
    localizedPersonas: providersAndBots.localizedPersonas,
    apiKeys: providersAndBots.apiKeys,
    keys: providersAndBots.keys,
    currentRoom: conv.currentRoom,
    setCurrentRoom: conv.setCurrentRoom,
    setConversations: conv.setConversations,
    roomAbortRef: conv.roomAbortRef,
    persistRoomSnapshot: conv.persistRoomSnapshot,
    joinRoom: conv.joinRoom,
    setCurrentView,
    showToast,
  });

  const deleteBot = async (id: string) => {
    await providersAndBots.removeBotRecord(id);
    const soloThreads = conv.conversations.filter((c) => c.kind === 'solo' && c.botId === id);
    for (const thread of soloThreads) {
      void conv.deleteConversationById(thread.id);
    }
  };

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
        sessions: messaging.sessions,
        currentSessionId: messaging.currentSessionId,
        setCurrentSessionId: messaging.setCurrentSessionId,
        currentSession: messaging.currentSession,
        cancelRound: messaging.cancelRound,
        isDeliberating: messaging.isDeliberating,
        selectedRoundIndex: messaging.selectedRoundIndex,
        selectRound: messaging.selectRound,
        purgeSessions: messaging.purgeSessions,
        renameSession: messaging.renameSession,
        deleteSession: messaging.deleteSession,
        personas: providersAndBots.localizedPersonas,
        addPersona: providersAndBots.addPersona,
        bots: providersAndBots.bots,
        botsReady: providersAndBots.botsReady,
        botCap: auth.botCap,
        canCreateBot: providersAndBots.bots.length < auth.botCap,
        disabledBotIds: providersAndBots.disabledBotIds,
        isBotDisabled: providersAndBots.isBotDisabled,
        createBot: providersAndBots.createBot,
        updateBot: providersAndBots.updateBot,
        deleteBot,
        openBotChat: conv.openBotChat,
        openFirstBotOrWizard: conv.openFirstBotOrWizard,
        createSoloThread: conv.createSoloThread,
        conversations: conv.conversations,
        createGroupChat: conv.createGroupChat,
        openGroupChat: conv.openGroupChat,
        updateGroupChat: conv.updateGroupChat,
        renameConversation: conv.renameConversation,
        deleteConversationById: conv.deleteConversationById,
        editingGroupId: conv.editingGroupId,
        openEditGroup: conv.openEditGroup,
        closeEditGroup: conv.closeEditGroup,
        apiKeys: providersAndBots.apiKeys,
        connectApiKey: providersAndBots.connectApiKey,
        updateProviderModels: providersAndBots.updateProviderModels,
        getProviderSecret: providersAndBots.getProviderSecret,
        removeApiKey: providersAndBots.removeApiKey,
        revokeAllKeys: providersAndBots.revokeAllKeys,
        contentPanel,
        openContentPanel: (payload) => setContentPanel(payload),
        closeContentPanel: () => setContentPanel(null),
        currentPlanId: auth.currentPlanId,
        planExpiresAt: auth.planExpiresAt,
        authUser: auth.authUser,
        isAdmin: auth.isAdmin,
        isFounder: auth.isFounder,
        authReady: auth.authReady,
        signOut: auth.signOut,
        checkoutPlan: auth.checkoutPlan,
        consent: auth.analyticsConsent,
        closeCheckout: auth.closeCheckout,
        requestCheckout: auth.requestCheckout,
        refreshPlan: auth.refreshPlan,
        cancelPlanToFree: auth.cancelPlanToFree,
        downgradeToPro: auth.downgradeToPro,
        goToPricing: auth.goToPricing,
        personaCap: auth.personaCap,
        canAddPersona: providersAndBots.presetPersonaCount < auth.personaCap,
        isJoinRoomOpen: conv.isJoinRoomOpen,
        openJoinRoom: conv.openJoinRoom,
        closeJoinRoom: conv.closeJoinRoom,
        joinRoom: conv.joinRoom,
        startCouncilChat: messaging.startCouncilChat,
        wrapUpRoom: messaging.wrapUpRoom,
        openRoomConclusion: messaging.openRoomConclusion,
        conclusionError: messaging.conclusionError,
        clearConclusionError: messaging.clearConclusionError,
        currentRoom: conv.currentRoom,
        roomRosterPartition: conv.roomRosterPartition,
        sendMessage: messaging.sendMessage,
        retryLastTurn: messaging.retryLastTurn,
        stopRoom: conv.stopRoom,
        clearRoom: conv.clearRoom,
        isRoomBusy: messaging.isRoomBusy,
        attachLink: messaging.attachLink,
        removePending: messaging.removePending,
        isReadingLink: messaging.isReadingLink,
        isReadingFile: messaging.isReadingFile,
        attachFiles: messaging.attachFiles,
        webSearchEnabled: messaging.webSearchEnabled,
        setWebSearchEnabled: messaging.setWebSearchEnabled,
        isSearchingWeb: messaging.isSearchingWeb,
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
