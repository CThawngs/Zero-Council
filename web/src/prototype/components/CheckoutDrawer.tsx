import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Lock, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { planAmountLine, type Plan } from '../data/plans';
import { Modal } from './Modal';

interface CheckoutDrawerProps {
  plan: Plan | null;
  onClose: () => void;
}

interface QrSession {
  orderCode: number;
  qrCode: string;
  amountVnd: number;
  planName: string;
  expiredAt: number;
}

const BILL_TTL_MS = 5 * 60 * 1000;

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string | null>(null);
  const [qr, setQr] = useState<QrSession | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const qrRef = useRef<QrSession | null>(null);
  useEffect(() => {
    qrRef.current = qr;
  }, [qr]);
  const paidRef = useRef(false);

  const cancelBill = useCallback(async (orderCode: number) => {
    try {
      await fetch(`/api/payos/orders/${orderCode}`, { method: 'POST' });
    } catch {
      // Best-effort cleanup; server sweeps stale orders automatically.
    }
  }, []);

  const startPayment = async () => {
    if (!plan || plan.priceVnd <= 0 || pending) return;
    setPending(true);
    setError(null);
    setGranted(null);
    setQrExpired(false);
    try {
      const response = await fetch('/api/payos/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, code: code.trim() || undefined }),
      });
      const result = (await response.json()) as {
        orderCode?: number;
        amountVnd?: number;
        checkoutUrl?: string | null;
        qrCode?: string | null;
        expiredAt?: number;
        grantedUntil?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(t.checkoutError);
        setPending(false);
        return;
      }
      if (!result.checkoutUrl && result.grantedUntil) {
        setGranted(result.grantedUntil);
        setPending(false);
        showToast('toastPaymentSuccess');
        await refreshPlan();
        return;
      }
      if (result.qrCode && typeof result.orderCode === 'number') {
        const rawExp = result.expiredAt ?? Date.now() + BILL_TTL_MS;
        const expMs = rawExp < 10_000_000_000 ? rawExp * 1000 : rawExp;
        paidRef.current = false;
        setNow(Date.now());
        setQr({
          orderCode: result.orderCode,
          qrCode: result.qrCode,
          amountVnd: typeof result.amountVnd === 'number' ? result.amountVnd : plan.priceVnd,
          planName: plan.name,
          expiredAt: expMs,
        });
        setPending(false);
        onClose();
        return;
      }
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setError(t.checkoutError);
      setPending(false);
    } catch {
      setError(t.checkoutError);
      setPending(false);
    }
  };

  const closeQr = useCallback(async () => {
    const current = qrRef.current;
    setQr(null);
    if (current && !paidRef.current) {
      await cancelBill(current.orderCode);
    }
    paidRef.current = false;
  }, [cancelBill]);

  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [qr]);

  useEffect(() => {
    if (!qr) return;
    if (now < qr.expiredAt) return;
    void (async () => {
      await cancelBill(qr.orderCode);
      setQr(null);
      setQrExpired(true);
    })();
  }, [now, qr, cancelBill]);

  useEffect(() => {
    if (!qr) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/payos/orders/${qr.orderCode}`);
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { status?: string };
        if (body.status === 'PAID' && !cancelled) {
          paidRef.current = true;
          setQr(null);
          showToast('toastPaymentSuccess');
          await refreshPlan();
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
  }, [qr, showToast, refreshPlan]);

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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {t.checkoutAmountLabel}
              </p>
              <p className="mt-2 font-serif text-3xl text-ink">
                {planAmountLine(plan)}
                <span className="ml-2 font-sans text-xs font-normal text-ink-muted">
                  {t.planPerMonth}
                </span>
              </p>
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
              <label className="field mt-3">
                <span className="sr-only">{t.discountTitle}</span>
                <input
                  id="checkout-promo-input"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={t.discountPlaceholder}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
                />
              </label>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.discountNote}</p>
            </section>

            <button
              type="button"
              id="checkout-pay-btn"
              onClick={startPayment}
              disabled={pending || plan.priceVnd <= 0}
              className="button-primary min-h-11 w-full justify-center disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {plan.priceVnd <= 0 ? t.planCurrent : t.checkoutPay}
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
            {qrExpired ? (
              <p
                role="status"
                className="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-ink"
              >
                {t.checkoutQrExpired}
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

      {/* Locked QR Payment Popup */}
      <Modal
        isOpen={qr !== null}
        onClose={closeQr}
        title={t.checkoutQrTitle}
        description={t.checkoutQrBody}
        closeLabel={t.close}
      >
        {qr ? (
          <div className="flex flex-col items-center space-y-4">
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
                  value={qr.amountVnd.toLocaleString('vi-VN') + ' ₫'}
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
            <p className="text-center text-xs leading-relaxed text-ink-muted">
              {t.checkoutQrCancelHint}
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
};
