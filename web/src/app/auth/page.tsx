'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useApp } from '@/prototype/context/AppContext';
import { Footer } from '@/prototype/components/Footer';
import { Header } from '@/prototype/components/Header';
import { Toast } from '@/prototype/components/Toast';
import { SignUpView } from '@/prototype/components/SignUpView';
import { SignInView } from '@/prototype/components/SignInView';
import { SetPasswordView } from '@/prototype/components/SetPasswordView';
import { createClient } from '@/lib/supabase/client';
import { needsPasswordSet } from '@/lib/auth-password';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function resolveAuthViewFromLocation(): 'sign-in' | 'sign-up' | 'set-password' {
  if (typeof window === 'undefined') return 'sign-in';
  const params = new URLSearchParams(window.location.search);
  if (
    window.location.hash.includes('access_token') ||
    params.has('code') ||
    params.get('reset') === '1'
  ) {
    return 'set-password';
  }
  if (params.get('mode') === 'signup') {
    return 'sign-up';
  }
  return 'sign-in';
}

function AuthContent() {
  const { currentView, setCurrentView, t } = useApp();
  const isPublicPage = true;
  const mainRef = useRef<HTMLElement>(null);
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  });

  // Synchronize initial auth view before first browser paint so /auth and /auth?mode=signup
  // never flash an empty main area while waiting for Supabase's async session callback.
  useIsomorphicLayoutEffect(() => {
    const initial = resolveAuthViewFromLocation();
    if (
      currentViewRef.current !== 'sign-in' &&
      currentViewRef.current !== 'sign-up' &&
      currentViewRef.current !== 'set-password'
    ) {
      setCurrentView(initial);
    }
  }, [setCurrentView]);

  useEffect(() => {
    const supabase = createClient();

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(async ({ error }) => {
          if (!error) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user) setCurrentView('set-password');
          }
        })
        .catch(() => undefined);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const liveParams = new URLSearchParams(window.location.search);
      const arrivingFromEmailLink =
        typeof window !== 'undefined' &&
        (window.location.hash.includes('access_token') ||
          liveParams.has('code') ||
          liveParams.get('reset') === '1');
      if (arrivingFromEmailLink && session?.user) {
        setCurrentView('set-password');
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setCurrentView('set-password');
        return;
      }

      if (session?.user && needsPasswordSet(session.user)) {
        setCurrentView('set-password');
        return;
      }

      const cv = currentViewRef.current;
      if (liveParams.get('mode') === 'signup' && cv !== 'sign-in' && cv !== 'set-password') {
        setCurrentView('sign-up');
        return;
      }
      if (cv !== 'sign-up' && cv !== 'set-password') {
        setCurrentView('sign-in');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentView]);

  const activeAuthView =
    currentView === 'sign-up' || currentView === 'sign-in' || currentView === 'set-password'
      ? currentView
      : 'sign-in';

  return (
    <div className="min-h-screen bg-background text-ink selection:bg-brass selection:text-background">
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>
      <Header isWorkspace={!isPublicPage} />
      <div className="flex min-h-screen flex-1 pt-[76px]">
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-9"
        >
          {activeAuthView === 'sign-up' && <SignUpView />}
          {activeAuthView === 'sign-in' && <SignInView />}
          {activeAuthView === 'set-password' && <SetPasswordView />}
        </main>
      </div>
      {isPublicPage && <Footer />}
      <Toast />
      <span className="sr-only" aria-live="polite">
        {t.localBadge}
      </span>
    </div>
  );
}

export default function Authentication() {
  return <AuthContent />;
}
