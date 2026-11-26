import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  Tag,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { planAmountLine, type Plan, type PlanId } from '../data/plans';
import { Modal } from './Modal';

interface CheckoutDrawerProps {
  plan: Plan | null;
  onClose: () => void;
}

interface AppliedCoupon {
  planId: PlanId;
  code: string;
  percent: number;
  originalVnd: number;
  discountedVnd: number;
  discountVnd: number;
}

interface QrSession {
  orderCode: number;
  qrCode: string;
  amountVnd: number;
  originalAmountVnd: number;
  couponCode: string | null;
  couponPercent: number;
  plan: Plan;
  planName: string;
  expiredAt: number;
  isDevSimulation?: boolean;
}

const BILL_TTL_MS = 5 * 60 * 1000;

const enNumber = new Intl.NumberFormat('en-US');

const formatVnd = (amountVnd: number): string => `₫${enNumber.format(amountVnd)}`;

const qrSrc = (qrCode: string): string => {
  if (qrCode.startsWith('data:') || qrCode.startsWith('http')) return qrCode;
  if (qrCode.startsWith('iVBOR')) return `data:image/png;base64,${qrCode}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(qrCode)}`;
};

const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({ plan, onClose }) => {
  const { t, language, showToast, refreshPlan } = useApp();
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

  // When a new/different plan is selected, reset coupon state so it never bleeds into another plan.
  if (plan && plan.id !== prevPlanId) {
    setPrevPlanId(plan.id);
    setCode('');
    setAppliedCoupon(null);
    setCouponError(null);
    setError(null);
    setQr(null);
    setQrExpired(false);
    setConfirmCloseOpen(false);
  }

  // Only treat a coupon as active when it belongs strictly to the currently selected plan.
  const activeCoupon =
    appliedCoupon && plan && appliedCoupon.planId === plan.id ? appliedCoupon : null;

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

      // Ignore stale responses if the user switched plans while validating.
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
          isDevSimulation?: boolean;
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
          } else if (result.error === 'PAYLOS_NOT_CONFIGURED') {
            message = t.checkoutPayosNotConfigured;
          } else if (result.error === 'PAYLOS_REJECTED') {
            message = localizePayosDesc(result.desc) || t.checkoutPayosRejected;
          } else if (result.desc) {
            message = localizePayosDesc(result.desc) || result.desc;
          }
          if (options.fromRetry) {
            setQrError(message);
          } else {
            if (result.error === 'COUPON_REJECTED') {
              setCouponError(message);
              setAppliedCoupon(null);
            } else {
              setError(message);
            }
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
          paidRef.current = false;
          expiredHandledRef.current = false;
          setQrExpired(false);
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
            isDevSimulation: Boolean((result as { isDevSimulation?: boolean }).isDevSimulation),
          });
          // DO NOT call onClose() here: keep the drawer open and display the QR payment modal!
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

  const forceCloseQr = useCallback(async () => {
    const current = qrRef.current;
    const wasExpired = qrExpiredRef.current;
    setConfirmCloseOpen(false);
    setQr(null);
    setQrExpired(false);
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

  // Countdown tick while QR is active and not yet expired.
  // When the 5-minute TTL elapses, cancel the old order on server/PayOS once and switch
  // the popup into the expired state with a "Pay again" button to generate a fresh QR code.
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

  // Poll PayOS order status while QR is active so the account plan upgrades automatically.
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

  return (
    <>
      {/* Step 1: Plan Checkout & Coupon Details Modal */}
      <Modal
        isOpen={plan !== null && qr === null}
        onClose={onClose}
        title={t.checkoutTitle}
        description={plan ? plan.name : undefined}
        closeLabel={t.close}
      >
        {plan ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-brass/40 bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  {t.checkoutAmountLabel}
                </p>
                {activeCoupon ? (
                  <span
                    id="checkout-discount-badge"
                    className="inline-flex items-center gap-1 rounded-full bg-sage/20 border border-sage/40 px-2.5 py-1 text-xs font-bold text-sage"
                  >
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {activeCoupon.code} −{activeCoupon.percent}%
                  </span>
                ) : null}
              </div>

              {activeCoupon ? (
                <div className="mt-3 space-y-2 rounded-lg bg-surface-2/60 p-3.5 border border-sage/30">
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{t.checkoutOriginalPrice}</span>
                    <span className="line-through">{planAmountLine(plan)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium text-sage">
                    <span>{t.checkoutDiscountLine}</span>
                    <span className="font-semibold">−{formatVnd(activeCoupon.discountVnd)} (−{activeCoupon.percent}%)</span>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex flex-wrap items-baseline justify-between gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                      {t.checkoutTotalToPay}
                    </span>
                    <p id="checkout-final-amount" className="font-serif text-3xl font-bold text-sage">
                      {formatVnd(activeCoupon.discountedVnd)}
                      <span className="ml-1.5 font-sans text-xs font-normal text-ink-muted">
                        {t.planPerMonth}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p id="checkout-final-amount" className="mt-2 font-serif text-3xl text-ink">
                  {planAmountLine(plan)}
                  <span className="ml-2 font-sans text-xs font-normal text-ink-muted">
                    {t.planPerMonth}
                  </span>
                </p>
              )}

              {language === 'en' ? (
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.checkoutUsdNote}</p>
              ) : null}
            </div>

            <section className="rounded-xl border border-border bg-background/60 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Tag className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
                {t.discountTitle}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                {t.checkoutDiscountPlanScope
                  .replace('{plan}', plan.name)
                  .replace('{price}', planAmountLine(plan))}
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="field min-w-0 flex-1">
                  <span className="sr-only">{t.discountTitle}</span>
                  <input
                    id="checkout-promo-input"
                    value={code}
                    onChange={(event) => {
                      const next = event.target.value;
                      setCode(next);
                      setCouponError(null);
                      if (
                        appliedCoupon &&
                        next.trim().toUpperCase() !== appliedCoupon.code.toUpperCase()
                      ) {
                        setAppliedCoupon(null);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void applyCoupon();
                      }
                    }}
                    placeholder={t.discountPlaceholder}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
                  />
                </label>
                {activeCoupon ? (
                  <button
                    type="button"
                    id="checkout-promo-remove-btn"
                    onClick={removeCoupon}
                    className="button-secondary w-full shrink-0 justify-center px-4 sm:w-auto"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    {t.discountRemove}
                  </button>
                ) : (
                  <button
                    type="button"
                    id="checkout-promo-apply-btn"
                    onClick={() => void applyCoupon()}
                    disabled={couponLoading || !code.trim()}
                    className="button-secondary w-full shrink-0 justify-center px-4 disabled:opacity-50 sm:w-auto"
                  >
                    {couponLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    {t.discountApply}
                  </button>
                )}
              </div>

              {activeCoupon ? (
                <div
                  role="status"
                  id="checkout-coupon-applied"
                  className="mt-3 flex items-start gap-2 rounded-lg bg-sage/10 p-2.5 text-xs font-medium text-sage border border-sage/20"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">
                      {t.checkoutDiscountAppliedBanner
                        .replace('{code}', activeCoupon.code)
                        .replace('{percent}', String(activeCoupon.percent))
                        .replace('{plan}', plan.name)}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {t.checkoutDiscountSavedBanner.replace('{amount}', formatVnd(activeCoupon.discountVnd))}
                    </p>
                  </div>
                </div>
              ) : null}

              {couponError ? (
                <p role="alert" id="checkout-coupon-error" className="mt-2 text-xs text-terracotta">
                  {couponError}
                </p>
              ) : null}

              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.discountNote}</p>
            </section>

            <button
              type="button"
              id="checkout-pay-btn"
              onClick={() => void startPayment()}
              disabled={pending || couponLoading || plan.priceVnd <= 0}
              className="button-primary min-h-11 w-full justify-center disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {plan.priceVnd <= 0
                ? t.planCurrent
                : activeCoupon && activeCoupon.discountedVnd === 0
                  ? t.checkoutActivateFree
                  : activeCoupon
                    ? `${t.checkoutPay} (${formatVnd(activeCoupon.discountedVnd)})`
                    : `${t.checkoutPay} (${formatVnd(plan.priceVnd)})`}
            </button>

            {granted ? (
              <p
                role="status"
                className="rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-ink"
              >
                {`${t.planActiveUntil}: ${new Date(granted).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}`}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs leading-relaxed text-terracotta">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Step 2: PayOS QRCode Payment & Auto Tracking Modal */}
      <Modal
        isOpen={qr !== null}
        onBeforeClose={handleQrBeforeClose}
        onClose={() => void forceCloseQr()}
        title={qrExpired ? t.checkoutQrExpiredTitle : t.checkoutQrTitle}
        description={qrExpired ? undefined : t.checkoutQrBody}
        closeLabel={t.close}
      >
        {qr ? (
          <div className="flex flex-col items-center space-y-4">
            {qrExpired ? (
              <div
                id="qr-expired-state"
                role="status"
                className="flex w-full flex-col items-center space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <Clock className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-ink">{t.checkoutQrExpiredTitle}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{t.checkoutQrExpired}</p>
                </div>

                {qrError ? (
                  <p role="alert" className="text-xs leading-relaxed text-terracotta">
                    {qrError}
                  </p>
                ) : null}

                <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row">
                  <button
                    type="button"
                    id="qr-retry-pay-btn"
                    onClick={() => void retryExpiredPayment()}
                    disabled={retryingQr}
                    className="button-primary min-h-11 flex-1 justify-center disabled:opacity-60"
                  >
                    {retryingQr ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t.checkoutQrPayAgain}
                  </button>
                  <button
                    type="button"
                    onClick={() => void forceCloseQr()}
                    className="button-secondary min-h-11 justify-center px-5"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  id="qr-code-image"
                  src={qrSrc(qr.qrCode)}
                  alt={t.checkoutQrAlt.replace('{bill}', String(qr.orderCode))}
                  className="h-52 w-52 rounded-xl border border-border bg-white object-contain p-2 shadow-md sm:h-60 sm:w-60"
                />

                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <div className="field">
                    <label htmlFor="qr-plan" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrPlan}
                    </label>
                    <input
                      id="qr-plan"
                      type="text"
                      disabled
                      readOnly
                      value={qr.planName}
                      className="cursor-not-allowed bg-surface-2 opacity-75 font-semibold text-ink"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="qr-order-id" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrOrderId}
                    </label>
                    <input
                      id="qr-order-id"
                      type="text"
                      disabled
                      readOnly
                      value={`#${qr.orderCode}`}
                      className="cursor-not-allowed font-mono bg-surface-2 opacity-75 text-ink"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="qr-amount" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrAmount}
                    </label>
                    <input
                      id="qr-amount"
                      type="text"
                      disabled
                      readOnly
                      value={
                        qr.couponPercent > 0
                          ? t.checkoutQrAmountDiscount
                              .replace('{amount}', `${qr.amountVnd.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ₫`)
                              .replace('{percent}', String(qr.couponPercent))
                              .replace('{original}', `${qr.originalAmountVnd.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ₫`)
                          : `${qr.amountVnd.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ₫`
                      }
                      className="cursor-not-allowed font-semibold bg-surface-2 text-sage"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="qr-bill" className="field-label flex items-center gap-1">
                      <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                      {t.checkoutQrBill}
                    </label>
                    <input
                      id="qr-bill"
                      type="text"
                      disabled
                      readOnly
                      value={`ZC${String(qr.orderCode).slice(-7)}`}
                      className="cursor-not-allowed font-mono bg-surface-2 opacity-75 text-ink"
                    />
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface-2/80 px-4 py-2">
                  <span className="text-xs text-ink-muted">{t.checkoutQrRemainingLabel}</span>
                  <p
                    role="timer"
                    aria-live="polite"
                    className="font-serif text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400"
                  >
                    {formatCountdown(remaining)}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-center text-xs text-sage py-1">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sage" aria-hidden="true" />
                  <span>{t.checkoutQrAutoTracking}</span>
                </div>

                <p className="text-center text-xs leading-relaxed text-ink-muted">
                  {t.checkoutQrCancelHint}
                </p>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Step 3: Confirm Close Active QR Popup */}
      <Modal
        isOpen={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        title={t.checkoutQrConfirmCloseTitle}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              id="qr-confirm-keep-btn"
              onClick={() => setConfirmCloseOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.checkoutQrConfirmKeep}
            </button>
            <button
              type="button"
              id="qr-confirm-discard-btn"
              onClick={() => void forceCloseQr()}
              className="button-danger min-h-11 justify-center"
            >
              {t.checkoutQrConfirmDiscard}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-ink-muted">
            {t.checkoutQrConfirmCloseBody}
          </p>
        </div>
      </Modal>
    </>
  );
};
