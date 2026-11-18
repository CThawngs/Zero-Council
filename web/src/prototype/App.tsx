'use client';

import React, { useEffect, useRef } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { CounterDraftModal } from './components/CounterDraftModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { OverviewView } from './components/OverviewView';
import { GuideView } from './components/GuideView';
import { LegalView } from './components/LegalView';
import { CookieNotice, AnalyticsLoader } from './components/CookieNotice';
import { CheckoutDrawer } from './components/CheckoutDrawer';
import { legalDocumentOf } from './types';

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
      <div>
        <Header isWorkspace={!isPublicPage} />
        <div className="flex min-h-screen flex-1 pt-[76px]">
          {!isPublicPage && <Sidebar />}
          <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
            {currentView === 'overview' && <OverviewView />}
            {currentView === 'guide' && <GuideView />}
            {legalDocumentOf(currentView) && <LegalView />}
          </main>
        </div>
        {isPublicPage && <Footer />}
        <CheckoutDrawer plan={checkoutPlan} onClose={closeCheckout} />
        <CounterDraftModal />
        <JoinRoomModal />
        <Toast />
        <CookieNotice />
        <AnalyticsLoader />
        <span className="sr-only" aria-live="polite">{t.localBadge}</span>
      </div>
    </div>
  );
};

export default function App() {
  return <ChamberContent />;
}
