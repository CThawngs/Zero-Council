import { deleteOrder, getOrder, markOrder, type Order } from '@/lib/payos/orders';
import { currentAccount } from '@/lib/currentUser';
import { serverEnv } from '@/lib/serverEnv';
import { addGrant, listGrants, redeemCoupon } from '@/lib/store/account';

const getPayosAuth = () => {
  const clientId = serverEnv('PAYLOS_CLIENT_ID') ?? serverEnv('PAYOS_CLIENT_ID');
  const apiKey = serverEnv('PAYLOS_API_KEY') ?? serverEnv('PAYOS_API_KEY');
  return clientId && apiKey ? { clientId, apiKey } : null;
};

const syncPendingOrderWithPayos = async (order: Order): Promise<Order> => {
  if (order.status !== 'PENDING') return order;
  const auth = getPayosAuth();
  if (!auth) return order;

  try {
    const response = await fetch(
      `https://api-merchant.payos.vn/v2/payment-requests/${order.orderCode}`,
      {
        headers: {
          'x-client-id': auth.clientId,
          'x-api-key': auth.apiKey,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!response.ok) return order;
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      data?: {
        status?: string;
        amountPaid?: number;
        amount?: number;
        transactions?: { reference?: string; accountNumber?: string }[];
      };
    } | null;
    if (payload?.code !== '00' || !payload.data) return order;

    const remoteStatus = String(payload.data.status ?? '').toUpperCase();
    const amountPaid = Number(payload.data.amountPaid ?? 0);
    if (remoteStatus === 'PAID' && amountPaid >= order.amountVnd) {
      const tx = payload.data.transactions?.[0];
      const updated =
        (await markOrder(order.orderCode, 'PAID', {
          paidAt: new Date().toISOString(),
          ...(typeof tx?.reference === 'string' ? { reference: tx.reference } : {}),
          ...(typeof tx?.accountNumber === 'string' ? { bankAccount: tx.accountNumber } : {}),
        })) ?? order;
      if (order.userEmail) {
        const existingGrants = await listGrants(order.userEmail).catch(() => []);
        const alreadyGranted = existingGrants.some((g) => g.orderCode === order.orderCode);
        if (!alreadyGranted) {
          if (order.couponCode) {
            await redeemCoupon(
              order.couponCode,
              order.userEmail,
              order.couponPercent ?? 0,
              order.orderCode
            ).catch(() => null);
          }
          await addGrant({
            userEmail: order.userEmail,
            planId: order.planId,
            source: 'PAYOS',
            orderCode: order.orderCode,
            percent: order.couponPercent ?? null,
          });
        }
      }
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

export async function GET(_request: Request, ctx: { params: Promise<{ orderCode: string }> }) {
  const { orderCode } = await ctx.params;
  const stored = await getOrder(Number(orderCode));
  if (!stored) return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });

  const order = await syncPendingOrderWithPayos(stored);

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
}

export async function POST(_request: Request, ctx: { params: Promise<{ orderCode: string }> }) {
  const { orderCode } = await ctx.params;
  const account = await currentAccount();
  if (!account) return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });

  const order = await getOrder(Number(orderCode));
  if (!order) return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
  if (order.userEmail !== account.email) {
    return Response.json({ error: 'NOT_ORDER_OWNER' }, { status: 403 });
  }
  if (order.status === 'PAID') {
    return Response.json({ error: 'ALREADY_PAID' }, { status: 409 });
  }

  // Best-effort cancel on PayOS so the QR code cannot be paid after closing/expiry.
  const auth = getPayosAuth();
  if (auth) {
    await fetch(`https://api-merchant.payos.vn/v2/payment-requests/${order.orderCode}/cancel`, {
      method: 'POST',
      headers: {
        'x-client-id': auth.clientId,
        'x-api-key': auth.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancellationReason: 'Cancelled or expired in checkout' }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
  }

  await deleteOrder(Number(orderCode));
  return Response.json({ cancelled: true, orderCode: order.orderCode });
}
