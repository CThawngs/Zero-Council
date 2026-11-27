/**
 * Shared types, localized error mapping, and date helpers for the `/admin` console.
 */

import type { Copy } from '@/prototype/i18n';

export type Coupon = {
  code: string;
  percent: number;
  expiresAt: string | null;
  maxTotalRedemptions: number | null;
  active: boolean;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  used: number;
};

export type User = { email: string; role: 'user' | 'admin'; createdAt: string };

export type CouponFormState = {
  code: string;
  percent: string;
  expires: string;
  never: boolean;
  cap: string;
  active: boolean;
  note: string;
};

export const EMPTY_FORM: CouponFormState = {
  code: '',
  percent: '20',
  expires: '',
  never: true,
  cap: '',
  active: true,
  note: '',
};

export const ROLES = [
  {
    value: 'admin',
    label: { en: 'Administrator', vi: 'Quản trị viên' },
  },
  {
    value: 'user',
    label: { en: 'User', vi: 'Thành viên' },
  },
] as const;

export const ADMIN_LABEL_CLASS = 'mb-1 block text-sm text-ink-muted';
export const ADMIN_FIELD_CLASS =
  'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink outline-none focus:border-brass/60';
export const ADMIN_BUTTON_CLASS =
  'min-h-11 rounded-full border border-border px-4 text-sm text-ink transition hover:border-brass/50';
export const ADMIN_PRIMARY_CLASS =
  'min-h-11 rounded-full bg-brass px-5 text-sm font-medium text-accent-ink transition disabled:opacity-50';

export const adminErrorMessage = (code: string | undefined, t: Copy): string => {
  switch (code) {
    case 'INVALID_JSON':
      return t.adminErrInvalidJson;
    case 'BAD_CODE':
    case 'INVALID_CODE':
      return t.adminErrInvalidCode;
    case 'BAD_PERCENT':
    case 'INVALID_PERCENT':
      return t.adminErrInvalidPercent;
    case 'BAD_LIMIT':
    case 'INVALID_CAP':
      return t.adminErrInvalidCap;
    case 'BAD_EXPIRY':
    case 'INVALID_EXPIRY':
      return t.adminErrInvalidExpiry;
    case 'BAD_ROLE':
      return t.adminErrBadRole;
    case 'COUPON_EXISTS':
      return t.adminErrCouponExists;
    case 'CODE_IMMUTABLE':
      return t.adminErrCodeImmutable;
    case 'LAST_ADMIN':
      return t.adminErrLastAdmin;
    case 'FOUNDER_LOCKED':
      return t.adminErrFounderLocked;
    case 'ONLY_FOUNDER_CAN_DEMOTE':
      return t.adminErrOnlyFounderDemote;
    case 'ONLY_FOUNDER':
      return t.adminErrOnlyFounder;
    case 'PASSWORD_TOO_SHORT':
      return t.adminErrPasswordTooShort;
    case 'RESET_FAILED':
      return t.adminErrResetFailed;
    case 'UNKNOWN_USER':
      return t.adminErrUnknownUser;
    case 'FORBIDDEN':
      return t.adminErrForbidden;
    case 'NEED_LOGIN':
      return t.adminErrNeedLogin;
    default:
      return code || t.adminUnknownError;
  }
};

/** A date input gives a day; a coupon that expires on the 30th is usable through the 30th. */
export const endOfDay = (date: string): string | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T23:59:59.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const toDateInput = (iso: string | null): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '';
