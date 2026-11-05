import { getOrder, deleteOrder } from '@/lib/payos/orders';
import { currentAccount } from '@/lib/currentUser';

export async function GET(_request: Request, ctx: { params: Promise<{ orderCode: string }> }) {
  const { orderCode } = await ctx.params;
  const order = await getOrder(Number(orderCode));
  if (!order) return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });

  // Explicit field list, not a spread of the stored order: `reference` and `bankAccount`
  // stay on the server. Nothing in this app has proven it needs them client-side, and an
  // order row is reachable with nothing but an order code.
  return Response.json({
    orderCode: order.orderCode,
    planId: order.planId,
    amountVnd: order.amountVnd,
    amountUsd: order.amountUsd,
    status: order.status,
    paidAt: order.paidAt ?? null,
  });
}

/**
 * Cancel an unpaid bill. Closing the QR popup (X / backdrop / Esc) or the 5-minute countdown
 * hitting zero calls this. The pending order row is deleted permanently — a failed or abandoned
 * transaction is never kept. A PAID order is terminal and cannot be cancelled.
 */
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
