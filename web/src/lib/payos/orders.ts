import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PlanId } from '@/prototype/data/plans';
import { serverEnv } from '../serverEnv.ts';

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

export interface Order {
  orderCode: number;
  planId: PlanId;
  /** Integer VND, copied from plans.ts at creation time. Never taken from the request. */
  amountVnd: number;
  amountUsd: string;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  reference?: string;
  bankAccount?: string;
}

const TABLE = 'zc_orders';

/** One row as Postgres returns it — snake_case, absent columns come back null. */
interface OrderRow {
  order_code: number;
  plan_id: PlanId;
  amount_vnd: number;
  amount_usd: string;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  reference: string | null;
  bank_account: string | null;
}

const toOrder = (row: OrderRow): Order => ({
  orderCode: row.order_code,
  planId: row.plan_id,
  amountVnd: row.amount_vnd,
  amountUsd: row.amount_usd,
  status: row.status,
  createdAt: row.created_at,
  ...(row.paid_at ? { paidAt: row.paid_at } : {}),
  ...(row.reference ? { reference: row.reference } : {}),
  ...(row.bank_account ? { bankAccount: row.bank_account } : {}),
});

const toRow = (order: Order): OrderRow => ({
  order_code: order.orderCode,
  plan_id: order.planId,
  amount_vnd: order.amountVnd,
  amount_usd: order.amountUsd,
  status: order.status,
  created_at: order.createdAt,
  paid_at: order.paidAt ?? null,
  reference: order.reference ?? null,
  bank_account: order.bankAccount ?? null,
});

/**
 * Postgres via PostgREST — the REST layer every Supabase project already exposes — reached
 * with plain `fetch`. That keeps the dependency list at four packages instead of adding the
 * Supabase SDK for three CRUD calls. See web/supabase/migrations/0001_zc_orders.sql.
 */
const supabaseConfig = () => {
  const url = serverEnv('SUPABASE_URL')?.replace(/\/+$/, '');
  const key = serverEnv('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? { url, key } : null;
};

const request = async (pathAndQuery: string, init: RequestInit = {}): Promise<unknown> => {
  const config = supabaseConfig();
  if (!config) throw new Error('ORDER_STORE_NOT_CONFIGURED');
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
    // Body included: a schema drift between the migration and this file is the single most
    // likely cause, and "400 Bad Request" alone never says which column is wrong.
    const body = await response.text().catch(() => '');
    throw new Error(`SUPABASE_${response.status}:${body.slice(0, 300)}`);
  }
  return response.json();
};

// ---------------------------------------------------------------------------------------
// Local development fallback: a JSON file, because nobody can run the app before the
// Supabase project exists. ponytail: dev only — single process, no concurrency.
//
// The guard keys off Vercel, not NODE_ENV. `next start` is a production build too, and it is
// how the app gets verified locally — refusing the file there would break every local
// checkout run. What actually destroys orders is an ephemeral filesystem, which is exactly
// what Vercel is. Deploying somewhere else serverless? Set the database instead; if you
// truly have a persistent disk, nothing here is fighting you.
const EPHEMERAL = process.env.VERCEL === '1';
const STORE_PATH = serverEnv('ZC_ORDER_STORE') ?? path.join(process.cwd(), '.zc-orders.json');

// turbopackIgnore on both calls: the path is an env value, so Turbopack cannot scope it and
// would trace the entire project into the server bundle. Unwarranted here — the file store is
// the dev-only fallback and the deployed path is Postgres.
const readAll = async (): Promise<Record<string, Order>> => {
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ STORE_PATH, 'utf8')) as Record<string, Order>;
  } catch {
    return {};
  }
};

const writeAll = (orders: Record<string, Order>) =>
  writeFile(/* turbopackIgnore: true */ STORE_PATH, JSON.stringify(orders, null, 2), 'utf8');

const assertStoreAvailable = () => {
  if (supabaseConfig()) return;
  if (EPHEMERAL) {
    throw new Error(
      'SUPABASE_NOT_CONFIGURED: this host has an ephemeral filesystem (VERCEL=1) and needs ' +
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The file store is refused here on ' +
        'purpose — a deployed instance that falls back to a local file loses orders and ' +
        'confirms no payments.'
    );
  }
};

export const putOrder = async (order: Order): Promise<void> => {
  assertStoreAvailable();
  if (supabaseConfig()) {
    await request(`${TABLE}?on_conflict=order_code`, {
      method: 'POST',
      body: JSON.stringify(toRow(order)),
    });
    return;
  }
  const orders = await readAll();
  orders[String(order.orderCode)] = order;
  await writeAll(orders);
};

export const getOrder = async (orderCode: number): Promise<Order | null> => {
  assertStoreAvailable();
  if (supabaseConfig()) {
    const rows = await request(
      `${TABLE}?order_code=eq.${orderCode}&select=*`,
      { headers: { Accept: 'application/json' } }
    );
    const [row] = rows as OrderRow[];
    return row ? toOrder(row) : null;
  }
  const orders = await readAll();
  return orders[String(orderCode)] ?? null;
};

export const markOrder = async (
  orderCode: number,
  status: OrderStatus,
  extra: Partial<Order> = {}
): Promise<Order | null> => {
  assertStoreAvailable();

  if (supabaseConfig()) {
    // A paid order is terminal: payOS re-sending a late "failed" or "pending" must not
    // revoke a real payment. The guard lives in the write itself, not only in the caller,
    // because the webhook is the only writer and it can fire out of order. `status.neq.PAID`
    // also means a duplicate PAID webhook cannot overwrite the original paidAt — the PATCH
    // matches nothing and the existing row is read back instead.
    const patch: Record<string, unknown> = { status, ...extra };
    if (status === 'PAID') patch.paid_at = extra.paidAt ?? new Date().toISOString();
    const rows = await request(`${TABLE}?order_code=eq.${orderCode}&status.neq.PAID`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const [row] = rows as OrderRow[];
    if (row) return toOrder(row);
    // Nothing updated: either the order is unknown, or it is already PAID and this webhook
    // was late. Reading it back tells the caller which, without a second round trip on
    // the common path.
    return getOrder(orderCode);
  }

  const orders = await readAll();
  const existing = orders[String(orderCode)];
  if (!existing) return null;
  if (existing.status === 'PAID' && status !== 'PAID') return existing;
  const updated: Order = { ...existing, ...extra, status };
  orders[String(orderCode)] = updated;
  await writeAll(orders);
  return updated;
};
