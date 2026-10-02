import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { planById, planPrice } from '../data/plans';

/** No billing backend exists yet, so the account sits on Free and the invoice list is genuinely empty. */
const CURRENT_PLAN = planById('free');

export const BillingHistoryView: React.FC = () => {
  const { setCurrentView, t, language } = useApp();
  return (
    <div className="content-shell max-w-3xl space-y-7">
      <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3"><ArrowLeft className="h-4 w-4" />{t.back}</button>
      <header className="page-header"><p className="eyebrow"><span className="status-dot" />{t.localProfile}</p><h1>{t.billingTitle}</h1><p>{t.billingBody}</p></header>

      <section className="panel p-5 sm:p-7">
        <h2 className="panel-title">{CURRENT_PLAN.name}</h2>
        <p className="mt-2 font-serif text-2xl text-ink">{planPrice(CURRENT_PLAN, language)}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t.planAdvisors.replace('{count}', String(CURRENT_PLAN.maxActiveAdvisors))}
        </p>
        <button type="button" onClick={() => setCurrentView('pricing')} className="button-secondary mt-5 min-h-11">{t.pricingTitle}</button>
      </section>

      <section className="panel flex gap-4 p-5 sm:p-7"><ReceiptText className="h-6 w-6 shrink-0 text-brass" /><div><h2 className="font-serif text-xl text-ink">{t.billingEmpty}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.billingNote}</p></div></section>
    </div>
  );
};
