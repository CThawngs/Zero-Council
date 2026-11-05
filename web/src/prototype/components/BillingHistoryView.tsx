import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, CheckCircle2, ReceiptText } from 'lucide-react';
import { planById, planPrice } from '../data/plans';

/**
 * The account's live plan (from /api/me via AppContext), not a static Free.
 * Cancel/downgrade lives here: Pro -> Free cancels; Ultra -> Pro revokes Ultra
 * and opens a fresh Pro checkout; Ultra -> Free cancels.
 */
export const BillingHistoryView: React.FC = () => {
  const { setCurrentView, goToPricing, currentPlanId, cancelPlanToFree, downgradeToPro, t, language } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const plan = planById(currentPlanId);

  const cancel = async () => {
    if (busy || !window.confirm(t.planCancelConfirm)) return;
    setBusy(true);
    setMessage('');
    const ok = await cancelPlanToFree();
    setBusy(false);
    if (ok) setMessage(t.planCancelled);
  };

  const downgrade = async () => {
    if (busy || !window.confirm(t.planDowngradeConfirm)) return;
    setBusy(true);
    const ok = await downgradeToPro();
    setBusy(false);
    if (!ok) setMessage('');
  };

  return (
    <div className="content-shell max-w-3xl space-y-7">
      <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3"><ArrowLeft className="h-4 w-4" />{t.back}</button>
      <header className="page-header"><p className="eyebrow"><span className="status-dot" />{t.localProfile}</p><h1>{t.billingTitle}</h1><p>{t.billingBody}</p></header>

      <section className="panel p-5 sm:p-7">
        <h2 className="panel-title">{plan.name}</h2>
        <p className="mt-2 font-serif text-2xl text-ink">{planPrice(plan, language)}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={goToPricing} className="button-secondary min-h-11">{t.pricingTitle}</button>
          {currentPlanId === 'ultra' && (
            <button type="button" onClick={downgrade} disabled={busy} className="button-secondary min-h-11 disabled:opacity-50">
              {t.planDowngradeToPro}
            </button>
          )}
          {currentPlanId !== 'free' && (
            <button type="button" onClick={cancel} disabled={busy} className="button-secondary min-h-11 disabled:opacity-50">
              {t.planCancelToFree}
            </button>
          )}
        </div>
        {message && (
          <div className="mt-4 flex gap-3 rounded-lg border border-sage/40 bg-sage/10 p-4 text-sm leading-relaxed text-ink" aria-live="polite">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
            <span>{message}</span>
          </div>
        )}
      </section>

      <section className="panel flex gap-4 p-5 sm:p-7"><ReceiptText className="h-6 w-6 shrink-0 text-brass" /><div><h2 className="font-serif text-xl text-ink">{t.billingEmpty}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.billingNote}</p></div></section>
    </div>
  );
};
