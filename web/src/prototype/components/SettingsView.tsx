import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, Globe2, RotateCcw } from 'lucide-react';
import { PLANS, planPrice } from '../data/plans';
import { Modal } from './Modal';

export const SettingsView: React.FC = () => {
  const {
    language,
    setLanguage,
    setCurrentView,
    goToPricing,
    requestCheckout,
    cancelPlanToFree,
    purgeSessions,
    revokeAllKeys,
    currentPlanId,
    planExpiresAt,
    t,
  } = useApp();
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  // pendingPlan: the plan the user chose; we confirm before proceeding.
  const [pendingPlan, setPendingPlan] = useState<(typeof PLANS)[number] | null>(null);

  const handleSelectPlan = async (plan: (typeof PLANS)[number]) => {
    if (plan.id === currentPlanId || planBusy) return;
    if (plan.id === 'free') {
      setPendingPlan(plan);
      setCancelConfirmOpen(true);
      return;
    }
    requestCheckout(plan);
  };

  return (
    <div className="content-shell space-y-7">
      <header className="page-header">
        <p className="eyebrow">
          <span className="status-dot" />
          {t.settingsEyebrow}
        </p>
        <h1>{t.settingsTitle}</h1>
        <p>{t.settingsBody}</p>
      </header>

      <section className="panel p-5 sm:p-6" aria-labelledby="local-profile-title">
        <h2 id="local-profile-title" className="panel-title">
          {t.localProfile}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.localProfileBody}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-6" aria-labelledby="language-title">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-brass" />
            <h2 id="language-title" className="panel-title">
              {t.language}
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label={t.language}>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              className="setting-choice"
            >
              <span>English</span>
              {language === 'en' && <Check className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('vi')}
              aria-pressed={language === 'vi'}
              className="setting-choice"
            >
              <span>Tiếng Việt</span>
              {language === 'vi' && <Check className="h-4 w-4" />}
            </button>
          </div>
        </section>
      </div>

      <section className="panel p-5 sm:p-6" aria-labelledby="plan-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="plan-title" className="panel-title">
            {t.pricingTitle}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentView('billing')}
            className="button-quiet"
          >
            {t.billingTitle}
          </button>
        </div>

        {currentPlanId !== 'free' && planExpiresAt && (
          <p className="mt-2 text-xs font-medium text-brass">
            {t.billingActiveExpires.replace(
              '{date}',
              new Date(planExpiresAt).toLocaleDateString()
            )}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                data-settings-plan={plan.id}
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
                    {`${plan.maxBots} bots`}
                  </p>
                </div>

                <button
                  type="button"
                  data-settings-plan-btn={plan.id}
                  disabled={isCurrent || planBusy}
                  onClick={() => void handleSelectPlan(plan)}
                  className={`mt-4 min-h-10 w-full justify-center text-xs ${
                    isCurrent
                      ? 'button-secondary opacity-60 cursor-default'
                      : plan.id === 'free'
                        ? 'button-secondary'
                        : 'button-primary'
                  }`}
                >
                  {isCurrent
                    ? t.planCurrent
                    : plan.id === 'free'
                      ? t.planCancelToFree
                      : t.planChoose.replace('{plan}', plan.name)}
                </button>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={goToPricing} className="button-secondary mt-4 min-h-11">
          {t.pricingTitle}
        </button>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="sample-data-title">
        <h2 id="sample-data-title" className="panel-title">
          {t.sampleData}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.sampleDataBody}</p>
        <button
          type="button"
          onClick={() => setIsPurgeOpen(true)}
          className="button-danger mt-4 min-h-11"
        >
          <RotateCcw className="h-4 w-4" />
          {t.clear}
        </button>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="provider-state-title">
        <h2 id="provider-state-title" className="panel-title">
          {t.providerStates}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.providerStatesBody}</p>
        <button
          type="button"
          onClick={() => setIsProviderOpen(true)}
          className="button-secondary mt-4 min-h-11"
        >
          <RotateCcw className="h-4 w-4" />
          {t.clearStates}
        </button>
      </section>

      <Modal
        isOpen={isPurgeOpen}
        onClose={() => setIsPurgeOpen(false)}
        title={t.clear}
        description={t.clearConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsPurgeOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPurgeOpen(false);
                purgeSessions();
              }}
              className="button-danger min-h-11 justify-center"
            >
              {t.clear}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearConfirm}</p>
      </Modal>

      <Modal
        isOpen={isProviderOpen}
        onClose={() => setIsProviderOpen(false)}
        title={t.clearStates}
        description={t.clearStatesConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsProviderOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsProviderOpen(false);
                void revokeAllKeys();
              }}
              className="button-danger min-h-11 justify-center"
            >
              {t.clearStates}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearStatesConfirm}</p>
      </Modal>

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
              disabled={planBusy}
              onClick={async () => {
                if (!pendingPlan) return;
                setCancelConfirmOpen(false);
                setPlanBusy(true);
                await cancelPlanToFree();
                setPlanBusy(false);
                setPendingPlan(null);
              }}
              className="button-danger min-h-11 justify-center disabled:opacity-50"
            >
              {t.planCancelToFree}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.planCancelConfirm}</p>
      </Modal>
    </div>
  );
};
