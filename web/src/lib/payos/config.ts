import { randomInt } from 'node:crypto';
import { serverEnv } from '../serverEnv.ts';

export interface PayosCredentials {
  clientId?: string;
  apiKey?: string;
  checksumKey?: string;
}

/**
 * Reads PayOS server-side credentials from canonical `PAYOS_*` env vars with legacy `PAYLOS_*`
 * fallback aliases. Client-exposed `NEXT_PUBLIC_*` variables are intentionally never consulted.
 */
export const getPayosCredentials = (): PayosCredentials => {
  const clientId = serverEnv('PAYOS_CLIENT_ID') ?? serverEnv('PAYLOS_CLIENT_ID');
  const apiKey = serverEnv('PAYOS_API_KEY') ?? serverEnv('PAYLOS_API_KEY');
  const checksumKey =
    serverEnv('PAYOS_CHECKSUM_KEY') ??
    serverEnv('PAYLOS_CHECKSUM_KEY') ??
    serverEnv('PAYOS_CHECKSUM');
  return { clientId, apiKey, checksumKey };
};

/** True only when all three server-side PayOS credentials are present. */
export const isPayosConfigured = (): boolean => {
  const { clientId, apiKey, checksumKey } = getPayosCredentials();
  return Boolean(clientId && apiKey && checksumKey);
};

/**
 * Local offline PayOS simulation is strictly restricted to local `development` mode when not
 * running on Vercel and when real PayOS credentials are absent.
 */
export const isPayosDevSimulationAllowed = (): boolean =>
  process.env.NODE_ENV === 'development' &&
  serverEnv('VERCEL') !== '1' &&
  !isPayosConfigured();

/**
 * Generates a collision-resistant positive integer `orderCode` safely within
 * `Number.MAX_SAFE_INTEGER` (`~1.79e14 < 9.007e15`).
 */
export const generateOrderCode = (
  nowMs: number = Date.now(),
  jitter: number = randomInt(0, 100)
): number => {
  const safeJitter = ((Math.floor(jitter) % 100) + 100) % 100;
  return Math.floor(nowMs) * 100 + safeJitter;
};

/**
 * Computes the proportional USD display reference after applying a percentage coupon so
 * `/checkout/return` and order history reflect discounted amounts accurately.
 */
export const amountUsdAfterCoupon = (baseUsd: string, percent: number): string => {
  const parsed = Number(baseUsd);
  if (!Number.isFinite(parsed) || parsed <= 0 || percent >= 100) {
    return '0.00';
  }
  if (percent <= 0) {
    return baseUsd;
  }
  return ((parsed * (100 - percent)) / 100).toFixed(2);
};
