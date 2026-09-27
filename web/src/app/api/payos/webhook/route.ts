import { serverEnv } from '@/lib/serverEnv';
import { getOrder, markOrder, type OrderStatus } from '@/lib/payos/orders';
import { verifySignature } from '@/lib/payos/signature';
import { addGrant, redeemCoupon } from '@/lib/store/account';

/** payOS webhook payload codes (https://payos.vn/docs/tich-hop-webhook/). */
const STATUS_BY_CODE: Record<string, OrderStatus> = {
  '00': 'PAID',
  '01': 'FAILED',
  '02': 'PENDING',
};

export async function POST(request: Request) {
  const checksumKey = serverEnv('PAYLOS_CHECKSUM_KEY');
  if (!checksumKey) {
    console.error('[payos] webhook rejected: PAYOS_CHECKSUM_KEY missing');
    return new Response('not configured', { status: 503 });
  }

  let payload: { code?: unknown; data?: Record<string, unknown>; signature?: unknown };
  try {
    payload = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const data = payload.data;
  if (!data || typeof data !== 'object') return new Response('missing data', { status: 400 });

  // Unverified webhook = anyone can grant themselves a plan. This check is the whole point.
  if (!verifySignature(data, payload.signature, checksumKey)) {
    console.warn('[payos] webhook rejected: bad signature');
    return new Response('invalid signature', { status: 401 });
  }

  const orderCode = Number(data.orderCode);
  const amount = Number(data.amount);
  const order = await getOrder(orderCode);
  if (!order) return new Response('unknown order', { status: 404 });

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

  console.log('[payos] order', orderCode, '->', status, 'stored:', JSON.stringify(updated));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
