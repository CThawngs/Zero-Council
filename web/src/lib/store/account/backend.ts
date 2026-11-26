/**
 * Account, coupon, redemption, and plan-grant persistence primitives (PostgREST + dev file fallback).
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '../../serverEnv.ts';
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
  /** Percentage only ("coupon always discounts by %"). */
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

export interface FileShape {
  users: Record<string, AccountUser>;
  coupons: Record<string, Coupon>;
  redemptions: Record<string, Redemption>;
  grants: Grant[];
}

export const supabaseConfig = () => {
  const url = (serverEnv('SUPABASE_URL') ?? serverEnv('NEXT_PUBLIC_SUPABASE_URL'))?.replace(
    /\/+$/,
    ''
  );
  const key = serverEnv('SUPABASE_SERVICE_ROLE_KEY') ?? serverEnv('SUPABASE_SERVICE_KEY');
  return url && key ? { url, key } : null;
};

export const request = async (pathAndQuery: string, init: RequestInit = {}): Promise<unknown> => {
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

const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH = serverEnv('ZC_ACCOUNT_STORE') ?? path.join(process.cwd(), '.zc-account.json');

const emptyFile = (): FileShape => ({ users: {}, coupons: {}, redemptions: {}, grants: [] });

export const readAll = async (): Promise<FileShape> => {
  try {
    return {
      ...emptyFile(),
      ...JSON.parse(await readFile(/* turbopackIgnore: true */ STORE_PATH, 'utf8')),
    };
  } catch {
    return emptyFile();
  }
};

export const writeAll = (data: FileShape) =>
  writeFile(/* turbopackIgnore: true */ STORE_PATH, JSON.stringify(data, null, 2), 'utf8');

export const assertStoreAvailable = () => {
  if (supabaseConfig()) return;
  if (EPHEMERAL) {
    throw new Error(
      'SUPABASE_NOT_CONFIGURED: this host has an ephemeral filesystem (VERCEL=1) and needs ' +
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The file store is refused here on purpose — ' +
        'coupons and plan grants written to a local file would not survive the instance.'
    );
  }
};

export const normaliseCode = (code: string) => code.trim().toUpperCase();
export const redemptionKey = (code: string, email: string) =>
  `${normaliseCode(code)}|${email.trim().toLowerCase()}`;
