import { getOrder } from '@/lib/payos/orders';

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
