import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, CheckCircle2, ReceiptText } from 'lucide-react';
import { Modal } from './Modal';
import { planById, planPrice } from '../data/plans';

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

export const BillingHistoryView: React.FC = () => {
  const {
    setCurrentView,
    goToPricing,
    currentPlanId,
    planExpiresAt,
    cancelPlanToFree,
    downgradeToPro,
    authUser,
    t,
    language,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [downgradeConfirmOpen, setDowngradeConfirmOpen] = useState(false);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [grants, setGrants] = useState<GrantHistoryItem[]>([]);
  const plan = planById(currentPlanId);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    void fetch('/api/orders', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          body: { orders?: OrderHistoryItem[]; grants?: GrantHistoryItem[] } | null
        ) => {
          if (cancelled || !body) return;
          setOrders(body.orders ?? []);
          setGrants(body.grants ?? []);
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser, currentPlanId]);

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

  const paidOrders = orders.filter((o) => o.status === 'PAID');

  return (
    <div className="content-shell max-w-3xl space-y-7">
      <button
        type="button"
        onClick={() =>
          setCurrentView(
            typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')
              ? 'settings'
              : 'overview'
          )
        }
        className="button-quiet -ml-3"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </button>

      <header className="page-header">
        <p className="eyebrow">
          <span className="status-dot" />
          {t.localProfile}
        </p>
        <h1>{t.billingTitle}</h1>
        <p>{t.billingBody}</p>
      </header>

      <section className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="panel-title">{plan.name}</h2>
          <span className="badge-success">{t.planCurrent}</span>
        </div>
        <p className="mt-2 font-serif text-2xl text-ink">{planPrice(plan, language)}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))} ·{' '}
          {`${plan.maxBots} bots`}
        </p>

        {currentPlanId !== 'free' && planExpiresAt && (
          <p className="mt-2 text-xs font-medium text-brass">
            {t.billingActiveExpires.replace(
              '{date}',
              new Date(planExpiresAt).toLocaleDateString()
            )}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={goToPricing} className="button-secondary min-h-11">
            {t.pricingTitle}
          </button>
          {currentPlanId === 'ultra' && (
            <button
              type="button"
              id="billing-downgrade-pro-btn"
              onClick={() => setDowngradeConfirmOpen(true)}
              disabled={busy}
              className="button-secondary min-h-11 disabled:opacity-50"
            >
              {t.planDowngradeToPro}
            </button>
          )}
          {currentPlanId !== 'free' && (
            <button
              type="button"
              id="billing-cancel-free-btn"
              onClick={() => setCancelConfirmOpen(true)}
              disabled={busy}
              className="button-secondary min-h-11 disabled:opacity-50"
            >
              {t.planCancelToFree}
            </button>
          )}
        </div>

        {message && (
          <div
            className="mt-4 flex gap-3 rounded-lg border border-sage/40 bg-sage/10 p-4 text-sm leading-relaxed text-ink"
            aria-live="polite"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
            <span>{message}</span>
          </div>
        )}
      </section>

      {paidOrders.length === 0 && grants.length === 0 ? (
        <section className="panel flex gap-4 p-5 sm:p-7">
          <ReceiptText className="h-6 w-6 shrink-0 text-brass" />
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
                        {new Date(order.paidAt ?? order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {order.amountVnd.toLocaleString('vi-VN')} ₫
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
                        {g.planId.toUpperCase()} ({g.source})
                      </p>
                      <p className="text-xs text-ink-muted">
                        {new Date(g.startsAt).toLocaleDateString()} →{' '}
                        {new Date(g.expiresAt).toLocaleDateString()}
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
              onClick={async () => { setCancelConfirmOpen(false); await doCancel(); }}
              className="button-danger min-h-11 justify-center disabled:opacity-50"
            >
              {t.planCancelToFree}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.planCancelConfirm}</p>
      </Modal>

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
              onClick={async () => { setDowngradeConfirmOpen(false); await doDowngrade(); }}
              className="button-danger min-h-11 justify-center disabled:opacity-50"
            >
              {t.planDowngradeToPro}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.planDowngradeConfirm}</p>
      </Modal>
    </div>
  );
};
