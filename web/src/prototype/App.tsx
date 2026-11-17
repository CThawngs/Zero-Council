'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { OverviewView } from './components/OverviewView';
import { GuideView } from './components/GuideView';
import { LegalView } from './components/LegalView';
import { CookieNotice, AnalyticsLoader } from './components/CookieNotice';
import { CheckoutDrawer } from './components/CheckoutDrawer';
import { legalDocumentOf } from './types';

export const TAB_REDIRECT_KEY = 'zc:initial-dashboard-redirect';

const ChamberContent: React.FC = () => {
  const { currentView, authReady, authUser, t, checkoutPlan, closeCheckout } = useApp();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [currentView]);

  // Auto-route a returning signed-in user to /dashboard once per tab session,
  // while letting anonymous visitors (and signed-in users who clicked the brand
  // logo to come back here) read the public landing page without redirect loops.
  useEffect(() => {
    if (!authReady || !authUser) return;
    try {
      if (sessionStorage.getItem(TAB_REDIRECT_KEY) === 'true') return;
      sessionStorage.setItem(TAB_REDIRECT_KEY, 'true');
    } catch {
      return;
    }
    router.replace('/dashboard');
  }, [authReady, authUser, router]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const target = window.location.hash;
    requestAnimationFrame(() => {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const showLegal = legalDocumentOf(currentView) !== null;
  const showGuide = currentView === 'guide';

  return (
    <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
      <a href="#main-content" className="skip-link">{t.skipToContent}</a>
      <Header isWorkspace={false} />
      <div className="flex min-h-screen flex-1 pt-[76px]">
        <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          {showGuide ? <GuideView /> : showLegal ? <LegalView /> : <OverviewView />}
        </main>
      </div>
      <Footer />
      <CheckoutDrawer plan={checkoutPlan} onClose={closeCheckout} />
      <Toast />
      <CookieNotice />
      <AnalyticsLoader />
      <span className="sr-only" aria-live="polite">{t.localBadge}</span>
    </div>
  );
};

export default function App() {
  return <ChamberContent />;
}
