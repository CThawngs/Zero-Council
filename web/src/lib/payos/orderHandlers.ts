import { isPayosDevSimulationAllowed } from './config.ts';
import type { Order, OrderStatus } from './orders.ts';
import { enforceRateLimit } from '../security/rate-limit.ts';
import { verifySameOrigin } from '../security/request-guard.ts';
import type { AccountUser, Grant, GrantSource } from '../store/account.ts';

export interface PayosPaymentLookup {
  status?: unknown;
  amountPaid?: unknown;
  transactions?: { reference?: unknown; accountNumber?: unknown }[];
}

export interface PayosClientLike {
  paymentRequests: {
    get: (orderCode: number) => Promise<PayosPaymentLookup | null | undefined>;
    cancel: (orderCode: number, reason?: string) => Promise<unknown>;
  };
}

export interface PayosOrderHandlerDeps {
  currentAccount: () => Promise<AccountUser | null>;
  getOrder: (orderCode: number) => Promise<Order | null>;
  markOrder: (
    orderCode: number,
    status: OrderStatus,
    extra?: { paidAt?: string; reference?: string; bankAccount?: string }
  ) => Promise<Order | null>;
  deleteOrder: (orderCode: number) => Promise<boolean | void>;
  listGrants: (email: string) => Promise<Grant[]>;
  addGrant: (input: {
    userEmail: string;
    planId: Order['planId'];
    source: GrantSource;
    orderCode: number | null;
    percent: number | null;
  }) => Promise<Grant>;
  redeemCoupon: (
    code: string,
    email: string,
    percent: number,
    orderCode: number
  ) => Promise<unknown>;
  getPayosClient: () => PayosClientLike | null;
}

const parseOrderCodeParam = (raw: string): number | null => {
  const numeric = Number(raw);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null;
  return numeric;
};

const grantOrderIfUnclaimed = async (order: Order, deps: PayosOrderHandlerDeps): Promise<void> => {
  if (!order.userEmail) return;
  const existingGrants = await deps.listGrants(order.userEmail).catch(() => []);
  const alreadyGranted = existingGrants.some((grant) => grant.orderCode === order.orderCode);
  if (alreadyGranted) return;

  if (order.couponCode) {
    await deps
      .redeemCoupon(order.couponCode, order.userEmail, order.couponPercent ?? 0, order.orderCode)
      .catch(() => null);
  }
  await deps.addGrant({
    userEmail: order.userEmail,
    planId: order.planId,
    source: 'PAYOS',
    orderCode: order.orderCode,
    percent: order.couponPercent ?? null,
  });
};

const syncPendingOrderWithPayos = async (
  order: Order,
  deps: PayosOrderHandlerDeps
): Promise<Order> => {
  if (order.status !== 'PENDING') return order;
  const payos = deps.getPayosClient();
  if (!payos) return order;

  try {
    const paymentInfo = await payos.paymentRequests.get(order.orderCode);
    if (!paymentInfo) return order;

    const remoteStatus = String(paymentInfo.status ?? '').toUpperCase();
    const amountPaid = Number(paymentInfo.amountPaid ?? 0);
    if (remoteStatus === 'PAID' && amountPaid >= order.amountVnd) {
      const tx = paymentInfo.transactions?.[0];
      const updated =
        (await deps.markOrder(order.orderCode, 'PAID', {
          paidAt: new Date().toISOString(),
          ...(typeof tx?.reference === 'string' ? { reference: tx.reference } : {}),
          ...(typeof tx?.accountNumber === 'string' ? { bankAccount: tx.accountNumber } : {}),
        })) ?? order;
      await grantOrderIfUnclaimed(order, deps);
      return updated;
    }
    if (remoteStatus === 'EXPIRED') {
      return { ...order, status: 'EXPIRED' };
    }
    if (remoteStatus === 'CANCELLED') {
      return { ...order, status: 'FAILED' };
    }
  } catch (error) {
    console.error('[payos] syncPendingOrderWithPayos failed:', (error as Error).message);
  }
  return order;
};

/**
 * Builds authenticated, rate-limited, and CSRF-protected handlers for `/api/payos/orders/[orderCode]`.
 *
 * Security invariants:
 * - `GET` requires a signed-in user who owns the order (`stored.userEmail === account.email`).
 * - `POST` (cancel) requires same-origin CSRF headers, authentication, and order ownership.
 * - `PATCH` (dev-only payment simulation) is hard-disabled (`404`) whenever `NODE_ENV !== 'development'`,
 *   `VERCEL === '1'`, or real PayOS credentials are configured, and still enforces CSRF + owner auth in dev.
 */
export const createPayosOrderHandlers = (deps: PayosOrderHandlerDeps) => {
  const GET = async (
    request: Request,
    ctx: { params: Promise<{ orderCode: string }> }
  ): Promise<Response> => {
    const account = await deps.currentAccount();
    if (!account) {
      return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
    }

    const limited = enforceRateLimit(request, {
      scope: 'payos:order-get',
      limit: 60,
      windowMs: 60_000,
      subject: account.email,
    });
    if (limited) return limited;

    const { orderCode: rawCode } = await ctx.params;
    const orderCode = parseOrderCodeParam(rawCode);
    if (orderCode === null) {
      return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
    }

    const stored = await deps.getOrder(orderCode);
    if (!stored) {
      return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
    }
    if (!stored.userEmail || stored.userEmail.toLowerCase() !== account.email.toLowerCase()) {
      return Response.json({ error: 'NOT_ORDER_OWNER' }, { status: 403 });
    }

    const order = await syncPendingOrderWithPayos(stored, deps);
    return Response.json(
      {
        orderCode: order.orderCode,
        planId: order.planId,
        amountVnd: order.amountVnd,
        amountUsd: order.amountUsd,
        status: order.status,
        paidAt: order.paidAt ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  };

  const POST = async (
    request: Request,
    ctx: { params: Promise<{ orderCode: string }> }
  ): Promise<Response> => {
    const csrfDenied = verifySameOrigin(request);
    if (csrfDenied) return csrfDenied;

    const account = await deps.currentAccount();
    if (!account) {
      return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
    }

    const limited = enforceRateLimit(request, {
      scope: 'payos:order-cancel',
      limit: 30,
      windowMs: 60_000,
      subject: account.email,
    });
    if (limited) return limited;

    const { orderCode: rawCode } = await ctx.params;
    const orderCode = parseOrderCodeParam(rawCode);
    if (orderCode === null) {
      return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
    }

    const order = await deps.getOrder(orderCode);
    if (!order) {
      return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
    }
    if (!order.userEmail || order.userEmail.toLowerCase() !== account.email.toLowerCase()) {
      return Response.json({ error: 'NOT_ORDER_OWNER' }, { status: 403 });
    }
    if (order.status === 'PAID') {
      return Response.json({ error: 'ALREADY_PAID' }, { status: 409 });
    }

    const payos = deps.getPayosClient();
    if (payos) {
      try {
        await payos.paymentRequests.cancel(order.orderCode, 'Cancelled by user');
      } catch {
        // Best-effort remote cancellation cleanup
      }
    }

    await deps.deleteOrder(orderCode);
    return Response.json({ cancelled: true, orderCode: order.orderCode });
  };

  const PATCH = async (
    request: Request,
    ctx: { params: Promise<{ orderCode: string }> }
  ): Promise<Response> => {
    if (!isPayosDevSimulationAllowed()) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const csrfDenied = verifySameOrigin(request);
    if (csrfDenied) return csrfDenied;

    const account = await deps.currentAccount();
    if (!account) {
      return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
    }

    const { orderCode: rawCode } = await ctx.params;
    const orderCode = parseOrderCodeParam(rawCode);
    if (orderCode === null) {
      return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
    }

    const stored = await deps.getOrder(orderCode);
    if (!stored) {
      return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
    }
    if (!stored.userEmail || stored.userEmail.toLowerCase() !== account.email.toLowerCase()) {
      return Response.json({ error: 'NOT_ORDER_OWNER' }, { status: 403 });
    }

    const updated =
      (await deps.markOrder(orderCode, 'PAID', { paidAt: new Date().toISOString() })) ?? stored;
    await grantOrderIfUnclaimed(stored, deps);
    return Response.json({ ok: true, order: updated });
  };

  return { GET, POST, PATCH };
};
