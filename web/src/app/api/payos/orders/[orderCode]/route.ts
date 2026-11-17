import { deleteOrder, getOrder, markOrder, type Order } from '@/lib/payos/orders';
import { currentAccount } from '@/lib/currentUser';
import { serverEnv } from '@/lib/serverEnv';
import { addGrant, listGrants, redeemCoupon } from '@/lib/store/account';

const syncPendingOrderWithPayos = async (order: Order): Promise<Order> => {
  if (order.status !== 'PENDING') return order;
  const clientId = serverEnv('PAYLOS_CLIENT_ID');
  const apiKey = serverEnv('PAYLOS_API_KEY');
  if (!clientId || !apiKey) return order;

  try {
    const response = await fetch(
      `https://api-merchant.payos.vn/v2/payment-requests/${order.orderCode}`,
      {
        headers: {
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!response.ok) return order;
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      data?: { status?: string; amountPaid?: number; amount?: number };
    } | null;
    if (payload?.code !== '00' || !payload.data) return order;

    const remoteStatus = String(payload.data.status ?? '').toUpperCase();
    const amountPaid = Number(payload.data.amountPaid ?? 0);
    if (remoteStatus === 'PAID' && amountPaid >= order.amountVnd) {
      const updated =
        (await markOrder(order.orderCode, 'PAID', { paidAt: new Date().toISOString() })) ?? order;
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
  } catch {
    // Transient upstream failure: keep current stored status for next poll.
  }
  return order;
};

export async function GET(_request: Request, ctx: { params: Promise<{ orderCode: string }> }) {
  const { orderCode } = await ctx.params;
  const stored = await getOrder(Number(orderCode));
  if (!stored) return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });

  const order = await syncPendingOrderWithPayos(stored);

  return Response.json({
    orderCode: order.orderCode,
    planId: order.planId,
    amountVnd: order.amountVnd,
    amountUsd: order.amountUsd,
    status: order.status,
    paidAt: order.paidAt ?? null,
  });
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

  await deleteOrder(Number(orderCode));
  return Response.json({ cancelled: true, orderCode: order.orderCode });
}
