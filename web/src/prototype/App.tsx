'use client';

import React, { useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { CounterDraftModal } from './components/CounterDraftModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { ChatRoomView } from './components/ChatRoomView';
import { RoomSummaryView } from './components/RoomSummaryView';
import { OverviewView } from './components/OverviewView';
import { EmptyChamberView } from './components/EmptyChamberView';
import { SessionActiveView } from './components/SessionActiveView';
import { SessionConcludedView } from './components/SessionConcludedView';
import { SessionsListView } from './components/SessionsListView';
import { PersonasView } from './components/PersonasView';
import { NewAdvisorView } from './components/NewAdvisorView';
import { ApiKeysView } from './components/ApiKeysView';
import { SettingsView } from './components/SettingsView';
import { BillingHistoryView } from './components/BillingHistoryView';
import { LegalView } from './components/LegalView';
import { CookieNotice, AnalyticsLoader } from './components/CookieNotice';
import { CheckoutDrawer } from './components/CheckoutDrawer';
import { legalDocumentOf } from './types';
import { SignInView } from './components/SignInView';
import { SignUpView } from './components/SignUpView';

const ChamberContent: React.FC = () => {
  const { currentView, t, checkoutPlan, closeCheckout } = useApp();
  const mainRef = useRef<HTMLElement>(null);
  const isPublicPage = currentView === 'overview' || legalDocumentOf(currentView) !== null || currentView === 'sign-in' || currentView === 'sign-up';

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [currentView]);

  return (
    <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
      <a href="#main-content" className="skip-link">{t.skipToContent}</a>
      <Header isWorkspace={!isPublicPage} />
      <div className="flex min-h-screen flex-1 pt-[76px]">
        {!isPublicPage && <Sidebar />}
        <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          {currentView === 'overview' && <OverviewView />}
          {currentView === 'empty-chamber' && <EmptyChamberView />}
          {currentView === 'session-active' && <SessionActiveView />}
          {currentView === 'session-concluded' && <SessionConcludedView />}
          {currentView === 'sessions' && <SessionsListView />}
          {currentView === 'personas' && <PersonasView />}
          {currentView === 'new-advisor' && <NewAdvisorView />}
          {currentView === 'api-keys' && <ApiKeysView />}
          {currentView === 'settings' && <SettingsView />}
          {currentView === 'billing' && <BillingHistoryView />}
          {legalDocumentOf(currentView) && <LegalView />}
{currentView === 'sign-up' && <SignUpView />}
          {currentView === 'sign-in' && <SignInView />}
          {currentView === 'chat-room' && <ChatRoomView />}
          {currentView === 'room-summary' && <RoomSummaryView />}
        </main>
      </div>
      {isPublicPage && <Footer />}
      {/* The plan survives the trip to the sign-in page, so a visitor who clicks "Sign in to buy"
          comes back to a checkout that is already filled in. */}
      <CheckoutDrawer plan={checkoutPlan} onClose={closeCheckout} />
      <CounterDraftModal />
      <JoinRoomModal />
      <Toast />
      {/* Sits below the modals in the tree but above them in `z-index`, so a cookie notice can
          never cover the checkout drawer or a room the visitor is trying to use. */}
      <CookieNotice />
      {/* Renders nothing until `consent === 'granted'`, and nothing at all when no analytics
          endpoint is configured. Safe to leave mounted unconditionally. */}
      <AnalyticsLoader />
      <span className="sr-only" aria-live="polite">{t.localBadge}</span>
    </div>
  );
};

export default function App() {
  return <AppProvider><ChamberContent /></AppProvider>;
}
