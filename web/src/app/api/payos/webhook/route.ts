import { serverEnv } from '@/lib/serverEnv';
import { getOrder, markOrder, sweepStaleOrders, type OrderStatus } from '@/lib/payos/orders';
import { verifySignature } from '@/lib/payos/signature';
import { addGrant, listGrants, redeemCoupon } from '@/lib/store/account';
import { PayOS } from '@payos/node';

/** payOS webhook payload codes (https://payos.vn/docs/tich-hop-webhook/). */
const STATUS_BY_CODE: Record<string, OrderStatus> = {
  '00': 'PAID',
  '01': 'FAILED',
  '02': 'PENDING',
};

export async function POST(request: Request) {
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

  if (!checksumKey) {
    console.error('[payos] webhook rejected: PAYOS_CHECKSUM_KEY missing');
    return new Response('not configured', { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const rawData = payload.data;
  if (!rawData || typeof rawData !== 'object') return new Response('missing data', { status: 400 });

  let isVerified = false;
  if (clientId && apiKey) {
    try {
      const payos = new PayOS({ clientId, apiKey, checksumKey });
      await payos.webhooks.verify(payload as Parameters<typeof payos.webhooks.verify>[0]);
      isVerified = true;
    } catch {
      isVerified = false;
    }
  }

  if (!isVerified) {
    isVerified = verifySignature(rawData as Record<string, unknown>, payload.signature, checksumKey);
  }

  if (!isVerified) {
    console.warn('[payos] webhook rejected: bad signature');
    return new Response('invalid signature', { status: 401 });
  }

  const data = rawData as Record<string, unknown>;
  const orderCode = Number(data.orderCode);
  const amount = Number(data.amount);
  const order = await getOrder(orderCode);
  if (!order) {
    // Order was swept as stale (5-min timeout) — late webhook ignored, nothing granted.
    return new Response('unknown order', { status: 404 });
  }
  try {
    await sweepStaleOrders();
  } catch {
    /* sweep is best-effort here */
  }

  // Signature proves payOS sent this; it does not prove the amount is what we asked for.
  if (amount !== order.amountVnd) {
    console.error('[payos] webhook amount mismatch', orderCode, amount, order.amountVnd);
    return new Response('amount mismatch', { status: 409 });
  }

  // `code` is a sibling of `data` in the payOS envelope, not a field inside it. An unrecognised
  // code is refused rather than defaulted, so a future payOS status can never be read as a
  // payment we did not verify.
  const status = STATUS_BY_CODE[String(payload.code)];
  if (!status) {
    console.warn('[payos] webhook rejected: unknown code', String(payload.code));
    return new Response('unknown code', { status: 400 });
  }
  const updated = await markOrder(orderCode, status, {
    ...(status === 'PAID'
      ? {
          paidAt: new Date().toISOString(),
          reference: typeof data.reference === 'string' ? data.reference : undefined,
          bankAccount: typeof data.accountNumber === 'string' ? data.accountNumber : undefined,
        }
      : {}),
  });

  // `markOrder` refuses to move an order out of PAID, but it still returns the order either way —
  // so the guard below has to compare the state read at the top, not the fact that the write was
  // filtered. Without this, a duplicate payOS callback would stack a second free month.
  const wasAlreadyPaid = order.status === 'PAID';

  // Marking the order PAID and granting the plan are separate steps on purpose: a grant that
  // succeeded but whose order write then failed would be far worse than the other way round.
  if (status === 'PAID' && !wasAlreadyPaid && order.userEmail) {
    const existingGrants = await listGrants(order.userEmail).catch(() => []);
    const alreadyGranted = existingGrants.some((g) => g.orderCode === orderCode);
    if (!alreadyGranted) {
      if (order.couponCode) {
        // Null here means the account already used this code, which the unique key enforces. Not an
        // error: the plan is still owed, and refusing to grant it would punish the buyer for a race.
        await redeemCoupon(order.couponCode, order.userEmail, order.couponPercent ?? 0, orderCode);
      }
      const grant = await addGrant({
        userEmail: order.userEmail,
        planId: order.planId,
        source: 'PAYOS',
        orderCode,
        percent: order.couponPercent ?? null,
      });
      console.log('[payos] granted', order.planId, 'to', order.userEmail, 'until', grant.expiresAt);
    }
  }

  console.log('[payos] order', orderCode, '->', status, 'stored:', JSON.stringify(updated));
  return Response.json({ success: true, order: updated });
}
