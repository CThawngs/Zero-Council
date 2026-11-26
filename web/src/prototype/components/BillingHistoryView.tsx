import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, ReceiptText, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { PlanGrid } from './PlanGrid';
import type { Plan } from '../data/plans';

interface OrderHistoryItem {
  orderCode: number;
  planId: string;
  amountVnd: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface GrantHistoryItem {
  id: string;
  planId: string;
  source: string;
  startsAt: string;
  expiresAt: string;
}

interface BillingHistorySnapshot {
  key: string;
  orders: OrderHistoryItem[];
  grants: GrantHistoryItem[];
  error: boolean;
}

export const BillingHistoryView: React.FC = () => {
  const {
    requestCheckout,
    currentPlanId,
    cancelPlanToFree,
    downgradeToPro,
    authUser,
    language,
    t,
  } = useApp();
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const formatGrantSource = (source: string) =>
    source === 'PAYOS'
      ? t.billingSourcePayos
      : source === 'COUPON'
        ? t.billingSourceCoupon
        : source === 'ADMIN'
          ? t.billingSourceAdmin
          : source;

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [downgradeConfirmOpen, setDowngradeConfirmOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [snapshot, setSnapshot] = useState<BillingHistorySnapshot | null>(null);

  const requestKey = authUser ? `${authUser.id}:${currentPlanId}:${reloadNonce}` : null;

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    void fetch('/api/orders', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        return (await res.json()) as {
          orders?: OrderHistoryItem[];
          grants?: GrantHistoryItem[];
        };
      })
      .then((body) => {
        if (cancelled) return;
        setSnapshot({
          key: requestKey,
          orders: body.orders ?? [],
          grants: body.grants ?? [],
          error: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot((prev) => ({
          key: requestKey,
          orders: prev?.orders ?? [],
          grants: prev?.grants ?? [],
          error: true,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = Boolean(requestKey && snapshot?.key !== requestKey);
  const loadError = Boolean(requestKey && snapshot?.key === requestKey && snapshot.error);
  const orders = snapshot?.orders ?? [];
  const grants = snapshot?.grants ?? [];

  const doCancel = async () => {
    setBusy(true);
    setMessage('');
    const ok = await cancelPlanToFree();
    setBusy(false);
    if (ok) setMessage(t.planCancelled);
  };

  const doDowngrade = async () => {
    setBusy(true);
    const ok = await downgradeToPro();
    setBusy(false);
    if (!ok) setMessage('');
  };

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === currentPlanId || busy) return;
    if (plan.id === 'free') {
      setCancelConfirmOpen(true);
      return;
    }
    if (plan.id === 'pro' && currentPlanId === 'ultra') {
      setDowngradeConfirmOpen(true);
      return;
    }
    requestCheckout(plan);
  };

  const paidOrders = orders.filter((o) => o.status === 'PAID');

  return (
    <div className="content-shell space-y-7">
      <header className="page-header">
        <h2 className="text-3xl">{t.billingTitle}</h2>
        <p>{t.billingBody}</p>
      </header>

      <PlanGrid
        busy={busy}
        onSelectPlan={handleSelectPlan}
        getButtonId={(plan, isCurrent) => {
          if (isCurrent) return undefined;
          if (plan.id === 'free') return 'billing-cancel-free-btn';
          if (plan.id === 'pro' && currentPlanId === 'ultra') return 'billing-downgrade-pro-btn';
          return undefined;
        }}
        getButtonLabel={(plan, isCurrent) => {
          if (!isCurrent && plan.id === 'pro' && currentPlanId === 'ultra') {
            return t.planDowngradeToPro;
          }
          return undefined;
        }}
        statusMessage={message || undefined}
      />

      {loading ? (
        <section
          role="status"
          aria-busy="true"
          className="panel animate-pulse space-y-4 p-5 sm:p-7"
        >
          <div className="h-5 w-48 rounded-md border border-border/60 bg-surface-2" />
          <div className="space-y-2.5">
            <div className="h-12 w-full rounded-xl border border-border/60 bg-surface-2" />
            <div className="h-12 w-full rounded-xl border border-border/60 bg-surface-2" />
          </div>
        </section>
      ) : loadError ? (
        <section
          role="alert"
          className="panel flex flex-col items-start justify-between gap-4 border-terracotta/40 bg-terracotta/5 p-5 sm:flex-row sm:items-center sm:p-6"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden="true" />
            <p className="text-sm font-medium text-ink">{t.billingLoadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="button-secondary min-h-10 shrink-0 px-4 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t.billingRetry}
          </button>
        </section>
      ) : paidOrders.length === 0 && grants.length === 0 ? (
        <section className="panel flex gap-4 p-5 sm:p-7">
          <ReceiptText className="h-6 w-6 shrink-0 text-brass" aria-hidden="true" />
          <div>
            <h2 className="font-serif text-xl text-ink">{t.billingEmpty}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.billingNote}</p>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {paidOrders.length > 0 && (
            <section className="panel space-y-3 p-5 sm:p-6">
              <h2 className="font-serif text-xl text-ink">{t.billingHistoryHeading}</h2>
              <ul className="divide-y divide-border text-sm">
                {paidOrders.map((order) => (
                  <li
                    key={order.orderCode}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        #{order.orderCode} · {order.planId.toUpperCase()}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {new Date(order.paidAt ?? order.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {order.amountVnd.toLocaleString(locale)} ₫
                      </span>
                      <span className="badge-success">{t.billingOrderPaid}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {grants.length > 0 && (
            <section className="panel space-y-3 p-5 sm:p-6">
              <h2 className="font-serif text-xl text-ink">{t.billingGrantsHeading}</h2>
              <ul className="divide-y divide-border text-sm">
                {grants.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {g.planId.toUpperCase()} ({formatGrantSource(g.source)})
                      </p>
                      <p className="text-xs text-ink-muted">
                        {new Date(g.startsAt).toLocaleDateString(locale)} →{' '}
                        {new Date(g.expiresAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Cancel-to-free confirmation */}
      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title={t.planCancelToFree}
        description={t.planCancelConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setCancelConfirmOpen(false);
                await doCancel();
              }}
              className="button-danger min-h-11 justify-center disabled:opacity-50"
            >
              {t.planCancelToFree}
            </button>
          </>
        }
      />

      {/* Downgrade-to-pro confirmation */}
      <Modal
        isOpen={downgradeConfirmOpen}
        onClose={() => setDowngradeConfirmOpen(false)}
        title={t.planDowngradeToPro}
        description={t.planDowngradeConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDowngradeConfirmOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setDowngradeConfirmOpen(false);
                await doDowngrade();
              }}
              className="button-danger min-h-11 justify-center disabled:opacity-50"
            >
              {t.planDowngradeToPro}
            </button>
          </>
        }
      />
    </div>
  );
};
