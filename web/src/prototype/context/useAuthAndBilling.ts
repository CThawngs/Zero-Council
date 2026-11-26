/**
 * Domain hook managing Supabase authentication state, RBAC flags, active 30-day plan pass,
 * PayOS checkout drawer state, and cookie/analytics consent.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ViewType } from '../types';
import { planById, type Plan, type PlanId } from '../data/plans';
import { createClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import {
  getServerAnalyticsConsent,
  readAnalyticsConsent,
  subscribeAnalyticsConsent,
} from '../components/CookieNotice';
import type { ToastKey, ToastValues } from './types';

export function useAuthAndBilling({
  initialAuthUser,
  router,
  setCurrentView,
  setCurrentViewState,
  showToast,
}: {
  initialAuthUser?: { id: string; email: string } | null;
  router: AppRouterInstance;
  setCurrentView: (view: ViewType) => void;
  setCurrentViewState: (view: ViewType) => void;
  showToast: (key: ToastKey, values?: ToastValues) => void;
}) {
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(
    initialAuthUser ?? null
  );
  const [authReady, setAuthReady] = useState(Boolean(initialAuthUser));
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);

  const analyticsConsent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    getServerAnalyticsConsent
  );

  useEffect(() => {
    let cancelled = false;
    const adoptFromServerIfNeeded = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (!res.ok) return null;
        const body = (await res.json()) as { email?: string };
        return body?.email ? { id: body.email, email: body.email.trim().toLowerCase() } : null;
      } catch {
        return null;
      }
    };
    if (!isSupabaseBrowserConfigured()) {
      if (!initialAuthUser) {
        void adoptFromServerIfNeeded().then((fallbackUser) => {
          if (cancelled) return;
          setAuthUser(fallbackUser);
          setAuthReady(true);
        });
      }
      return () => {
        cancelled = true;
      };
    }
    const supabase = createClient();
    const adopt = (user: { id: string; email?: string | null } | null) => {
      if (cancelled) return;
      if (user?.email) {
        setAuthUser({ id: user.id, email: user.email.trim().toLowerCase() });
        setAuthReady(true);
        return;
      }
      if (initialAuthUser) {
        setAuthUser(initialAuthUser);
        setAuthReady(true);
        return;
      }
      setAuthUser(null);
      setAuthReady(true);
    };
    void supabase.auth
      .getUser()
      .then(({ data }) => adopt(data.user))
      .catch(() => adopt(null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) =>
      adopt(session?.user ?? null)
    );
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [initialAuthUser]);

  const refreshPlan = useCallback(async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        role?: string;
        isFounder?: boolean;
        plan?: { planId?: string; expiresAt?: string } | null;
      };
      setIsAdmin(body?.role === 'admin');
      setIsFounder(Boolean(body?.isFounder));
      const planId = body?.plan?.planId;
      setCurrentPlanId(
        planId === 'pro' || planId === 'ultra' || planId === 'free' ? planId : 'free'
      );
      setPlanExpiresAt(typeof body?.plan?.expiresAt === 'string' ? body.plan.expiresAt : null);
    } catch {
      // Best-effort sync; keep current plan state if offline.
    }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server plan state on sign-in
    void refreshPlan();
  }, [authUser, refreshPlan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('paid') !== '1') return;
    url.searchParams.delete('paid');
    window.history.replaceState(null, '', url.toString());
    showToast('toastPaymentSuccess');
  }, [showToast]);

  const signOut = async () => {
    if (isSupabaseBrowserConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    setAuthUser(null);
    setCheckoutPlan(null);
    try {
      sessionStorage.removeItem('zc:initial-dashboard-redirect');
    } catch {
      // Ignore storage refusal.
    }
    setCurrentViewState('overview');
    router.push('/');
    router.refresh();
    window.scrollTo(0, 0);
  };

  const requestCheckout = (plan: Plan) => {
    if (plan.priceVnd <= 0) return;
    if (!authUser) {
      setCurrentView('sign-in');
      window.scrollTo(0, 0);
      return;
    }
    setCheckoutPlan(plan);
  };

  const postPlanChange = async (to: 'free' | 'pro'): Promise<boolean> => {
    try {
      const response = await fetch('/api/plan/cancel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      if (!response.ok) return false;
      await refreshPlan();
      return true;
    } catch {
      return false;
    }
  };

  const cancelPlanToFree = async (): Promise<boolean> => postPlanChange('free');

  const downgradeToPro = async (): Promise<boolean> => {
    const ok = await postPlanChange('pro');
    if (ok) setCheckoutPlan(planById('pro'));
    return ok;
  };

  const goToPricing = () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      try {
        sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
      } catch {
        // Ignore storage refusal.
      }
      setCurrentViewState('overview');
      router.push('/#pricing');
      return;
    }
    setCurrentViewState('overview');
    const scroll = () =>
      document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  };

  const activePlan = planById(currentPlanId);

  return {
    authUser,
    authReady,
    isAdmin,
    isFounder,
    currentPlanId,
    planExpiresAt,
    personaCap: activePlan.maxActiveAdvisors,
    botCap: activePlan.maxBots,
    checkoutPlan,
    closeCheckout: () => setCheckoutPlan(null),
    requestCheckout,
    refreshPlan,
    cancelPlanToFree,
    downgradeToPro,
    goToPricing,
    signOut,
    analyticsConsent,
  };
}
