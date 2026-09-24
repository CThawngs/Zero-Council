'use client';

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { CheckoutDrawer } from './components/CheckoutDrawer';
import { FrameworkModal } from './components/FrameworkModal';
import { CounterDraftModal } from './components/CounterDraftModal';

// Views
import { OverviewView } from './components/OverviewView';
import { SignInView } from './components/SignInView';
import { EmptyChamberView } from './components/EmptyChamberView';
import { SessionActiveView } from './components/SessionActiveView';
import { SessionConcludedView } from './components/SessionConcludedView';
import { SessionsListView } from './components/SessionsListView';
import { PersonasView } from './components/PersonasView';
import { NewAdvisorView } from './components/NewAdvisorView';
import { ApiKeysView } from './components/ApiKeysView';
import { PricingView } from './components/PricingView';
import { SettingsView } from './components/SettingsView';
import { BillingHistoryView } from './components/BillingHistoryView';
import { PrivacyView } from './components/PrivacyView';

const ChamberContent: React.FC = () => {
  const { currentView } = useApp();

  const isPublicPage =
    currentView === 'overview' ||
    currentView === 'sign-in' ||
    currentView === 'pricing' ||
    currentView === 'privacy';

  return (
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col selection:bg-brass selection:text-background">
      {/* Top Header */}
      <Header isWorkspace={!isPublicPage} />

      {/* Main Body */}
      <div className="pt-[88px] md:pt-[100px] flex-1 flex">
        {/* Workspace Sidebar (visible only in authenticated workspace views) */}
        {!isPublicPage && <Sidebar />}

        {/* Content Container */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {currentView === 'overview' && <OverviewView />}
          {currentView === 'sign-in' && <SignInView />}
          {currentView === 'empty-chamber' && <EmptyChamberView />}
          {currentView === 'session-active' && <SessionActiveView />}
          {currentView === 'session-concluded' && <SessionConcludedView />}
          {currentView === 'sessions' && <SessionsListView />}
          {currentView === 'personas' && <PersonasView />}
          {currentView === 'new-advisor' && <NewAdvisorView />}
          {currentView === 'api-keys' && <ApiKeysView />}
          {currentView === 'pricing' && <PricingView />}
          {currentView === 'settings' && <SettingsView />}
          {currentView === 'billing-history' && <BillingHistoryView />}
          {currentView === 'privacy' && <PrivacyView />}
        </main>
      </div>

      {/* Footer on public pages */}
      {isPublicPage && <Footer />}

      {/* Global Modals, Drawers & Notifications */}
      <CheckoutDrawer />
      <FrameworkModal />
      <CounterDraftModal />
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ChamberContent />
    </AppProvider>
  );
}
