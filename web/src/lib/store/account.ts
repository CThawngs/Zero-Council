import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '../serverEnv.ts';
import type { PlanId } from '@/prototype/data/plans';

export type Role = 'user' | 'admin';
export type GrantSource = 'PAYOS' | 'COUPON';

export interface AccountUser {
  email: string;
  role: Role;
  createdAt: string;
}

export interface Coupon {
  code: string;
  /** Percentage only. The brief was "coupon always discounts by %", so there is no amount column. */
  percent: number;
  /** null = never expires. */
  expiresAt: string | null;
  /** null = unlimited. */
  maxTotalRedemptions: number | null;
  active: boolean;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Redemption {
  couponCode: string;
  userEmail: string;
  percent: number;
  orderCode: number | null;
  redeemedAt: string;
}

export interface Grant {
  userEmail: string;
  planId: PlanId;
  source: GrantSource;
  orderCode: number | null;
  percent: number | null;
  startsAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------------------
// Postgres via PostgREST, reached with plain fetch. Same reasoning as orders.ts: every Supabase
// project already exposes this REST layer, so three tables of CRUD are not worth a dependency.
// See web/supabase/migrations/0002_zc_coupons.sql for the schema and the first-admin seed.
// ---------------------------------------------------------------------------------------
const supabaseConfig = () => {
  const url = serverEnv('SUPABASE_URL')?.replace(/\/+$/, '');
  const key = serverEnv('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url, key } : null;
};

const request = async (pathAndQuery: string, init: RequestInit = {}): Promise<unknown> => {
  const config = supabaseConfig();
  if (!config) throw new Error('ACCOUNT_STORE_NOT_CONFIGURED');
  const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`SUPABASE_${response.status}:${body.slice(0, 300)}`) as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.json();
};

// ---------------------------------------------------------------------------------------
// Local development fallback, mirroring orders.ts: a JSON file, because nobody can drive the
// admin page before the Supabase project exists. Refused on an ephemeral filesystem, for the
// same reason: a deployed instance writing coupons and grants to a local file would hand out
// plan access that disappears with the instance.
//
// ponytail: dev only — one process, no locking. Two admin tabs open at once can lose a write.
// That is acceptable for local driving and is not a production path, because production
// refuses the file. A second writer is the ceiling; move to Postgres (already the only
// production path) if local multi-process ever matters.
// ---------------------------------------------------------------------------------------
const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH = serverEnv('ZC_ACCOUNT_STORE') ?? path.join(process.cwd(), '.zc-account.json');

interface FileShape {
  users: Record<string, AccountUser>;
  coupons: Record<string, Coupon>;
  redemptions: Record<string, Redemption>;
  grants: Grant[];
}

const emptyFile = (): FileShape => ({ users: {}, coupons: {}, redemptions: {}, grants: [] });

const readAll = async (): Promise<FileShape> => {
  try {
    return { ...emptyFile(), ...JSON.parse(await readFile(/* turbopackIgnore: true */ STORE_PATH, 'utf8')) };
  } catch {
    return emptyFile();
  }
};

const writeAll = (data: FileShape) =>
  writeFile(/* turbopackIgnore: true */ STORE_PATH, JSON.stringify(data, null, 2), 'utf8');

const assertStoreAvailable = () => {
  if (supabaseConfig()) return;
  if (EPHEMERAL) {
    throw new Error(
      'SUPABASE_NOT_CONFIGURED: this host has an ephemeral filesystem (VERCEL=1) and needs ' +
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The file store is refused here on purpose — ' +
        'coupons and plan grants written to a local file would not survive the instance.'
    );
  }
};

const normaliseCode = (code: string) => code.trim().toUpperCase();
const redemptionKey = (code: string, email: string) => `${normaliseCode(code)}|${email.trim().toLowerCase()}`;

// ---------------------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------------------
interface UserRow {
  email: string;
  role: Role;
  created_at: string;
}

const toUser = (row: UserRow): AccountUser => ({ email: row.email, role: row.role, createdAt: row.created_at });

/**
 * Record the account on first sight, always as `user`. This function can never produce an admin:
 * promotion is a separate, role-gated path, and the very first admin is a hand-run SQL insert
 * documented in the migration. If this could self-promote, anyone who reached it would be admin.
 */
export const ensureUser = async (email: string): Promise<AccountUser> => {
  assertStoreAvailable();
  const key = email.trim().toLowerCase();
  if (supabaseConfig()) {
    const rows = await request('zc_users?on_conflict=email', {
      method: 'POST',
      body: JSON.stringify({ email: key, role: 'user' }),
      headers: { Prefer: 'return=representation' },
    });
    const [row] = rows as UserRow[];
    if (row) return toUser(row);
    // Nothing returned: the conflict branch of the upsert reports no row, so read the account back.
    const fetched = await getUser(key);
    if (fetched) return fetched;
    throw new Error('ENSURE_USER_FAILED');
  }
  const data = await readAll();
  const existing = data.users[key];
  if (existing) return existing;
  const created: AccountUser = { email: key, role: 'user', createdAt: new Date().toISOString() };
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

/** Promotes or demotes. The caller must already have checked that the caller is an admin. */
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

// ---------------------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------------------
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

export const updateCoupon = async (code: string, patch: Partial<Coupon>): Promise<Coupon | null> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  const changes: Record<string, unknown> = {};
  if (patch.percent !== undefined) changes.percent = patch.percent;
  if (patch.expiresAt !== undefined) changes.expires_at = patch.expiresAt;
  if (patch.maxTotalRedemptions !== undefined) changes.max_total_redemptions = patch.maxTotalRedemptions;
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

/**
 * Deletes the coupon but never its redemptions. They are the usage record, and there is no
 * foreign key from them (see the migration) precisely so a used coupon can still be removed.
 */
export const deleteCoupon = async (code: string): Promise<boolean> => {
  assertStoreAvailable();
  const key = normaliseCode(code);
  if (supabaseConfig()) {
    const rows = await request(`zc_coupons?code=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
    return (rows as unknown[]).length > 0;
  }
  const data = await readAll();
  if (!data.coupons[key]) return false;
  delete data.coupons[key];
  await writeAll(data);
  return true;
};

// ---------------------------------------------------------------------------------------
// Redemptions
// ---------------------------------------------------------------------------------------
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
    const rows = await request(`zc_coupon_redemptions?coupon_code=eq.${encodeURIComponent(key)}&select=coupon_code`);
    return (rows as unknown[]).length;
  }
  const data = await readAll();
  return Object.entries(data.redemptions).filter(([k]) => k.startsWith(`${key}|`)).length;
};

/**
 * Records the use, or returns null if this account already used this code.
 *
 * The uniqueness is the database's composite primary key, not a check here: a read-then-insert
 * would let two simultaneous redemptions of the same code both pass. In PostgREST a duplicate is
 * a 409, which is the answer we want. In the file store the check is a plain comparison, which
 * is only safe because that path is the single-process dev fallback.
 */
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

// ---------------------------------------------------------------------------------------
// Grants — the subscription record
// ---------------------------------------------------------------------------------------

/**
 * Adds one month of a plan, stacking onto whatever is still running.
 *
 * `setMonth` overflows (31 Jan + 1 month lands in March), so the day is clamped to the last day
 * of the target month. Someone who buys on the 31st should lose the difference between the 31st
 * and the 28th at most, not a whole month.
 */
export const addMonth = (from: Date): Date => {
  const result = new Date(from.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
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
  const startsAt = current && new Date(current.expiresAt) > now ? new Date(current.expiresAt) : now;
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
    const [row] = rows as (Grant & { user_email: string; plan_id: PlanId; source: GrantSource; order_code: number | null; percent: number | null; starts_at: string; expires_at: string })[];
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

/**
 * The plan this account currently has, computed at read time. Unexpired grant with the latest
 * expiry wins; no unexpired grant means the free plan. No cron writes this, so there is no job
 * that can fail and no state that can go stale.
 */
export const effectivePlan = async (userEmail: string): Promise<{ planId: PlanId; expiresAt: string } | null> => {
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
    return (rows as {
      user_email: string;
      plan_id: PlanId;
      source: GrantSource;
      order_code: number | null;
      percent: number | null;
      starts_at: string;
      expires_at: string;
    }[]).map((row) => ({
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
