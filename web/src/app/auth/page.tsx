'use client';

import { useEffect, useRef } from 'react';
import { AppProvider, useApp } from '@/prototype/context/AppContext';
import { Footer } from '@/prototype/components/Footer';
import { Header } from '@/prototype/components/Header';
import { Toast } from '@/prototype/components/Toast';
import { SignUpView } from '@/prototype/components/SignUpView';
import { SignInView } from '@/prototype/components/SignInView';

function AuthContent() {
    const { currentView, setCurrentView, t } = useApp();
    const isPublicPage = true;
    const mainRef = useRef<HTMLElement>(null);

    // This route has its own fresh AppProvider (separate from the main app),
    // so currentView always starts at its default ('overview'). Point it at
    // the sign-in form the first time this page mounts.
    useEffect(() => {
        if (currentView !== 'sign-in' && currentView !== 'sign-up') {
            setCurrentView('sign-in');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
            <a href="#main-content" className="skip-link">{t.skipToContent}</a>
            <Header isWorkspace={!isPublicPage} />
            <div className="flex min-h-screen flex-1 pt-[76px]">
            <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
                {currentView === 'sign-up' && <SignUpView/>}
                {currentView === 'sign-in' && <SignInView/>}
            </main>
            </div>
            {isPublicPage && <Footer />}
            <Toast />
            <span className="sr-only" aria-live="polite">{t.localBadge}</span>
        </div>
    )
}

export default function Authentication() {
    return (
        <AppProvider>
            <AuthContent />
        </AppProvider>
    );
};
