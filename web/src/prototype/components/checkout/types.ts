/**
 * Shared types and formatting utilities for the PayOS 30-day pass checkout modals.
 */

import { encodeQrDataUri } from '@/lib/qr-svg';
import type { Plan, PlanId } from '../../data/plans';

export interface AppliedCoupon {
  planId: PlanId;
  code: string;
  percent: number;
  originalVnd: number;
  discountedVnd: number;
  discountVnd: number;
}

export interface QrSession {
  orderCode: number;
  qrCode: string;
  amountVnd: number;
  originalAmountVnd: number;
  couponCode: string | null;
  couponPercent: number;
  plan: Plan;
  planName: string;
  expiredAt: number;
}

export const BILL_TTL_MS = 5 * 60 * 1000;

const enNumber = new Intl.NumberFormat('en-US');

export const formatVnd = (amountVnd: number): string => `₫${enNumber.format(amountVnd)}`;

/**
 * Resolves a PayOS QR payload into a safe renderable image source.
 * EMVCo VietQR strings are rendered locally via `encodeQrDataUri` without third-party leaks.
 */
export const qrSrc = (qrCode: string): string => {
  const trimmed = qrCode.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('iVBOR')) return `data:image/png;base64,${trimmed}`;
  try {
    return encodeQrDataUri(trimmed, 4);
  } catch {
    return '';
  }
};

export const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
