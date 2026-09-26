'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type OrderState = {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  planId: string;
  amountVnd: number;
  amountUsd: string;
};

const copy = {
  en: {
    pending: 'Waiting for payOS to confirm',
    pendingBody: 'payOS is confirming the transfer. This page updates itself — no refresh needed.',
    paid: 'Payment received',
    paidBody:
      'payOS confirmed the transfer. This build has no account system yet, so the plan is not attached to anything.',
    failed: 'Payment not completed',
    failedBody: 'Nothing was charged. You can start the payment again from the pricing page.',
    back: 'Back to Zero Council',
    code: 'Order',
  },
  vi: {
    pending: 'Đang chờ payOS xác nhận',
    pendingBody: 'payOS đang xác nhận giao dịch chuyển khoản. Trang này tự cập nhật, không cần tải lại.',
    paid: 'Đã nhận thanh toán',
    paidBody: 'payOS đã xác nhận giao dịch. Bản này chưa có hệ thống tài khoản nên gói chưa được gắn vào đâu cả.',
    failed: 'Thanh toán chưa hoàn tất',
    failedBody: 'Không có khoản tiền nào bị trừ. Bạn có thể thanh toán lại từ trang Giá.',
    back: 'Về Zero Council',
    code: 'Mã đơn',
  },
} as const;

// Same grouping as plans.ts `planAmountLine` so the number a buyer paid reads identically here.
const number = new Intl.NumberFormat('en-US');

function PaymentResult() {
  const params = useSearchParams();
  const orderCode = params.get('orderCode');
  const [language, setLanguage] = useState<'en' | 'vi'>('vi');
  const [order, setOrder] = useState<OrderState | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const missing = lookupFailed || !orderCode;
  const text = copy[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === 'vi' ? 'Zero Council — Kết quả thanh toán' : 'Zero Council — Payment result';
  }, [language]);

  useEffect(() => {
    if (!orderCode) return;
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
    poll();
    return () => {
      active = false;
    };
  }, [orderCode]);

  const headline = missing
    ? text.failed
    : order?.status === 'PAID'
      ? text.paid
      : order?.status === 'PENDING'
        ? text.pending
        : text.failed;
  const body = missing
    ? text.failedBody
    : order?.status === 'PAID'
      ? text.paidBody
      : order?.status === 'PENDING'
        ? text.pendingBody
        : text.failedBody;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-5 py-16">
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-full border border-border p-1" role="group" aria-label="Language">
          {(['vi', 'en'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={language === item}
              onClick={() => setLanguage(item)}
              className={`min-h-11 rounded-full px-3 text-sm transition ${language === item ? 'bg-brass text-white' : 'text-ink-muted hover:text-ink'}`}
            >
              {item === 'en' ? 'English' : 'Tiếng Việt'}
            </button>
          ))}
        </div>
      </div>

      <section className="panel space-y-4 p-6 sm:p-8">
        <p className="eyebrow">
          <span className="status-dot" />
          {text.code} {orderCode ?? '—'}
        </p>
        <h1 className="font-serif text-3xl text-ink">{headline}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        {order && order.amountVnd > 0 ? (
          <p className="border-t border-border pt-4 font-serif text-2xl text-ink">
            ₫{number.format(order.amountVnd)} (~${order.amountUsd})
          </p>
        ) : null}
        <Link href="/" className="button-primary mt-2 min-h-11 justify-center">
          {text.back}
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
