/**
 * Validation for the admin coupon form.
 *
 * An admin is trusted, but the admin page is still a browser sending JSON, so the numbers are
 * clamped here rather than trusted into the store. Failing early also gives a readable message
 * instead of a 400 from Postgres quoting a check constraint nobody remembers writing.
 */

const CODE_PATTERN = /^[A-Z0-9_-]{1,32}$/;

export interface CouponInput {
  code: string;
  percent: number;
  expiresAt: string | null;
  maxTotalRedemptions: number | null;
  active: boolean;
  note: string | null;
}

export type CouponInputResult = { ok: true; value: CouponInput } | { ok: false; error: string };

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value));

export const parseCouponInput = (raw: unknown): CouponInputResult => {
  const body = (raw ?? {}) as Record<string, unknown>;
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return { ok: false, error: 'BAD_CODE' };

  const percent = Number(body.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { ok: false, error: 'BAD_PERCENT' };

  const rawExpiry = body.expiresAt;
  const expiresAt = rawExpiry === undefined || rawExpiry === null || rawExpiry === '' ? null : rawExpiry;
  if (expiresAt !== null && !isTimestamp(expiresAt)) return { ok: false, error: 'BAD_EXPIRY' };

  const cap = body.maxTotalRedemptions;
  const maxTotalRedemptions = cap === undefined || cap === null || cap === '' ? null : Number(cap);
  if (maxTotalRedemptions !== null && (!Number.isInteger(maxTotalRedemptions) || maxTotalRedemptions < 1)) {
    return { ok: false, error: 'BAD_LIMIT' };
  }

  const note = typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim().slice(0, 280) : null;
  const active = body.active === undefined ? true : Boolean(body.active);

  return { ok: true, value: { code, percent, expiresAt, maxTotalRedemptions, active, note } };
};
