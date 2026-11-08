import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Loader2, Tag } from 'lucide-react';
import { planAmountLine, type Plan } from '../data/plans';
import { Modal } from './Modal';

interface CheckoutDrawerProps {
  plan: Plan | null;
  onClose: () => void;
}

interface QrPayment {
  orderCode: number;
  qrCode: string;
  expiredAt: number;
  amountVnd: number;
}

const BILL_TTL_MS = 5 * 60 * 1000;

const formatCountdown = (ms: number): string => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * payOS returns the VietQR code as a base64 PNG (or, on some responses, a URL).
 * Normalise both to an <img> src.
 */
const qrSrc = (qrCode: string): string =>
  qrCode.startsWith('http') || qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;

/**
 * PayOS checkout surface. The Amount block always states the integer VND the gateway charges;
 * USD is reference only, because no gateway in this build takes a USD charge.
 *
 * Once a bill exists, the VietQR code shows in a popup with a 5-minute countdown.
 * Closing that popup (X / backdrop / Esc) cancels the bill permanently; the countdown
 * reaching zero does the same. Paying again always creates a brand-new bill ID.
 */
export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({ plan, onClose }) => {
  const { t, language, showToast, refreshPlan } = useApp();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [granted, setGranted] = useState<string | null>(null);
  const [qr, setQr] = useState<QrPayment | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const qrRef = useRef<QrPayment | null>(null);
  useEffect(() => {
    qrRef.current = qr;
  }, [qr]);
  const paidRef = useRef(false);

  const cancelBill = useCallback(async (orderCode: number) => {
    try {
      await fetch(`/api/payos/orders/${orderCode}`, { method: 'POST' });
    } catch {
      // Best effort: the server sweeps stale orders on the next request anyway.
    }
  }, []);

  const startPayment = async () => {
    if (!plan || pending) return;
    setPending(true);
    setError(null);
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
      };
      if (!response.ok) throw new Error(t.checkoutError);
      // 100% coupon: plan granted instantly in-system, no payOS QR (avoids fee).
      if (!result.checkoutUrl && result.grantedUntil) {
        setGranted(result.grantedUntil);
        setPending(false);
        return;
      }
      if (!result.checkoutUrl) throw new Error(t.checkoutError);
      // payOS did not return a QR (older response shape): fall back to the hosted page link.
      if (!result.qrCode || !result.orderCode) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      paidRef.current = false;
      setQr({
        orderCode: result.orderCode,
        qrCode: result.qrCode,
        expiredAt: result.expiredAt ?? Date.now() + BILL_TTL_MS,
        amountVnd: result.amountVnd ?? plan.priceVnd,
      });
      setNow(Date.now());
      setPending(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.checkoutError);
      setPending(false);
    }
  };

  // Closing the QR popup = cancelling the bill (deleting the failed transaction).
  const closeQr = useCallback(async () => {
    const current = qrRef.current;
    setQr(null);
    if (current && !paidRef.current) {
      await cancelBill(current.orderCode);
    }
    paidRef.current = false;
  }, [cancelBill]);

  // Countdown tick + auto-cancel at zero.
  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [qr]);

  useEffect(() => {
    if (!qr) return;
    if (now < qr.expiredAt) return;
    // Hết 5 phút: vô hiệu hoá, hủy bill, đóng popup. Giao dịch không thành công bị xóa.
    void (async () => {
      await cancelBill(qr.orderCode);
      setQr(null);
      setQrExpired(true);
    })();
  }, [now, qr, cancelBill]);

  // Poll the order while the popup is open; a PAID webhook grants the plan before its 200.
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
        // Transient network failure: the next poll retries.
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
                <span className="ml-2 font-sans text-xs font-normal text-ink-muted">{t.planPerMonth}</span>
              </p>
              {/* EN-only: in this build nothing actually charges USD, so the EN reader must not think $ is the bill. */}
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
              onClick={startPayment}
              disabled={pending || plan.priceVnd <= 0}
              className="button-primary min-h-11 w-full justify-center disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {plan.priceVnd <= 0 ? t.planCurrent : t.checkoutPay}
            </button>

            {granted ? (
              <p role="status" className="rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-ink">
                {t.planActiveUntil ? `${t.planActiveUntil}: ${new Date(granted).toLocaleDateString()}` : 'Đã kích hoạt gói.'}
              </p>
            ) : null}
            {qrExpired ? (
              <p role="status" className="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-ink">
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

      <Modal
        isOpen={qr !== null}
        onClose={closeQr}
        title={t.checkoutQrTitle}
        description={t.checkoutQrBody}
        closeLabel={t.close}
      >
        {qr ? (
          <div className="flex flex-col items-center space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- qrCode is a dynamic VietQR data URI/URL, not a bundled asset next/image can optimise */}
            <img
              src={qrSrc(qr.qrCode)}
              alt={t.checkoutQrAlt.replace('{bill}', String(qr.orderCode))}
              className="h-64 w-64 rounded-xl border border-border bg-white object-contain"
            />
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="qr-amount">{t.checkoutQrAmount}</label>
                <input
                  id="qr-amount"
                  type="text"
                  readOnly
                  value={qr.amountVnd.toLocaleString('vi-VN') + ' ₫'}
                  className="cursor-not-allowed bg-surface-elevated opacity-70"
                />
              </div>
              <div className="field">
                <label htmlFor="qr-bill">{t.checkoutQrBill}</label>
                <input
                  id="qr-bill"
                  type="text"
                  readOnly
                  value={`ZC ${qr.orderCode}`}
                  className="cursor-not-allowed bg-surface-elevated opacity-70"
                />
              </div>
            </div>
            <p className="text-center text-xs text-muted">{t.checkoutQrLocked}</p>
            <p
              role="timer"
              aria-live="polite"
              className="font-serif text-2xl tabular-nums text-ink"
            >
              {t.checkoutQrExpires.replace('{time}', formatCountdown(remaining))}
            </p>
            <p className="text-xs leading-relaxed text-ink-muted">{t.checkoutQrCancelHint}</p>
          </div>
        ) : null}
      </Modal>
    </>
  );
};
