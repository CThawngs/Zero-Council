import { PLANS } from '@/prototype/data/plans';
import { currentAccount } from '@/lib/currentUser';
import { amountAfterCoupon, checkCoupon } from '@/lib/coupons';
import { addGrant, redeemCoupon } from '@/lib/store/account';
import { serverEnv } from '@/lib/serverEnv';
import { signPaymentRequest, verifySignature } from '@/lib/payos/signature';
import { putOrder, sweepStaleOrders } from '@/lib/payos/orders';

// payOS v2 create-payment. The v1 `/payment/create` path the older docs showed now answers 404.
const PAYOS_API = 'https://api-merchant.payos.vn/v2/payment-requests';

const env = (...keys: string[]): string => {
  for (const key of keys) {
    const value = serverEnv(key);
    if (value) return value;
  }
  throw new Error(`MISSING_ENV:${keys[0]}`);
};

const normaliseCouponCode = (code: string) => code.trim().toUpperCase();

/**
 * The browser only ever names a plan. The amount is read from plans.ts on the server, so a
 * tampered client cannot choose what it pays.
 */
export async function POST(request: Request) {
  // Purge failed and expired orders before doing any work.
  try {
    await sweepStaleOrders();
  } catch (error) {
    console.error('[payos] sweep failed:', (error as Error).message);
  }

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

  // A payment has to know who to grant the plan to, and a coupon has to know which account is
  // spending its one use. Both come from the account, so an anonymous checkout is refused rather
  // than allowed to create a paid order that grants nothing.
  const account = await currentAccount();
  if (!account) {
    return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
  }

  const code = (body as { code?: unknown } | null)?.code;
  let percent = 0;
  if (typeof code === 'string' && code.trim() !== '') {
    const check = await checkCoupon(code, account.email);
    if (!check.ok) {
      return Response.json({ error: 'COUPON_REJECTED', reason: check.reason }, { status: 400 });
    }
    percent = check.percent;
  }

  const amount = amountAfterCoupon(plan.priceVnd, percent);
  const orderCode = Date.now();

  // A 100% coupon settles inside the system. payOS charges a fee per transaction and has no way
  // to express "zero", so creating a payment request here would cost the merchant money to grant
  // something that is already free. The redemption is taken first: it is the step that can lose a
  // race, and losing it must not leave an order behind.
  if (amount === 0) {
    const redeemed = await redeemCoupon(code as string, account.email, percent, orderCode);
    if (!redeemed) {
      return Response.json({ error: 'COUPON_REJECTED', reason: 'ALREADY_USED' }, { status: 409 });
    }
    const now = new Date().toISOString();
    await putOrder({
      orderCode,
      planId: plan.id,
      amountVnd: 0,
      amountUsd: '0.00',
      status: 'PAID',
      createdAt: now,
      paidAt: now,
      userEmail: account.email,
      couponCode: normaliseCouponCode(code as string),
      couponPercent: percent,
    });
    const grant = await addGrant({
      userEmail: account.email,
      planId: plan.id,
      source: 'COUPON',
      orderCode,
      percent,
    });
    return Response.json({
      orderCode,
      planId: plan.id,
      couponPercent: percent,
      amountVnd: 0,
      amountUsd: '0.00',
      checkoutUrl: null,
      grantedUntil: grant.expiresAt,
    });
  }

  let clientId: string | undefined;
  let apiKey: string | undefined;
  let checksumKey: string | undefined;
  try {
    clientId = env('PAYLOS_CLIENT_ID', 'PAYOS_CLIENT_ID');
    apiKey = env('PAYLOS_API_KEY', 'PAYOS_API_KEY');
    checksumKey = env('PAYLOS_CHECKSUM_KEY', 'PAYOS_CHECKSUM_KEY');
  } catch {
    clientId = undefined;
    apiKey = undefined;
    checksumKey = undefined;
  }

  const origin = new URL(request.url).origin;
  // payOS v2 expects `expiredAt` as a Unix timestamp in SECONDS (5-minute QR lifetime).
  const expiredAtSec = Math.floor(Date.now() / 1000) + 5 * 60;
  const expiredAtMs = expiredAtSec * 1000;

  const isLocalDev = process.env.NODE_ENV !== 'production' && serverEnv('VERCEL') !== '1';

  // If credentials are not configured on local dev, fallback to a local simulated PayOS order
  // so the QR popup, 5-minute countdown, cancel confirm, and plan upgrade can be exercised offline.
  if (!clientId || !apiKey || !checksumKey) {
    if (!isLocalDev) {
      console.error('[payos] create-payment not configured: missing PAYLOS_* keys');
      return Response.json(
        {
          error: 'PAYLOS_NOT_CONFIGURED',
          desc: 'Chưa cấu hình Client ID, API Key, Checksum Key của PayOS trong environment variables.',
        },
        { status: 503 }
      );
    }

    await putOrder({
      orderCode,
      planId: plan.id,
      amountVnd: amount,
      amountUsd: plan.priceUsd,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      userEmail: account.email,
      ...(percent > 0 ? { couponCode: normaliseCouponCode(code as string), couponPercent: percent } : {}),
    });

    // Valid VietQR string formatted for offline development testing.
    const mockVietQr = `00020101021238570010A0000007270127000697042201131133666688880208999988885303704540${amount}5802VN62150811ZC ${orderCode}6304`;
    return Response.json({
      orderCode,
      planId: plan.id,
      planName: plan.name,
      couponCode: percent > 0 ? normaliseCouponCode(code as string) : null,
      couponPercent: percent,
      originalAmountVnd: plan.priceVnd,
      amountVnd: amount,
      amountUsd: plan.priceUsd,
      checkoutUrl: `${origin}/checkout/return?orderCode=${orderCode}`,
      qrCode: mockVietQr,
      expiredAt: expiredAtMs,
      isDevSimulation: true,
    });
  }

  const payload = {
    orderCode,
    amount,
    description: `ZC ${orderCode}`,
    cancelUrl: `${origin}/checkout/return?orderCode=${orderCode}&status=cancelled`,
    returnUrl: `${origin}/checkout/return?orderCode=${orderCode}`,
    expiredAt: expiredAtSec,
  };

  const payosResponse = await fetch(PAYOS_API, {
    method: 'POST',
    headers: {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, signature: signPaymentRequest(payload, checksumKey) }),
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

  // The coupon is not consumed here. A redemption is recorded when the payment is confirmed, so
  // an abandoned checkout does not burn the account's single use of the code.
  await putOrder({
    orderCode,
    planId: plan.id,
    amountVnd: amount,
    amountUsd: plan.priceUsd,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    userEmail: account.email,
    ...(percent > 0 ? { couponCode: normaliseCouponCode(code as string), couponPercent: percent } : {}),
  });

  return Response.json({
    orderCode,
    planId: plan.id,
    planName: plan.name,
    couponCode: percent > 0 ? normaliseCouponCode(code as string) : null,
    couponPercent: percent,
    originalAmountVnd: plan.priceVnd,
    amountVnd: amount,
    amountUsd: plan.priceUsd,
    checkoutUrl: result.data.checkoutUrl,
    // In-app QR popup: payOS returns the VietQR code alongside the hosted page link.
    // If qrCode is null or absent, fallback to checkoutUrl so the popup can always render a QR code.
    qrCode: (result.data.qrCode as string | undefined) || (result.data.checkoutUrl as string | undefined) || null,
    expiredAt: expiredAtMs,
    isDevSimulation: false,
  });
}
