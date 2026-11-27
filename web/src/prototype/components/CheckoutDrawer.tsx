/**
 * Two-step PayOS 30-day pass checkout drawer (summary + promo validation + local VietQR session).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { type Plan, type PlanId } from '../data/plans';
import { CheckoutQrModal } from './checkout/CheckoutQrModal';
import { CheckoutSummaryModal } from './checkout/CheckoutSummaryModal';
import {
  BILL_TTL_MS,
  qrSrc,
  type AppliedCoupon,
  type QrSession,
} from './checkout/types';

interface CheckoutDrawerProps {
  plan: Plan | null;
  onClose: () => void;
}

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({ plan, onClose }) => {
  const { t, showToast, refreshPlan } = useApp();
  const [code, setCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [retryingQr, setRetryingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string | null>(null);
  const [qr, setQr] = useState<QrSession | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [qrImgLoaded, setQrImgLoaded] = useState(false);
  const [qrImgError, setQrImgError] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const qrRef = useRef<QrSession | null>(null);
  const qrExpiredRef = useRef(false);
  const paidRef = useRef(false);
  const expiredHandledRef = useRef(false);
  const activePlanIdRef = useRef<PlanId | null>(plan?.id ?? null);

  useEffect(() => {
    qrRef.current = qr;
  }, [qr]);

  useEffect(() => {
    qrExpiredRef.current = qrExpired;
  }, [qrExpired]);

  useEffect(() => {
    activePlanIdRef.current = plan?.id ?? null;
  }, [plan?.id]);

  const [prevPlanId, setPrevPlanId] = useState<PlanId | null>(plan?.id ?? null);

  if (plan && plan.id !== prevPlanId) {
    setPrevPlanId(plan.id);
    setCode('');
    setAppliedCoupon(null);
    setCouponError(null);
    setError(null);
    setQr(null);
    setQrExpired(false);
    setQrImgLoaded(false);
    setQrImgError(false);
    setCopiedMemo(false);
    setConfirmCloseOpen(false);
  }

  const activeCoupon =
    appliedCoupon && plan && appliedCoupon.planId === plan.id ? appliedCoupon : null;

  const resolvedQrSrc = useMemo(() => (qr ? qrSrc(qr.qrCode) : ''), [qr]);

  const couponReasonMessage = useCallback(
    (reason?: string): string => {
      switch (reason) {
        case 'INACTIVE':
          return t.discountErrorInactive;
        case 'EXPIRED':
          return t.discountErrorExpired;
        case 'ALREADY_USED':
          return t.discountErrorAlreadyUsed;
        case 'LIMIT_REACHED':
          return t.discountErrorLimit;
        default:
          return t.discountErrorUnknown;
      }
    },
    [t]
  );

  const cancelBill = useCallback(async (orderCode: number) => {
    try {
      await fetch(`/api/payos/orders/${orderCode}`, { method: 'POST' });
    } catch {
      // Best-effort cleanup; server sweeps stale orders automatically.
    }
  }, []);

  const handleCodeChange = (next: string) => {
    setCode(next);
    setCouponError(null);
    if (appliedCoupon && next.trim().toUpperCase() !== appliedCoupon.code.toUpperCase()) {
      setAppliedCoupon(null);
    }
  };

  const applyCoupon = async () => {
    if (!plan || plan.priceVnd <= 0 || couponLoading) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setAppliedCoupon(null);
      setCouponError(t.discountErrorUnknown);
      return;
    }

    const targetPlanId = plan.id;
    setCouponLoading(true);
    setCouponError(null);
    setError(null);
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: targetPlanId, code: trimmed }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        planId?: string;
        code?: string;
        percent?: number;
        originalVnd?: number;
        discountedVnd?: number;
        discountVnd?: number;
        reason?: string;
        error?: string;
      };

      if (activePlanIdRef.current !== targetPlanId) return;

      if (!response.ok || !result.ok || !result.code || typeof result.discountedVnd !== 'number') {
        setAppliedCoupon(null);
        setCouponError(couponReasonMessage(result.reason));
        return;
      }

      setCode(result.code);
      setAppliedCoupon({
        planId: targetPlanId,
        code: result.code,
        percent: result.percent ?? 0,
        originalVnd: result.originalVnd ?? plan.priceVnd,
        discountedVnd: result.discountedVnd,
        discountVnd: result.discountVnd ?? Math.max(0, plan.priceVnd - result.discountedVnd),
      });
    } catch {
      if (activePlanIdRef.current === targetPlanId) {
        setAppliedCoupon(null);
        setCouponError(t.checkoutError);
      }
    } finally {
      if (activePlanIdRef.current === targetPlanId) {
        setCouponLoading(false);
      }
    }
  };

  const removeCoupon = () => {
    setCode('');
    setAppliedCoupon(null);
    setCouponError(null);
    setError(null);
  };

  const createPayosSession = useCallback(
    async (
      targetPlan: Plan,
      couponCode: string | undefined,
      options: { fromRetry?: boolean } = {}
    ) => {
      if (targetPlan.priceVnd <= 0) return;
      if (options.fromRetry) {
        setRetryingQr(true);
        setQrError(null);
      } else {
        setPending(true);
        setError(null);
        setGranted(null);
      }

      try {
        const response = await fetch('/api/payos/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: targetPlan.id, code: couponCode || undefined }),
        });
        const result = (await response.json()) as {
          orderCode?: number;
          amountVnd?: number;
          originalAmountVnd?: number;
          couponCode?: string | null;
          couponPercent?: number;
          checkoutUrl?: string | null;
          qrCode?: string | null;
          expiredAt?: number;
          grantedUntil?: string;
          error?: string;
          desc?: string;
          reason?: string;
        };

        if (!response.ok) {
          const localizePayosDesc = (desc?: string): string | null => {
            if (!desc) return null;
            if (desc === 'Không thể tạo link thanh toán PayOS') return t.checkoutPayosCreateFailed;
            if (desc === 'PayOS không trả về link thanh toán.') return t.checkoutPayosMissingUrl;
            if (desc.includes('Chưa cấu hình Client ID')) return t.checkoutPayosNotConfigured;
            return desc;
          };
          let message: string = t.checkoutError;
          if (result.error === 'COUPON_REJECTED') {
            message = couponReasonMessage(result.reason);
          } else if (result.error === 'NEED_LOGIN') {
            message = t.checkoutNeedLogin;
          } else if (result.error === 'PAYLOS_NOT_CONFIGURED' || result.error === 'PAYOS_NOT_CONFIGURED') {
            message = t.checkoutPayosNotConfigured;
          } else if (result.error === 'PAYLOS_REJECTED' || result.error === 'PAYOS_REJECTED') {
            message = localizePayosDesc(result.desc) || t.checkoutPayosRejected;
          } else if (result.desc) {
            message = localizePayosDesc(result.desc) || result.desc;
          }
          if (options.fromRetry) {
            setQrError(message);
          } else if (result.error === 'COUPON_REJECTED') {
            setCouponError(message);
            setAppliedCoupon(null);
          } else {
            setError(message);
          }
          return;
        }

        if (!result.checkoutUrl && result.grantedUntil) {
          setGranted(result.grantedUntil);
          setQr(null);
          setQrExpired(false);
          setConfirmCloseOpen(false);
          showToast('toastPaymentSuccess');
          await refreshPlan();
          onClose();
          return;
        }

        const qrCodeToUse = result.qrCode || result.checkoutUrl;
        if (qrCodeToUse && typeof result.orderCode === 'number') {
          const rawExp = result.expiredAt ?? Date.now() + BILL_TTL_MS;
          const expMs = rawExp < 10_000_000_000 ? rawExp * 1000 : rawExp;
          const isDataUri = qrCodeToUse.trim().startsWith('data:') || !qrCodeToUse.trim().startsWith('http');
          paidRef.current = false;
          expiredHandledRef.current = false;
          setQrExpired(false);
          setQrImgLoaded(isDataUri);
          setQrImgError(false);
          setCopiedMemo(false);
          setConfirmCloseOpen(false);
          setQrError(null);
          setNow(Date.now());
          setQr({
            orderCode: result.orderCode,
            qrCode: qrCodeToUse,
            amountVnd: typeof result.amountVnd === 'number' ? result.amountVnd : targetPlan.priceVnd,
            originalAmountVnd:
              typeof result.originalAmountVnd === 'number'
                ? result.originalAmountVnd
                : targetPlan.priceVnd,
            couponCode: result.couponCode ?? (couponCode ? couponCode.trim().toUpperCase() : null),
            couponPercent: typeof result.couponPercent === 'number' ? result.couponPercent : 0,
            plan: targetPlan,
            planName: targetPlan.name,
            expiredAt: expMs,
          });
          return;
        }

        if (result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }

        if (options.fromRetry) {
          setQrError(t.checkoutError);
        } else {
          setError(t.checkoutError);
        }
      } catch {
        if (options.fromRetry) {
          setQrError(t.checkoutError);
        } else {
          setError(t.checkoutError);
        }
      } finally {
        if (options.fromRetry) {
          setRetryingQr(false);
        } else {
          setPending(false);
        }
      }
    },
    [couponReasonMessage, onClose, refreshPlan, showToast, t]
  );

  const startPayment = async () => {
    if (!plan || plan.priceVnd <= 0 || pending) return;
    const effectiveCode = activeCoupon ? activeCoupon.code : code.trim() || undefined;
    await createPayosSession(plan, effectiveCode);
  };

  const retryExpiredPayment = async () => {
    const current = qrRef.current;
    if (!current || retryingQr) return;
    await createPayosSession(current.plan, current.couponCode ?? undefined, { fromRetry: true });
  };

  const copyTransferMemo = async () => {
    if (!qr) return;
    const memo = `ZC${String(qr.orderCode).slice(-7)}`;
    try {
      await navigator.clipboard.writeText(memo);
      setCopiedMemo(true);
      showToast('toastCopied');
      window.setTimeout(() => setCopiedMemo(false), 1800);
    } catch {
      showToast('toastCopyFailed');
    }
  };

  const forceCloseQr = useCallback(async () => {
    const current = qrRef.current;
    const wasExpired = qrExpiredRef.current;
    setConfirmCloseOpen(false);
    setQr(null);
    setQrExpired(false);
    setQrImgLoaded(false);
    setQrImgError(false);
    setQrError(null);
    if (current && !paidRef.current && !wasExpired) {
      await cancelBill(current.orderCode);
    }
    paidRef.current = false;
    expiredHandledRef.current = false;
    onClose();
  }, [cancelBill, onClose]);

  const handleQrBeforeClose = useCallback((): boolean => {
    if (qrRef.current && !qrExpiredRef.current && !paidRef.current) {
      setConfirmCloseOpen(true);
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    if (!qr || qrExpired) return;
    const tick = () => {
      const currentNow = Date.now();
      setNow(currentNow);
      if (currentNow >= qr.expiredAt && !paidRef.current && !expiredHandledRef.current) {
        expiredHandledRef.current = true;
        setConfirmCloseOpen(false);
        setQrExpired(true);
        void cancelBill(qr.orderCode);
      }
    };
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [qr, qrExpired, cancelBill]);

  useEffect(() => {
    if (!qr || qrExpired) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/payos/orders/${qr.orderCode}`, {
          cache: 'no-store',
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { status?: string };
        if (cancelled) return;
        if (body.status === 'PAID') {
          paidRef.current = true;
          setConfirmCloseOpen(false);
          setQr(null);
          setQrExpired(false);
          setQrError(null);
          showToast('toastPaymentSuccess');
          await refreshPlan();
          onClose();
        } else if (body.status === 'EXPIRED' || body.status === 'FAILED') {
          expiredHandledRef.current = true;
          setConfirmCloseOpen(false);
          setQrExpired(true);
        }
      } catch {
        // Transient network error: next poll retries.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [qr, qrExpired, showToast, refreshPlan, onClose]);

  const remaining = qr ? qr.expiredAt - now : 0;
  const discountedUsd =
    plan && activeCoupon
      ? ((Number(plan.priceUsd) * (100 - activeCoupon.percent)) / 100).toFixed(2)
      : null;

  return (
    <>
      <CheckoutSummaryModal
        isOpen={plan !== null && qr === null}
        plan={plan}
        code={code}
        appliedCoupon={appliedCoupon}
        activeCoupon={activeCoupon}
        discountedUsd={discountedUsd}
        couponLoading={couponLoading}
        couponError={couponError}
        pending={pending}
        granted={granted}
        error={error}
        onClose={onClose}
        onCodeChange={handleCodeChange}
        onApplyCoupon={() => void applyCoupon()}
        onRemoveCoupon={removeCoupon}
        onStartPayment={() => void startPayment()}
      />

      <CheckoutQrModal
        qr={qr}
        resolvedQrSrc={resolvedQrSrc}
        qrExpired={qrExpired}
        qrError={qrError}
        retryingQr={retryingQr}
        qrImgLoaded={qrImgLoaded}
        qrImgError={qrImgError}
        copiedMemo={copiedMemo}
        remaining={remaining}
        confirmCloseOpen={confirmCloseOpen}
        onBeforeClose={handleQrBeforeClose}
        onForceClose={() => void forceCloseQr()}
        onRetryExpired={() => void retryExpiredPayment()}
        onCopyMemo={() => void copyTransferMemo()}
        onImgLoad={() => setQrImgLoaded(true)}
        onImgError={() => setQrImgError(true)}
        onCancelConfirmClose={() => setConfirmCloseOpen(false)}
      />
    </>
  );
};
