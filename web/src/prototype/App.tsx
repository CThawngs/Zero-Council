'use client';

import React, { useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { FrameworkModal } from './components/FrameworkModal';
import { CounterDraftModal } from './components/CounterDraftModal';
import { OverviewView } from './components/OverviewView';
import { EmptyChamberView } from './components/EmptyChamberView';
import { SessionActiveView } from './components/SessionActiveView';
import { SessionConcludedView } from './components/SessionConcludedView';
import { SessionsListView } from './components/SessionsListView';
import { PersonasView } from './components/PersonasView';
import { NewAdvisorView } from './components/NewAdvisorView';
import { ApiKeysView } from './components/ApiKeysView';
import { SettingsView } from './components/SettingsView';
import { PrivacyView } from './components/PrivacyView';

const ChamberContent: React.FC = () => {
  const { currentView, t } = useApp();
  const mainRef = useRef<HTMLElement>(null);
  const isPublicPage = currentView === 'overview' || currentView === 'privacy';

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
          {currentView === 'privacy' && <PrivacyView />}
        </main>
      </div>
      {isPublicPage && <Footer />}
      <FrameworkModal />
      <CounterDraftModal />
      <Toast />
      <span className="sr-only" aria-live="polite">{t.localBadge}</span>
    </div>
  );
};

export default function App() {
  return <AppProvider><ChamberContent /></AppProvider>;
}
