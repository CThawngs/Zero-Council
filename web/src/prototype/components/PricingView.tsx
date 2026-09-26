import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { PLANS, planPrice, type Plan } from '../data/plans';
import { CheckoutDrawer } from './CheckoutDrawer';

export const PricingView: React.FC = () => {
  const { setCurrentView, t, language } = useApp();
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  return (
    <div className="content-shell max-w-5xl space-y-8">
      <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3">
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </button>

      <header className="page-header">
        <p className="eyebrow">
          <span className="status-dot" />
          {t.whyEyebrow}
        </p>
        <h1>{t.pricingTitle}</h1>
        <p>{t.pricingBody}</p>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`panel flex flex-col gap-4 ${plan.popular ? 'border-brass/60 shadow-[0_0_0_1px_rgba(201,162,75,0.35)]' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="panel-title">{plan.name}</h2>
              {plan.popular ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-brass/40 bg-brass/10 px-2 py-0.5 text-[10px] font-semibold text-brass">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {t.selected}
                </span>
              ) : null}
            </div>

            <p className="font-serif text-3xl text-ink">{planPrice(plan, language)}</p>

            <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
              {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))}
            </p>

            <button
              type="button"
              onClick={() => setCheckoutPlan(plan)}
              className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg border border-brass/45 px-4 py-2.5 text-sm font-semibold text-brass transition hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {t.planChoose.replace('{plan}', plan.name)}
            </button>
          </article>
        ))}
      </div>

      <CheckoutDrawer plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </div>
  );
};
