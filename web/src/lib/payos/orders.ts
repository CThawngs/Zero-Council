import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PlanId } from '@/prototype/data/plans';
import { payosEnv } from './env.ts';

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

const STORE_PATH = payosEnv('ZC_ORDER_STORE') ?? path.join(process.cwd(), '.zc-orders.json');

/**
 * ponytail: one JSON file on the local filesystem, no database. That caps this at a single
 * Node process on a persistent disk — it breaks on serverless (ephemeral FS), on more than one
 * instance, and races under concurrent writes. Upgrade to Postgres/Supabase when the plan needs
 * to be honoured across machines; the read/write shape below is already what that migration needs.
 */
const readAll = async (): Promise<Record<string, Order>> => {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8')) as Record<string, Order>;
  } catch {
    return {};
  }
};

const writeAll = (orders: Record<string, Order>) =>
  writeFile(STORE_PATH, JSON.stringify(orders, null, 2), 'utf8');

export const putOrder = async (order: Order): Promise<void> => {
  const orders = await readAll();
  orders[String(order.orderCode)] = order;
  await writeAll(orders);
};

export const getOrder = async (orderCode: number): Promise<Order | null> => {
  const orders = await readAll();
  return orders[String(orderCode)] ?? null;
};

export const markOrder = async (
  orderCode: number,
  status: OrderStatus,
  extra: Partial<Order> = {}
): Promise<Order | null> => {
  const orders = await readAll();
  const existing = orders[String(orderCode)];
  if (!existing) return null;
  // A paid order is terminal: payOS re-sending a late "failed" must not revoke a real payment.
  if (existing.status === 'PAID' && status !== 'PAID') return existing;
  const updated: Order = { ...existing, ...extra, status };
  orders[String(orderCode)] = updated;
  await writeAll(orders);
  return updated;
};
