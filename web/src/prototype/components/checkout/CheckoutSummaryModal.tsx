/**
 * Step 1 checkout summary modal: plan pricing breakdown, promo code validation, and payment CTA.
 */

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, ShieldCheck, Tag, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { planAmountLine, type Plan } from '../../data/plans';
import { Modal } from '../Modal';
import { formatVnd, type AppliedCoupon } from './types';

interface CheckoutSummaryModalProps {
  isOpen: boolean;
  plan: Plan | null;
  code: string;
  appliedCoupon: AppliedCoupon | null;
  activeCoupon: AppliedCoupon | null;
  discountedUsd: string | null;
  couponLoading: boolean;
  couponError: string | null;
  pending: boolean;
  granted: string | null;
  error: string | null;
  onClose: () => void;
  onCodeChange: (next: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onStartPayment: () => void;
}

export const CheckoutSummaryModal: React.FC<CheckoutSummaryModalProps> = ({
  isOpen,
  plan,
  code,
  appliedCoupon,
  activeCoupon,
  discountedUsd,
  couponLoading,
  couponError,
  pending,
  granted,
  error,
  onClose,
  onCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onStartPayment,
}) => {
  const { t, language } = useApp();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.checkoutTitle}
      description={plan ? plan.name : undefined}
      closeLabel={t.close}
    >
      {plan ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-brass/40 bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {t.checkoutAmountLabel}
              </p>
              {activeCoupon ? (
                <span
                  id="checkout-discount-badge"
                  className="inline-flex items-center gap-1 rounded-full border border-sage/40 bg-sage/20 px-2.5 py-1 text-xs font-bold text-sage"
                >
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  {activeCoupon.code} −{activeCoupon.percent}%
                </span>
              ) : null}
            </div>

            {activeCoupon ? (
              <div className="mt-3 space-y-2 rounded-lg border border-sage/30 bg-surface-2/60 p-3.5">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>{t.checkoutOriginalPrice}</span>
                  <span className="line-through">{planAmountLine(plan)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-sage">
                  <span>{t.checkoutDiscountLine}</span>
                  <span className="font-semibold">
                    −{formatVnd(activeCoupon.discountVnd)} (−{activeCoupon.percent}%)
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-1 border-t border-border/40 pt-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                    {t.checkoutTotalToPay}
                  </span>
                  <p id="checkout-final-amount" className="font-serif text-3xl font-bold text-sage">
                    {formatVnd(activeCoupon.discountedVnd)}
                    {language === 'en' && discountedUsd ? ` (~$${discountedUsd})` : ''}
                    <span className="ml-1.5 font-sans text-xs font-normal text-ink-muted">
                      {t.planPerMonth}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <p id="checkout-final-amount" className="mt-2 font-serif text-3xl text-ink">
                {planAmountLine(plan)}
                <span className="ml-2 font-sans text-xs font-normal text-ink-muted">
                  {t.planPerMonth}
                </span>
              </p>
            )}

            {language === 'en' ? (
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.checkoutUsdNote}</p>
            ) : null}
          </div>

          <section className="rounded-xl border border-border bg-background/60 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Tag className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              {t.discountTitle}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t.checkoutDiscountPlanScope
                .replace('{plan}', plan.name)
                .replace('{price}', planAmountLine(plan))}
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="field min-w-0 flex-1">
                <span className="sr-only">{t.discountTitle}</span>
                <input
                  id="checkout-promo-input"
                  value={code}
                  onChange={(event) => {
                    const next = event.target.value;
                    onCodeChange(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onApplyCoupon();
                    }
                  }}
                  data-applied-match={
                    appliedCoupon && code.trim().toUpperCase() === appliedCoupon.code.toUpperCase()
                      ? 'true'
                      : undefined
                  }
                  placeholder={t.discountPlaceholder}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
                />
              </label>
              {activeCoupon ? (
                <button
                  type="button"
                  id="checkout-promo-remove-btn"
                  onClick={onRemoveCoupon}
                  className="button-secondary w-full shrink-0 justify-center px-4 sm:w-auto"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {t.discountRemove}
                </button>
              ) : (
                <button
                  type="button"
                  id="checkout-promo-apply-btn"
                  onClick={onApplyCoupon}
                  disabled={couponLoading || !code.trim()}
                  className="button-secondary w-full shrink-0 justify-center px-4 disabled:opacity-50 sm:w-auto"
                >
                  {couponLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t.discountApply}
                </button>
              )}
            </div>

            {activeCoupon ? (
              <div
                role="status"
                id="checkout-coupon-applied"
                className="mt-3 flex items-start gap-2 rounded-lg border border-sage/20 bg-sage/10 p-2.5 text-xs font-medium text-sage"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">
                    {t.checkoutDiscountAppliedBanner
                      .replace('{code}', activeCoupon.code)
                      .replace('{percent}', String(activeCoupon.percent))
                      .replace('{plan}', plan.name)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {t.checkoutDiscountSavedBanner.replace(
                      '{amount}',
                      formatVnd(activeCoupon.discountVnd)
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {couponError ? (
              <p role="alert" id="checkout-coupon-error" className="mt-2 text-xs text-terracotta">
                {couponError}
              </p>
            ) : null}

            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.discountNote}</p>
          </section>

          <button
            type="button"
            id="checkout-pay-btn"
            onClick={onStartPayment}
            disabled={pending || couponLoading || plan.priceVnd <= 0}
            className="button-primary min-h-11 w-full justify-center disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {plan.priceVnd <= 0
              ? t.planCurrent
              : activeCoupon && activeCoupon.discountedVnd === 0
                ? t.checkoutActivateFree
                : activeCoupon
                  ? `${t.checkoutPay} (${formatVnd(activeCoupon.discountedVnd)})`
                  : `${t.checkoutPay} (${formatVnd(plan.priceVnd)})`}
          </button>

          <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs leading-relaxed text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sage" aria-hidden="true" />
            <span>{t.checkoutPassTrustNote}</span>
            <span aria-hidden="true">·</span>
            <Link
              href="/legal/refund"
              className="font-medium text-brass underline-offset-2 hover:underline"
            >
              {t.checkoutRefundLink}
            </Link>
          </p>

          {granted ? (
            <p
              role="status"
              className="rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-ink"
            >
              {`${t.planActiveUntil}: ${new Date(granted).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}`}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs leading-relaxed text-terracotta">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
};
