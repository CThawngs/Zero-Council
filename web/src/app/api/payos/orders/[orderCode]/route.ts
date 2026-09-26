import { getOrder } from '@/lib/payos/orders';

export async function GET(_request: Request, ctx: { params: Promise<{ orderCode: string }> }) {
  const { orderCode } = await ctx.params;
  const order = await getOrder(Number(orderCode));
  if (!order) return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });

  // Bank account + reference only reach the buyer, never the credentials used to create the order.
  return Response.json({
    orderCode: order.orderCode,
    planId: order.planId,
    amountVnd: order.amountVnd,
    amountUsd: order.amountUsd,
    status: order.status,
    paidAt: order.paidAt ?? null,
  });
}
