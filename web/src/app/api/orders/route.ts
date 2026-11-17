import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { listOrdersByUser } from '@/lib/payos/orders';
import { effectivePlan, listGrants } from '@/lib/store/account';

export async function GET() {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const [orders, grants, activePlan] = await Promise.all([
      listOrdersByUser(user.email),
      listGrants(user.email),
      effectivePlan(user.email),
    ]);
    return Response.json({
      activePlan,
      orders: orders
        .filter((o) => o.status === 'PAID')
        .map((o) => ({
          orderCode: o.orderCode,
          planId: o.planId,
          amountVnd: o.amountVnd,
          amountUsd: o.amountUsd,
          status: o.status,
          createdAt: o.createdAt,
          paidAt: o.paidAt ?? o.createdAt,
          couponPercent: o.couponPercent ?? null,
        })),
      grants: grants.map((g) => ({
        planId: g.planId,
        source: g.source,
        orderCode: g.orderCode,
        percent: g.percent,
        startsAt: g.startsAt,
        expiresAt: g.expiresAt,
      })),
    });
  } catch (error) {
    console.error('[orders] list failed:', (error as Error).message);
    return Response.json({ error: 'LIST_FAILED', orders: [], grants: [] }, { status: 500 });
  }
}
