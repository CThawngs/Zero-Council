/**
 * Discount codes live in `PAYLOS_DISCOUNT_CODES` on the server, as `CODE=AMOUNT_VND`
 * separated by commas: `WELCOME=10000,PARTNER=25000`. Nothing here is invented — with the
 * variable unset every code is rejected, which is the correct default for an unconfigured shop.
 *
 * ponytail: a flat VND amount per code, re-read from env on every call. Percentage codes,
 * expiry, single-use limits and per-plan scopes need a real table; move this into the order
 * store when the first one of those is actually needed.
 */
import { serverEnv } from '../serverEnv.ts';

export const discountFor = (code: string): number | null => {
  const raw = serverEnv('PAYLOS_DISCOUNT_CODES') ?? '';
  for (const pair of raw.split(',')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim().toUpperCase();
    const value = Number(pair.slice(separator + 1).trim());
    if (name === code.trim().toUpperCase() && Number.isInteger(value) && value > 0) return value;
  }
  return null;
};
