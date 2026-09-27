import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Loader2, Tag } from 'lucide-react';
import { planAmountLine, type Plan } from '../data/plans';
import { Modal } from './Modal';

interface CheckoutDrawerProps {
  plan: Plan | null;
  onClose: () => void;
}

/**
 * PayOS checkout surface. The Amount block always states the integer VND the gateway charges;
 * USD is reference only, because no gateway in this build takes a USD charge.
 */
export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({ plan, onClose }) => {
  const { t, language } = useApp();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPayment = async () => {
    if (!plan || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/payos/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, code: code.trim() || undefined }),
      });
      const result = (await response.json()) as { checkoutUrl?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(t.checkoutError);
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.checkoutError);
      setPending(false);
    }
  };

  return (
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

          {error ? (
            <p role="alert" className="text-xs leading-relaxed text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
};
