'use client';

import { ApiKeysView } from "@/prototype/components/ApiKeysView";
import { BillingHistoryView } from "@/prototype/components/BillingHistoryView";
import { BotWizardView } from "@/prototype/components/BotWizardView";
import { ChatRoomView } from "@/prototype/components/ChatRoomView";
import { CheckoutDrawer } from "@/prototype/components/CheckoutDrawer";
import { AnalyticsLoader, CookieNotice } from "@/prototype/components/CookieNotice";
import { CounterDraftModal } from "@/prototype/components/CounterDraftModal";
import { EmptyChamberView } from "@/prototype/components/EmptyChamberView";
import { GuideView } from "@/prototype/components/GuideView";
import { Header } from "@/prototype/components/Header";
import { NewAdvisorView } from "@/prototype/components/NewAdvisorView";
import { PersonasView } from "@/prototype/components/PersonasView";
import { RoomSummaryView } from "@/prototype/components/RoomSummaryView";
import { SessionConcludedView } from "@/prototype/components/SessionConcludedView";
import { SessionsListView } from "@/prototype/components/SessionsListView";
import { SettingsView } from "@/prototype/components/SettingsView";
import { Sidebar } from "@/prototype/components/Sidebar";
import { Toast } from "@/prototype/components/Toast";
import { useApp } from "@/prototype/context/AppContext";
import { useEffect, useRef } from "react";
import MainContentLoading from "./mainContentLoading";

export default function Dashboard() {
    const { authReady, authUser, botsReady, currentView, setCurrentView, bots, t, checkoutPlan, closeCheckout } = useApp();
    const mainRef = useRef<HTMLElement>(null);
    const isPublicPage = false;
    const initialViewSettledRef = useRef(false);

    useEffect(() => {
        try {
            sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
        } catch {}
    }, []);

    useEffect(() => {
        if (!authReady || !botsReady || initialViewSettledRef.current) return;
        initialViewSettledRef.current = true;
        setCurrentView(bots.length > 0 ? 'empty-chamber' : 'bot-wizard');
    }, [authReady, botsReady, bots.length, setCurrentView]);

    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true });
    }, [currentView]);

    return (
        <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
            <a href="#main-content" className="skip-link">{t.skipToContent}</a>
            <Header isWorkspace={!isPublicPage} />
            <div className="flex min-h-screen flex-1 pt-[76px]">
                {!isPublicPage && <Sidebar />}
                {
                    // Client-side wait for AppContext auth & data readiness
                    (!authReady || (authUser && !botsReady)) ?
                        <MainContentLoading /> : (
                        <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
                            {currentView === 'empty-chamber' && <EmptyChamberView />}
                            {currentView === 'guide' && <GuideView />}
                            {currentView === 'session-concluded' && <SessionConcludedView />}
                            {currentView === 'sessions' && <SessionsListView />}
                            {currentView === 'personas' && <PersonasView />}
                            {currentView === 'new-advisor' && <NewAdvisorView />}
                            {currentView === 'api-keys' && <ApiKeysView />}
                            {currentView === 'bot-wizard' && <BotWizardView />}
                            {currentView === 'settings' && <SettingsView />}
                            {currentView === 'billing' && <BillingHistoryView />}
                            {currentView === 'chat-room' && <ChatRoomView />}
                            {currentView === 'room-summary' && <RoomSummaryView />}
                        </main>
                        )
                }
            </div>
            {/* The plan survives the trip to the sign-in page, so a visitor who clicks "Sign in to buy"
                comes back to a checkout that is already filled in. */}
            <CheckoutDrawer plan={checkoutPlan} onClose={closeCheckout} />
            <CounterDraftModal />
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
}
