import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PLANS, planPrice, type Plan } from '../data/plans';

interface PlanGridProps {
  busy?: boolean;
  onSelectPlan: (plan: Plan) => void;
  getButtonId?: (plan: Plan, isCurrent: boolean) => string | undefined;
  getButtonLabel?: (plan: Plan, isCurrent: boolean) => string | undefined;
  includeSettingsDataAttrs?: boolean;
  statusMessage?: string;
}

/** Shared 3-tier plan selector used in Account and Billing settings views. */
export const PlanGrid: React.FC<PlanGridProps> = ({
  busy = false,
  onSelectPlan,
  getButtonId,
  getButtonLabel,
  includeSettingsDataAttrs = false,
  statusMessage,
}) => {
  const { language, goToPricing, currentPlanId, planExpiresAt, t } = useApp();

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="plan-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-title" className="panel-title">
          {t.pricingTitle}
        </h2>
      </div>

      {currentPlanId !== 'free' && planExpiresAt && (
        <p className="mt-2 text-xs font-medium text-brass">
          {t.billingActiveExpires.replace(
            '{date}',
            new Date(planExpiresAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')
          )}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const defaultLabel = isCurrent
            ? t.planCurrent
            : plan.id === 'free'
              ? t.planCancelToFree
              : t.planChoose.replace('{plan}', plan.name);
          const label = getButtonLabel?.(plan, isCurrent) ?? defaultLabel;

          return (
            <div
              key={plan.id}
              data-settings-plan={includeSettingsDataAttrs ? plan.id : undefined}
              className={`flex flex-col justify-between rounded-xl border p-4 ${
                isCurrent ? 'border-brass bg-brass/5' : 'border-border'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="field-label">{plan.name}</span>
                  {isCurrent && (
                    <span className="badge-success text-[10px]">{t.planCurrent}</span>
                  )}
                </div>
                <p className="mt-1 font-serif text-lg text-ink">
                  {planPrice(plan, language)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))} ·{' '}
                  {t.planBots.replace('{count}', String(plan.maxBots))}
                </p>
              </div>

              <button
                type="button"
                id={getButtonId?.(plan, isCurrent)}
                data-settings-plan-btn={includeSettingsDataAttrs ? plan.id : undefined}
                disabled={isCurrent || busy}
                onClick={() => onSelectPlan(plan)}
                className={`mt-4 min-h-10 w-full justify-center text-xs ${
                  isCurrent
                    ? 'button-secondary opacity-60 cursor-default'
                    : plan.id === 'free'
                      ? 'button-secondary'
                      : 'button-primary'
                }`}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={goToPricing} className="button-secondary mt-4 min-h-11">
        {t.pricingTitle}
      </button>

      {statusMessage && (
        <div
          className="mt-4 flex gap-3 rounded-lg border border-sage/40 bg-sage/10 p-4 text-sm leading-relaxed text-ink"
          aria-live="polite"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}
    </section>
  );
};
