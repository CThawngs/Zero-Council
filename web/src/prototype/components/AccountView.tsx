import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { PLANS } from '../data/plans';
import { Check, Globe2, Moon, RotateCcw, Sun } from 'lucide-react';
import { Modal } from './Modal';
import { PlanGrid } from './PlanGrid';

export default function AccountView() {
  const {
    language,
    setLanguage,
    theme,
    toggleTheme,
    cancelPlanToFree,
    downgradeToPro,
    requestCheckout,
    purgeSessions,
    revokeAllKeys,
    currentPlanId,
    t,
  } = useApp();
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [downgradeConfirmOpen, setDowngradeConfirmOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<(typeof PLANS)[number] | null>(null);

  const handleSelectPlan = async (plan: (typeof PLANS)[number]) => {
    if (plan.id === currentPlanId || planBusy) return;
    if (plan.id === 'free') {
      setPendingPlan(plan);
      setCancelConfirmOpen(true);
      return;
    }
    if (plan.id === 'pro' && currentPlanId === 'ultra') {
      setDowngradeConfirmOpen(true);
      return;
    }
    requestCheckout(plan);
  };

  return (
    <div className="content-shell space-y-7">
      <section className="panel p-5 sm:p-6" aria-labelledby="local-profile-title">
        <h2 id="local-profile-title" className="panel-title">
          {t.localProfile}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.localProfileBody}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-6" aria-labelledby="language-title">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-brass" aria-hidden="true" />
            <h2 id="language-title" className="panel-title">
              {t.language}
            </h2>
          </div>
          <div
            className="mt-4 grid grid-cols-1 min-[380px]:grid-cols-2 gap-2"
            role="group"
            aria-label={t.language}
          >
            <button
              type="button"
              onClick={() => void setLanguage('en')}
              aria-pressed={language === 'en'}
              className="setting-choice"
            >
              <span>English</span>
              {language === 'en' && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => void setLanguage('vi')}
              aria-pressed={language === 'vi'}
              className="setting-choice"
            >
              <span>Tiếng Việt</span>
              {language === 'vi' && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </section>

        <section className="panel p-5 sm:p-6" aria-labelledby="theme-title">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-brass" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4 text-brass" aria-hidden="true" />
            )}
            <h2 id="theme-title" className="panel-title">
              {t.wsThemeTitle}
            </h2>
          </div>
          <div
            className="mt-4 grid grid-cols-1 min-[380px]:grid-cols-2 gap-2"
            role="group"
            aria-label={t.wsThemeTitle}
          >
            <button
              type="button"
              onClick={() => {
                if (theme !== 'light') toggleTheme();
              }}
              aria-pressed={theme === 'light'}
              className="setting-choice"
            >
              <span className="inline-flex items-center gap-2">
                <Sun className="h-4 w-4" aria-hidden="true" />
                {t.themeLightLabel}
              </span>
              {theme === 'light' && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (theme !== 'dark') toggleTheme();
              }}
              aria-pressed={theme === 'dark'}
              className="setting-choice"
            >
              <span className="inline-flex items-center gap-2">
                <Moon className="h-4 w-4" aria-hidden="true" />
                {t.themeDarkLabel}
              </span>
              {theme === 'dark' && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </section>
      </div>

      <PlanGrid
        busy={planBusy}
        onSelectPlan={(plan) => void handleSelectPlan(plan)}
        getButtonLabel={(plan, isCurrent) =>
          !isCurrent && plan.id === 'pro' && currentPlanId === 'ultra'
            ? t.planDowngradeToPro
            : undefined
        }
        includeSettingsDataAttrs
      />

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
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
      />

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
      />

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
      />

      {/* Downgrade Ultra -> Pro confirmation */}
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
              disabled={planBusy}
              onClick={async () => {
                setDowngradeConfirmOpen(false);
                setPlanBusy(true);
                await downgradeToPro();
                setPlanBusy(false);
              }}
              className="button-primary min-h-11 justify-center disabled:opacity-50"
            >
              {t.planDowngradeToPro}
            </button>
          </>
        }
      />
    </div>
  );
}
