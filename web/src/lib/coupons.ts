import {
  countRedemptions,
  getCoupon,
  listRedemptions,
  type Coupon,
} from './store/account.ts';

export type CouponRefusal =
  | 'UNKNOWN_CODE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'LIMIT_REACHED';

export type CouponCheck =
  | { ok: true; coupon: Coupon; percent: number }
  | { ok: false; reason: CouponRefusal };

/**
 * Whether an account may use a code, and how much it takes off.
 *
 * The order of the checks is the order a user would want to hear about them: a code they already
 * used should say so, not "expired". `ALREADY_USED` is reported before the total cap because it
 * is the rule this account broke, while the cap is about the code running out for everyone.
 */
export const checkCoupon = async (code: string, userEmail: string): Promise<CouponCheck> => {
  const coupon = await getCoupon(code);
  if (!coupon) return { ok: false, reason: 'UNKNOWN_CODE' };
  if (!coupon.active) return { ok: false, reason: 'INACTIVE' };

  const now = Date.now();
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now) {
    return { ok: false, reason: 'EXPIRED' };
  }

  const email = userEmail.trim().toLowerCase();
  const used = await listRedemptions();
  if (used.some((row) => row.couponCode === coupon.code && row.userEmail === email)) {
    return { ok: false, reason: 'ALREADY_USED' };
  }

  if (coupon.maxTotalRedemptions !== null) {
    const total = await countRedemptions(coupon.code);
    if (total >= coupon.maxTotalRedemptions) return { ok: false, reason: 'LIMIT_REACHED' };
  }

  return { ok: true, coupon, percent: coupon.percent };
};

/** Applies a percentage. Rounds to the nearest whole dong, and never goes below zero. */
export const amountAfterCoupon = (priceVnd: number, percent: number): number => {
  const discounted = Math.round((priceVnd * (100 - percent)) / 100);
  return Math.max(0, discounted);
};
