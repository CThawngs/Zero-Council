import { deleteOrder, getOrder, markOrder, type Order } from '@/lib/payos/orders';
import { currentAccount } from '@/lib/currentUser';
import { serverEnv } from '@/lib/serverEnv';
import { addGrant, listGrants, redeemCoupon } from '@/lib/store/account';
import { PayOS } from '@payos/node';

const getPayosClient = () => {
  const clientId =
    serverEnv('PAYOS_CLIENT_ID') ??
    serverEnv('PAYLOS_CLIENT_ID') ??
    serverEnv('NEXT_PUBLIC_PAYOS_CLIENT_ID');
  const apiKey =
    serverEnv('PAYOS_API_KEY') ??
    serverEnv('PAYLOS_API_KEY') ??
    serverEnv('NEXT_PUBLIC_PAYOS_API_KEY');
  const checksumKey =
    serverEnv('PAYOS_CHECKSUM_KEY') ??
    serverEnv('PAYLOS_CHECKSUM_KEY') ??
    serverEnv('PAYOS_CHECKSUM');
  if (!clientId || !apiKey || !checksumKey) return null;
  return new PayOS({ clientId, apiKey, checksumKey });
};

const syncPendingOrderWithPayos = async (order: Order): Promise<Order> => {
  if (order.status !== 'PENDING') return order;
  const payos = getPayosClient();
  if (!payos) return order;

  try {
    const paymentInfo = await payos.paymentRequests.get(order.orderCode);
    if (!paymentInfo) return order;

    const remoteStatus = String(paymentInfo.status ?? '').toUpperCase();
    const amountPaid = Number(paymentInfo.amountPaid ?? 0);
    if (remoteStatus === 'PAID' && amountPaid >= order.amountVnd) {
      const tx = paymentInfo.transactions?.[0];
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
  const payos = getPayosClient();
  if (payos) {
    try {
      await payos.paymentRequests.cancel(order.orderCode, 'Cancelled by user');
    } catch {
      // Best-effort cleanup
    }
  }

  await deleteOrder(Number(orderCode));
  return Response.json({ cancelled: true, orderCode: order.orderCode });
}

export async function PATCH(_request: Request, ctx: { params: Promise<{ orderCode: string }> }) {
  const { orderCode } = await ctx.params;
  const stored = await getOrder(Number(orderCode));
  if (!stored) return Response.json({ error: 'UNKNOWN_ORDER' }, { status: 404 });
  const updated =
    (await markOrder(Number(orderCode), 'PAID', { paidAt: new Date().toISOString() })) ?? stored;
  if (stored.userEmail) {
    const existingGrants = await listGrants(stored.userEmail).catch(() => []);
    const alreadyGranted = existingGrants.some((g) => g.orderCode === stored.orderCode);
    if (!alreadyGranted) {
      if (stored.couponCode) {
        await redeemCoupon(
          stored.couponCode,
          stored.userEmail,
          stored.couponPercent ?? 0,
          stored.orderCode
        ).catch(() => null);
      }
      await addGrant({
        userEmail: stored.userEmail,
        planId: stored.planId,
        source: 'PAYOS',
        orderCode: stored.orderCode,
        percent: stored.couponPercent ?? null,
      });
    }
  }
  return Response.json({ ok: true, order: updated });
}
