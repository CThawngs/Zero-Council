'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '@/prototype/context/AppContext';

type OrderState = {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  planId: string;
  amountVnd: number;
  amountUsd: string;
};

// Same grouping as plans.ts `planAmountLine` so the number a buyer paid reads identically here.
const number = new Intl.NumberFormat('en-US');

function PaymentResult() {
  const params = useSearchParams();
  const orderCode = params.get('orderCode');
  const { language, setLanguage, theme, toggleTheme, t } = useApp();
  const [order, setOrder] = useState<OrderState | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const missing = lookupFailed || !orderCode;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.paymentReturnTitle;
  }, [language, t.paymentReturnTitle]);

  useEffect(() => {
    if (!orderCode) return;
    // payOS cancel lands here with `status=cancelled`; nothing was charged, stop polling.
    if (params.get('status') === 'cancelled') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot cancelled guard, before polling starts
      setLookupFailed(true);
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/payos/orders/${orderCode}`, { cache: 'no-store' });
        if (!response.ok) {
          if (active) setLookupFailed(true);
          return;
        }
        const next = (await response.json()) as OrderState;
        if (!active) return;
        setOrder(next);
        // payOS may confirm the transfer after the buyer lands back here, so keep asking.
        if (next.status === 'PENDING') setTimeout(poll, 3000);
      } catch {
        if (active) setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      active = false;
    };
  }, [orderCode, params]);
  const paid = !missing && order?.status === 'PAID';

  const headline = missing
    ? t.paymentFailed
    : order?.status === 'PAID'
      ? t.paymentPaid
      : order?.status === 'PENDING'
        ? t.paymentPending
        : t.paymentFailed;
  const body = missing
    ? t.paymentFailedBody
    : order?.status === 'PAID'
      ? t.paymentPaidBody
      : order?.status === 'PENDING'
        ? t.paymentPendingBody
        : t.paymentFailedBody;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-5 py-16">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border p-1" role="group" aria-label={t.language}>
          {(['vi', 'en'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={language === item}
              onClick={() => void setLanguage(item)}
              className={`min-h-11 rounded-full px-3 text-sm font-semibold transition ${language === item ? 'bg-brass text-accent-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {item === 'en' ? 'English' : 'Tiếng Việt'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}
          title={theme === 'dark' ? t.themeToLight : t.themeToDark}
          className="icon-button min-w-11 px-3"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <section className="panel space-y-4 p-6 sm:p-8">
        <p className="eyebrow">
          <span className="status-dot" />
          {t.paymentOrderCode} {orderCode ?? '—'}
        </p>
        <h1 className="font-serif text-3xl text-ink">{headline}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        {order && order.amountVnd > 0 ? (
          <p className="border-t border-border pt-4 font-serif text-2xl text-ink">
            ₫{number.format(order.amountVnd)} (~${order.amountUsd})
          </p>
        ) : null}
        <Link href={paid ? '/?paid=1' : '/'} className="button-primary mt-2 min-h-11 justify-center">
          {t.paymentBack}
        </Link>
      </section>
    </main>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResult />
    </Suspense>
  );
}
