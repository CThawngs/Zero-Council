/**
 * Account RBAC, promo coupons, single-use redemptions, and 30-day pass grants store (`zc_*` tables).
 */

import { isFounder } from '../founder.ts';
import type { PlanId } from '@/prototype/data/plans';
import {
  assertStoreAvailable,
  normaliseCode,
  readAll,
  redemptionKey,
  request,
  supabaseConfig,
  writeAll,
  type AccountUser,
  type Coupon,
  type Grant,
  type GrantSource,
  type Redemption,
  type Role,
} from './account/backend.ts';

export type { AccountUser, Coupon, Grant, GrantSource, Redemption, Role };

interface UserRow {
  email: string;
  role: Role;
  created_at: string;
}

const toUser = (row: UserRow): AccountUser => ({
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
});

/**
 * Records the account on first sight. The founder account (`lib/founder.ts`) is seeded as `admin`
 * automatically and cannot self-demote.
 */
export const ensureUser = async (email: string): Promise<AccountUser> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  const initialRole: Role = isFounder(key) ? 'admin' : 'user';
  if (supabaseConfig()) {
    const rows = await request('zc_users?on_conflict=email', {
      method: 'POST',
      body: JSON.stringify({
        email: key,
        role: initialRole,
      }),
      headers: {
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
    });

    const [row] = rows as UserRow[];
    if (row) return toUser(row);

    const existing = await getUser(key);
    if (existing) return existing;

    throw new Error('ENSURE_USER_FAILED');
  }
  const data = await readAll();
  const existing = data.users[key];
  if (existing) return existing;
  const created: AccountUser = {
    email: key,
    role: initialRole,
    createdAt: new Date().toISOString(),
  };
  data.users[key] = created;
  await writeAll(data);
  return created;
};

export const getUser = async (email: string): Promise<AccountUser | null> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(`zc_users?email=eq.${encodeURIComponent(key)}&select=*`);
    const [row] = rows as UserRow[];
    return row ? toUser(row) : null;
  }
  return (await readAll()).users[key] ?? null;
};

export const listUsers = async (): Promise<AccountUser[]> => {
  assertStoreAvailable();
  if (supabaseConfig()) {
    const rows = await request('zc_users?select=*&order=email');
    return (rows as UserRow[]).map(toUser);
  }
  return Object.values((await readAll()).users).sort((a, b) => a.email.localeCompare(b.email));
};

export const setUserRole = async (email: string, role: Role): Promise<AccountUser | null> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(`zc_users?email=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    const [row] = rows as UserRow[];
    return row ? toUser(row) : null;
  }
  const data = await readAll();
  const existing = data.users[key];
  if (!existing) return null;
  const updated: AccountUser = { ...existing, role };
  data.users[key] = updated;
  await writeAll(data);
  return updated;
};

interface CouponRow {
  code: string;
  percent: number;
  expires_at: string | null;
  max_total_redemptions: number | null;
  active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

const toCoupon = (row: CouponRow): Coupon => ({
  code: row.code,
  percent: row.percent,
  expiresAt: row.expires_at,
  maxTotalRedemptions: row.max_total_redemptions,
  active: row.active,
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const toCouponRow = (coupon: Coupon): CouponRow => ({
  code: normaliseCode(coupon.code),
  percent: coupon.percent,
  expires_at: coupon.expiresAt,
  max_total_redemptions: coupon.maxTotalRedemptions,
  active: coupon.active,
  note: coupon.note,
  created_by: coupon.createdBy,
  created_at: coupon.createdAt,
});

export const listCoupons = async (): Promise<Coupon[]> => {
  assertStoreAvailable();
  if (supabaseConfig()) {
    const rows = await request('zc_coupons?select=*&order=code');
    return (rows as CouponRow[]).map(toCoupon);
  }
  return Object.values((await readAll()).coupons).sort((a, b) => a.code.localeCompare(b.code));
};

export const getCoupon = async (code: string): Promise<Coupon | null> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  if (supabaseConfig()) {
    const rows = await request(`zc_coupons?code=eq.${encodeURIComponent(key)}&select=*`);
    const [row] = rows as CouponRow[];
    return row ? toCoupon(row) : null;
  }
  return (await readAll()).coupons[key] ?? null;
};

export const createCoupon = async (coupon: Coupon): Promise<Coupon> => {
  assertStoreAvailable();
  const row = toCouponRow({ ...coupon, code: normaliseCode(coupon.code) });
  if (supabaseConfig()) {
    const rows = await request('zc_coupons', { method: 'POST', body: JSON.stringify(row) });
    return toCoupon((rows as CouponRow[])[0]);
  }
  const data = await readAll();
  if (data.coupons[row.code]) throw new Error('COUPON_EXISTS');
  data.coupons[row.code] = toCoupon(row);
  await writeAll(data);
  return toCoupon(row);
};

export const updateCoupon = async (
  code: string,
  patch: Partial<Coupon>
): Promise<Coupon | null> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  const changes: Record<string, unknown> = {};
  if (patch.percent !== undefined) changes.percent = patch.percent;
  if (patch.expiresAt !== undefined) changes.expires_at = patch.expiresAt;
  if (patch.maxTotalRedemptions !== undefined) {
    changes.max_total_redemptions = patch.maxTotalRedemptions;
  }
  if (patch.active !== undefined) changes.active = patch.active;
  if (patch.note !== undefined) changes.note = patch.note;
  if (supabaseConfig()) {
    const rows = await request(`zc_coupons?code=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
    const [row] = rows as CouponRow[];
    return row ? toCoupon(row) : null;
  }
  const data = await readAll();
  const existing = data.coupons[key];
  if (!existing) return null;
  const updated = { ...existing, ...patch, code: key };
  data.coupons[key] = updated;
  await writeAll(data);
  return updated;
};

export const deleteCoupon = async (code: string): Promise<boolean> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  if (supabaseConfig()) {
    const rows = await request(`zc_coupons?code=eq.${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return (rows as unknown[]).length > 0;
  }
  const data = await readAll();
  if (!data.coupons[key]) return false;
  delete data.coupons[key];
  await writeAll(data);
  return true;
};

interface RedemptionRow {
  coupon_code: string;
  user_email: string;
  percent: number;
  order_code: number | null;
  redeemed_at: string;
}

const toRedemption = (row: RedemptionRow): Redemption => ({
  couponCode: row.coupon_code,
  userEmail: row.user_email,
  percent: row.percent,
  orderCode: row.order_code,
  redeemedAt: row.redeemed_at,
});

export const listRedemptions = async (): Promise<Redemption[]> => {
  assertStoreAvailable();
  if (supabaseConfig()) {
    const rows = await request('zc_coupon_redemptions?select=*&order=coupon_code&user_email');
    return (rows as RedemptionRow[]).map(toRedemption);
  }
  return Object.values((await readAll()).redemptions);
};

export const countRedemptions = async (code: string): Promise<number> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  if (supabaseConfig()) {
    const rows = await request(
      `zc_coupon_redemptions?coupon_code=eq.${encodeURIComponent(key)}&select=coupon_code`
    );
    return (rows as unknown[]).length;
  }
  const data = await readAll();
  return Object.entries(data.redemptions).filter(([k]) => k.startsWith(`${key}|`)).length;
};

export const redeemCoupon = async (
  code: string,
  userEmail: string,
  percent: number,
  orderCode: number | null
): Promise<Redemption | null> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  const email = userEmail.trim().toLowerCase();
  if (supabaseConfig()) {
    try {
      const rows = await request('zc_coupon_redemptions', {
        method: 'POST',
        body: JSON.stringify({
          coupon_code: key,
          user_email: email,
          percent,
          order_code: orderCode,
        }),
      });
      return toRedemption((rows as RedemptionRow[])[0]);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 409) return null;
      throw error;
    }
  }
  const data = await readAll();
  const composite = redemptionKey(key, email);
  if (data.redemptions[composite]) return null;
  const created: Redemption = {
    couponCode: key,
    userEmail: email,
    percent,
    orderCode,
    redeemedAt: new Date().toISOString(),
  };
  data.redemptions[composite] = created;
  await writeAll(data);
  return created;
};

export const addMonth = (from: Date): Date => {
  const result = new Date(from.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
};

export const addGrant = async (input: {
  userEmail: string;
  planId: PlanId;
  source: GrantSource;
  orderCode: number | null;
  percent: number | null;
}): Promise<Grant> => {
  assertStoreAvailable();
  const now = new Date();
  const current = await effectivePlan(input.userEmail);
  const startsAt =
    current && new Date(current.expiresAt) > now ? new Date(current.expiresAt) : now;
  const grant: Grant = {
    userEmail: input.userEmail.trim().toLowerCase(),
    planId: input.planId,
    source: input.source,
    orderCode: input.orderCode,
    percent: input.percent,
    startsAt: startsAt.toISOString(),
    expiresAt: addMonth(startsAt).toISOString(),
  };
  if (supabaseConfig()) {
    const rows = await request('zc_grants', {
      method: 'POST',
      body: JSON.stringify({
        user_email: grant.userEmail,
        plan_id: grant.planId,
        source: grant.source,
        order_code: grant.orderCode,
        percent: grant.percent,
        starts_at: grant.startsAt,
        expires_at: grant.expiresAt,
      }),
    });
    const [row] = rows as {
      user_email: string;
      plan_id: PlanId;
      source: GrantSource;
      order_code: number | null;
      percent: number | null;
      starts_at: string;
      expires_at: string;
    }[];
    return {
      userEmail: row.user_email,
      planId: row.plan_id,
      source: row.source,
      orderCode: row.order_code,
      percent: row.percent,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
    };
  }
  const data = await readAll();
  data.grants.push(grant);
  await writeAll(data);
  return grant;
};

export const effectivePlan = async (
  userEmail: string
): Promise<{ planId: PlanId; expiresAt: string } | null> => {
  assertStoreAvailable();
  const email = userEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_grants?user_email=eq.${encodeURIComponent(email)}&expires_at=gt.${encodeURIComponent(nowIso)}` +
        '&select=plan_id,expires_at&order=expires_at.desc&limit=1'
    );
    const [row] = rows as { plan_id: PlanId; expires_at: string }[];
    return row ? { planId: row.plan_id, expiresAt: row.expires_at } : null;
  }
  const data = await readAll();
  const unexpired = data.grants
    .filter((grant) => grant.userEmail === email && grant.expiresAt > nowIso)
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
  const [best] = unexpired;
  return best ? { planId: best.planId, expiresAt: best.expiresAt } : null;
};

export const listGrants = async (userEmail: string): Promise<Grant[]> => {
  assertStoreAvailable();
  const email = userEmail.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request(
      `zc_grants?user_email=eq.${encodeURIComponent(email)}&select=*&order=expires_at.desc`
    );
    return (
      rows as {
        user_email: string;
        plan_id: PlanId;
        source: GrantSource;
        order_code: number | null;
        percent: number | null;
        starts_at: string;
        expires_at: string;
      }[]
    ).map((row) => ({
      userEmail: row.user_email,
      planId: row.plan_id,
      source: row.source,
      orderCode: row.order_code,
      percent: row.percent,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
    }));
  }
  return (await readAll()).grants
    .filter((grant) => grant.userEmail === email)
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
};

export const revokeGrants = async (userEmail: string): Promise<void> => {
  assertStoreAvailable();
  const email = userEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  if (supabaseConfig()) {
    await request(
      `zc_grants?user_email=eq.${encodeURIComponent(email)}&expires_at=gt.${encodeURIComponent(nowIso)}`,
      { method: 'DELETE' }
    );
    return;
  }
  const data = await readAll();
  data.grants = data.grants.filter(
    (grant) => !(grant.userEmail === email && grant.expiresAt > nowIso)
  );
  await writeAll(data);
};
