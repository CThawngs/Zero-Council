'use client';

import { ApiKeysView } from '@/prototype/components/ApiKeysView';
import { BillingHistoryView } from '@/prototype/components/BillingHistoryView';
import { BotSettingsPanel } from '@/prototype/components/BotSettingsPanel';
import { BotWizardView } from '@/prototype/components/BotWizardView';
import { ChatRoomView } from '@/prototype/components/ChatRoomView';
import { CheckoutDrawer } from '@/prototype/components/CheckoutDrawer';
import { ContentPanelModal } from '@/prototype/components/ContentRenderPanel';
import { AnalyticsLoader, CookieNotice } from '@/prototype/components/CookieNotice';
import { GuideView } from '@/prototype/components/GuideView';
import { Header } from '@/prototype/components/Header';
import { JoinRoomModal } from '@/prototype/components/JoinRoomModal';
import { PersonasView } from '@/prototype/components/PersonasView';
import { RoomSummaryView } from '@/prototype/components/RoomSummaryView';
import { SessionConcludedView } from '@/prototype/components/SessionConcludedView';
import { SessionsListView } from '@/prototype/components/SessionsListView';
import { SettingsView } from '@/prototype/components/SettingsView';
import { Sidebar } from '@/prototype/components/Sidebar';
import { Toast } from '@/prototype/components/Toast';
import { pickLandingTarget } from '@/prototype/bot-settings-panel-logic';
import { useApp } from '@/prototype/context/AppContext';
import type { ViewType } from '@/prototype/types';
import { useEffect, useRef, useState } from 'react';
import MainContentLoading from './mainContentLoading';

const WORKSPACE_VIEWS = new Set<ViewType>([
  'guide',
  'session-concluded',
  'sessions',
  'personas',
  'api-keys',
  'bot-wizard',
  'settings',
  'billing',
  'chat-room',
  'room-summary',
]);

/** How long we wait for saved chats to arrive before creating a first chat for the first bot. */
const CONVERSATIONS_GRACE_MS = 1500;

export default function Dashboard() {
  const {
    authReady,
    authUser,
    botsReady,
    currentView,
    setCurrentView,
    bots,
    conversations,
    openBotChat,
    openGroupChat,
    currentRoom,
    t,
    checkoutPlan,
    closeCheckout,
  } = useApp();
  const mainRef = useRef<HTMLElement>(null);
  const initialViewSettledRef = useRef(false);
  const landedRef = useRef(false);
  const [landing, setLanding] = useState<'pending' | 'done'>('pending');

  // Latest values for the delayed landing check, without re-running the effect.
  const latestRef = useRef({ bots, conversations, openBotChat, openGroupChat, setCurrentView });
  useEffect(() => {
    latestRef.current = { bots, conversations, openBotChat, openGroupChat, setCurrentView };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
    } catch {}
  }, []);

  // Default landing: open straight into the latest chat (or the first bot),
  // or into bot creation when the account has nothing yet.
  useEffect(() => {
    if (!authReady || (authUser && !botsReady) || initialViewSettledRef.current || landedRef.current) return;

    if (WORKSPACE_VIEWS.has(currentView)) {
      initialViewSettledRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot settle of the first view
      setLanding('done');
      return;
    }

    const land = () => {
      if (landedRef.current) return;
      landedRef.current = true;
      const { bots: b, conversations: c, openBotChat: openBot, openGroupChat: openGroup, setCurrentView: show } =
        latestRef.current;
      const target = pickLandingTarget(b, c);
      if (target.type === 'group') openGroup(target.conversationId);
      else if (target.type === 'solo') openBot(target.botId, target.conversationId);
      else if (target.type === 'bot') openBot(target.botId);
      else show('bot-wizard');
      setLanding('done');
    };

    const target = pickLandingTarget(bots, conversations);
    initialViewSettledRef.current = true;
    if (target.type === 'bot') {
      // Bots exist but no saved chat yet: saved chats load separately, so give
      // them a moment before creating a fresh thread (avoids duplicates).
      const timer = window.setTimeout(land, CONVERSATIONS_GRACE_MS);
      return () => {
        window.clearTimeout(timer);
        initialViewSettledRef.current = false;
      };
    }
    land();
  }, [authReady, authUser, botsReady, bots, conversations, currentView]);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [currentView]);

  const loading =
    !authReady || (authUser && !botsReady) || (landing === 'pending' && !WORKSPACE_VIEWS.has(currentView));

  return (
    <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
      <a href="#main-content" className="skip-link">{t.skipToContent}</a>
      <Header isWorkspace={true} />
      <div className="flex min-h-screen flex-1 pt-[76px]">
        <Sidebar />
        {loading ? (
          <MainContentLoading />
        ) : (
          <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
            {currentView === 'guide' && <GuideView />}
            {currentView === 'session-concluded' && <SessionConcludedView />}
            {currentView === 'sessions' && <SessionsListView />}
            {currentView === 'personas' && <PersonasView />}
            {currentView === 'api-keys' && <ApiKeysView />}
            {currentView === 'bot-wizard' && <BotWizardView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'billing' && <BillingHistoryView />}
            {currentView === 'chat-room' && <ChatRoomView />}
            {currentView === 'room-summary' && <RoomSummaryView />}
          </main>
        )}
        {!loading && currentView === 'chat-room' && currentRoom ? <BotSettingsPanel /> : null}
      </div>
      <CheckoutDrawer plan={checkoutPlan} onClose={closeCheckout} />
      <JoinRoomModal />
      <ContentPanelModal />
      <Toast />
      <CookieNotice />
      <AnalyticsLoader />
      <span className="sr-only" aria-live="polite">{t.localBadge}</span>
    </div>
  );
}
