import type { Language } from '../types';

export type PlanId = 'free' | 'pro' | 'ultra';

export interface Plan {
  id: PlanId;
  /** Display name from the published table (AGENTS.md 28.3). */
  name: string;
  /** Single source of truth: integer VND. Every price shown anywhere derives from this. */
  priceVnd: number;
  /**
   * Static display value from the published conversion table (AGENTS.md 28.3 — supplied by the
   * lead, never computed). Do not derive it from `priceVnd` at runtime: a live FX call or a
   * recomputed rate would make the USD figure drift away from the published table.
   */
  priceUsd: string;
  /** Personas allowed to be active at once in one session — not a count of distinct models. */
  maxActiveAdvisors: number;
  popular?: boolean;
}

export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', priceVnd: 0, priceUsd: '0', maxActiveAdvisors: 2 },
  { id: 'pro', name: 'Pro', priceVnd: 139000, priceUsd: '5.99', maxActiveAdvisors: 4, popular: true },
  { id: 'ultra', name: 'Ultra', priceVnd: 379000, priceUsd: '16.99', maxActiveAdvisors: 8 },
];

const viNumber = new Intl.NumberFormat('vi-VN');
const enNumber = new Intl.NumberFormat('en-US');

export const planById = (id: PlanId): Plan => PLANS.find((plan) => plan.id === id) ?? PLANS[0];

/** Locale only changes how the same number is written: VI shows the VND source, EN the published USD. */
export const planPrice = (plan: Plan, language: Language): string =>
  language === 'vi'
    ? `${viNumber.format(plan.priceVnd)}₫/tháng`
    : `$${plan.priceUsd}/mo`;

/** Checkout always states the real charge in VND first, whatever the locale is. */
export const planAmountLine = (plan: Plan): string =>
  `₫${enNumber.format(plan.priceVnd)} (~$${plan.priceUsd})`;
