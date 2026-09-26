import { PLANS } from '@/prototype/data/plans';
import { discountFor } from '@/lib/payos/discount';
import { payosEnv } from '@/lib/payos/env';
import { signData, verifySignature } from '@/lib/payos/signature';
import { putOrder } from '@/lib/payos/orders';

// payOS v2 create-payment. The v1 `/payment/create` path the older docs showed now answers 404.
const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

const env = (key: string): string => {
  const value = payosEnv(key);
  if (!value) throw new Error(`MISSING_ENV:${key}`);
  return value;
};

/**
 * The browser only ever names a plan. The amount is read from plans.ts on the server, so a
 * tampered client cannot choose what it pays.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const planId = (body as { planId?: unknown } | null)?.planId;
  const plan = PLANS.find((item) => item.id === planId);
  if (!plan) return Response.json({ error: 'UNKNOWN_PLAN' }, { status: 400 });
  if (plan.priceVnd <= 0) return Response.json({ error: 'FREE_PLAN_NOT_BILLABLE' }, { status: 400 });

  const code = (body as { code?: unknown } | null)?.code;
  let discount = 0;
  if (typeof code === 'string' && code.trim() !== '') {
    discount = discountFor(code) ?? -1;
    if (discount < 0) return Response.json({ error: 'UNKNOWN_DISCOUNT_CODE' }, { status: 400 });
  }
  const amount = plan.priceVnd - discount;
  if (amount <= 0) return Response.json({ error: 'DISCOUNT_TOO_LARGE' }, { status: 400 });

  let clientId: string;
  let apiKey: string;
  let checksumKey: string;
  try {
    clientId = env('PAYLOS_CLIENT_ID');
    apiKey = env('PAYLOS_API_KEY');
    checksumKey = env('PAYLOS_CHECKSUM_KEY');
  } catch (error) {
    console.error('[payos] create-payment not configured:', (error as Error).message);
    return Response.json({ error: 'PAYLOS_NOT_CONFIGURED' }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const orderCode = Date.now();
  const payload = {
    orderCode,
    amount,
    description: `ZC ${plan.name}`,
    cancelUrl: `${origin}/checkout/return?orderCode=${orderCode}&status=cancelled`,
    returnUrl: `${origin}/checkout/return?orderCode=${orderCode}`,
  };

  const payosResponse = await fetch(PAYOS_API, {
    method: 'POST',
    headers: {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, signature: signData(payload, checksumKey) }),
  });

  // payOS answers 4xx with a plain-text body on credential errors, so read text, not json.
  const raw = await payosResponse.text();
  let result: { code?: string; desc?: string; data?: Record<string, unknown>; signature?: string } = {};
  try {
    result = JSON.parse(raw) as typeof result;
  } catch {
    /* non-JSON gateway body, reported through `raw` below */
  }

  if (result.code !== '00' || !result.data?.checkoutUrl) {
    console.error(
      `[payos] create-payment rejected: HTTP ${payosResponse.status} code=${result.code ?? '-'} body=${raw.slice(0, 300)}`
    );
    return Response.json({ error: 'PAYLOS_REJECTED', desc: result.desc ?? raw.slice(0, 200) }, { status: 502 });
  }

  // Same checksum key verifies the response envelope, exactly as the official payOS SDKs do.
  // An unverified checkout link would let anyone mint a payment page under our merchant name.
  if (!verifySignature(result.data, result.signature, checksumKey)) {
    console.error('[payos] create-payment rejected: response signature did not verify');
    return Response.json({ error: 'PAYLOS_RESPONSE_INVALID' }, { status: 502 });
  }

  await putOrder({
    orderCode,
    planId: plan.id,
    amountVnd: amount,
    amountUsd: plan.priceUsd,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  });

  return Response.json({
    orderCode,
    planId: plan.id,
    discountVnd: discount,
    amountVnd: amount,
    amountUsd: plan.priceUsd,
    checkoutUrl: result.data.checkoutUrl,
  });
}
