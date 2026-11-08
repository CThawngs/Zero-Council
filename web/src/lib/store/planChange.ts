// Plan downgrade/cancel rules. Pure so node --test can drive them without a server.

// ponytail: PlanId lives in prototype/data/plans.ts (client-safe, no deps) — importing it
// keeps one definition of 'free' | 'pro' | 'ultra' instead of a second copy here.
import type { PlanId } from '@/prototype/data/plans';

export type PlanChangeAction = 'cancel' | 'downgrade-pay' | 'invalid';

/**
 * What a "go to `to`" request means, from the plan the account is actually on:
 * - pro/ultra -> free is a plain cancel: the grant is revoked, no payment.
 * - ultra -> pro revokes Ultra first, then the client opens a fresh Pro checkout
 *   (downgrade-pay), because Pro was never paid for on this account.
 * - everything else (free -> anything, same plan, pro -> pro) is invalid.
 */
export const planChangeAction = (current: PlanId, to: string): PlanChangeAction => {
  if (to !== 'free' && to !== 'pro') return 'invalid';
  if (current === 'free') return 'invalid';
  if (to === 'free') return 'cancel';
  if (current === 'ultra' && to === 'pro') return 'downgrade-pay';
  return 'invalid';
};
