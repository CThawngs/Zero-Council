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

  // Reset coupon & checkout state whenever the selected plan changes so a coupon
  // activated on one plan (e.g. Pro) never bleeds into another plan (e.g. Ultra).
  if ((plan?.id ?? null) !== prevPlanId) {
    setPrevPlanId(plan?.id ?? null);
    setCode('');
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponLoading(false);
    setError(null);
    setGranted(null);
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
        planId?: PlanId;
        code?: string;
        percent?: number;
        originalVnd?: number;
        discountedVnd?: number;
        discountVnd?: number;
        reason?: string;
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
          reason?: string;
        };

        if (!response.ok) {
          const message =
            result.error === 'COUPON_REJECTED'
              ? couponReasonMessage(result.reason)
              : t.checkoutError;
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
          return;
        }

        if (result.qrCode && typeof result.orderCode === 'number') {
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
            qrCode: result.qrCode,
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
          if (!options.fromRetry) {
            onClose();
          }
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
    [couponReasonMessage, onClose, refreshPlan, showToast, t.checkoutError]
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
  }, [cancelBill]);

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
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [qr, qrExpired, showToast, refreshPlan]);

  const remaining = qr ? qr.expiredAt - now : 0;

  return (
    <>
      <Modal
        isOpen={plan !== null}
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
                    className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2.5 py-0.5 text-xs font-semibold text-sage"
                  >
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {activeCoupon.code} −{activeCoupon.percent}%
                  </span>
                ) : null}
              </div>

              {activeCoupon ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-ink-muted line-through">
                    {planAmountLine(plan)}
                  </p>
                  <p id="checkout-final-amount" className="font-serif text-3xl text-ink">
                    {formatVnd(activeCoupon.discountedVnd)}
                    <span className="ml-2 font-sans text-xs font-normal text-ink-muted">
                      {t.planPerMonth}
                    </span>
                  </p>
                  <p className="text-xs font-medium text-sage">
                    {t.discountSaved.replace('{amount}', formatVnd(activeCoupon.discountVnd))}
                  </p>
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
                {t.discountBody.replace('{amount}', planAmountLine(plan))}
              </p>

              <div className="mt-3 flex gap-2">
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
                    id="checkout-remove-coupon-btn"
                    onClick={removeCoupon}
                    className="button-secondary min-h-11 shrink-0 justify-center px-4 text-xs"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.discountRemove}
                  </button>
                ) : (
                  <button
                    type="button"
                    id="checkout-apply-coupon-btn"
                    onClick={() => void applyCoupon()}
                    disabled={couponLoading || !code.trim()}
                    className="button-secondary min-h-11 shrink-0 justify-center px-4 text-xs disabled:opacity-50"
                  >
                    {couponLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    {t.discountApply}
                  </button>
                )}
              </div>

              {activeCoupon ? (
                <p
                  role="status"
                  id="checkout-coupon-applied"
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-sage"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t.discountApplied
                    .replace('{code}', activeCoupon.code)
                    .replace('{percent}', String(activeCoupon.percent))
                    .replace('{plan}', plan.name)}
                </p>
              ) : null}

              {couponError ? (
                <p role="alert" id="checkout-coupon-error" className="mt-2 text-xs text-red-400">
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
                  : t.checkoutPay}
            </button>

            {granted ? (
              <p
                role="status"
                className="rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-ink"
              >
                {t.planActiveUntil
                  ? `${t.planActiveUntil}: ${new Date(granted).toLocaleDateString()}`
                  : 'Đã kích hoạt gói.'}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs leading-relaxed text-red-400">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Locked PayOS QR Payment Popup */}
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
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                  <Clock className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-ink">{t.checkoutQrExpiredTitle}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{t.checkoutQrExpired}</p>
                </div>

                {qrError ? (
                  <p role="alert" className="text-xs leading-relaxed text-red-400">
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
                  className="h-60 w-60 rounded-xl border border-border bg-white object-contain p-2"
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
                      className="cursor-not-allowed bg-surface-2 opacity-75"
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
                      className="cursor-not-allowed font-mono bg-surface-2 opacity-75"
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
                          ? `${qr.amountVnd.toLocaleString('vi-VN')} ₫ (−${qr.couponPercent}%)`
                          : `${qr.amountVnd.toLocaleString('vi-VN')} ₫`
                      }
                      className="cursor-not-allowed font-semibold bg-surface-2 opacity-75"
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
                      value={`ZC ${qr.orderCode}`}
                      className="cursor-not-allowed font-mono bg-surface-2 opacity-75"
                    />
                  </div>
                </div>

                <p className="flex items-center gap-1.5 text-center text-xs text-ink-muted">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                  {t.checkoutQrLocked}
                </p>

                <p
                  role="timer"
                  aria-live="polite"
                  className="font-serif text-2xl tabular-nums text-ink"
                >
                  {t.checkoutQrExpires.replace('{time}', formatCountdown(remaining))}
                </p>

                <p className="flex items-center gap-1.5 text-center text-xs text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brass" aria-hidden="true" />
                  {t.checkoutQrChecking}
                </p>

                <p className="text-center text-xs leading-relaxed text-ink-muted">
                  {t.checkoutQrCancelHint}
                </p>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Confirm Close Active QR Popup */}
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
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
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
