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
    useEffect(() => {
        const supabase = createClient();

        // 1. Lắng nghe sự kiện thay đổi trạng thái xác thực từ Supabase
        // Mọi sự kiện như PASSWORD_RECOVERY từ URL hash sẽ tự động kích hoạt callback này
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setCurrentView('set-password');
            }
        });

        // 2. Kiểm tra thông tin người dùng hiện tại
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Kiểm tra xem người dùng chỉ mới đăng nhập bằng Google và chưa có email/password
                const providers = user.app_metadata?.providers || [];
                const isGoogleOnly = providers.includes('google') && !providers.includes('email');

                if (isGoogleOnly) {
                    setCurrentView('set-password');
                    return;
                }
            }

            // Mặc định đặt view ban đầu thành sign-in nếu không ở trạng thái đặc biệt
            if (currentView !== 'sign-up' && currentView !== 'sign-in' && currentView !== 'set-password') {
                setCurrentView('sign-in');
            }
        }

        checkUser();

        return () => {
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <AppProvider>
            <AuthContent />
        </AppProvider>
    );
}