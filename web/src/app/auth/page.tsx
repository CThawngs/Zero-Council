'use client';

import { useEffect, useRef } from 'react';
import { AppProvider, useApp } from '@/prototype/context/AppContext';
import { Footer } from '@/prototype/components/Footer';
import { Header } from '@/prototype/components/Header';
import { Toast } from '@/prototype/components/Toast';
import { SignUpView } from '@/prototype/components/SignUpView';
import { SignInView } from '@/prototype/components/SignInView';
import { SetPasswordView } from '@/prototype/components/SetPasswordView';
import { createClient } from '@/lib/supabase/client';

function AuthContent() {
    const { currentView, setCurrentView, t } = useApp();
    const isPublicPage = true;
    const mainRef = useRef<HTMLElement>(null);

    // This route has its own fresh AppProvider (separate from the main app),
    // so currentView always starts at its default ('overview'). Point it at
    // the sign-in form the first time this page mounts.

    // Route ràng buộc
    useEffect(() => {
        const supabase = createClient();

        // Lắng nghe tất cả sự kiện Auth (bao gồm cả khi vừa load trang nhận token hoặc session)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // 1. Nếu là luồng reset password từ email
            if (event === 'PASSWORD_RECOVERY') {
                setCurrentView('set-password');
                return;
            }

            // 2. Nếu đã có session nhưng chưa có mật khẩu
            if (session?.user && session.user.user_metadata?.has_password !== true) {
                setCurrentView('set-password');
                return;
            }

            // 3. Các trường hợp còn lại mặc định về sign-in
            setCurrentView((currentView === 'sign-up' || currentView === 'set-password') ? currentView : 'sign-in');
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
            <a href="#main-content" className="skip-link">{t.skipToContent}</a>
            <Header isWorkspace={!isPublicPage} />
            <div className="flex min-h-screen flex-1 pt-[76px]">
                <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9">
                    {currentView === 'sign-up' && <SignUpView />}
                    {currentView === 'sign-in' && <SignInView />}
                    {currentView === 'set-password' && <SetPasswordView />}
                </main>
            </div>
            {isPublicPage && <Footer />}
            <Toast />
            <span className="sr-only" aria-live="polite">{t.localBadge}</span>
        </div>
    );
}

export default function Authentication() {
    return (
        <AppProvider initialView='sign-in'>
            <AuthContent />
        </AppProvider>
    );
}