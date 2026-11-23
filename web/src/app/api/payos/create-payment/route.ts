import { PLANS } from '@/prototype/data/plans';
import { currentAccount } from '@/lib/currentUser';
import { amountAfterCoupon, checkCoupon } from '@/lib/coupons';
import { addGrant, redeemCoupon } from '@/lib/store/account';
import { serverEnv } from '@/lib/serverEnv';
import { putOrder, sweepStaleOrders } from '@/lib/payos/orders';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson } from '@/lib/security/request-guard';
import { PayOS } from '@payos/node';

const MAX_BODY_BYTES = 16 * 1024;

const normaliseCouponCode = (code: string) => code.trim().toUpperCase();

const getPayosKeys = () => {
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
  return { clientId, apiKey, checksumKey };
};

/**
 * The browser only ever names a plan. The amount is read from plans.ts on the server, so a
 * tampered client cannot choose what it pays.
 */
export async function POST(request: Request) {
  const parsedBody = await readBoundedJson<{ planId?: unknown; code?: unknown }>(
    request,
    MAX_BODY_BYTES
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

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

  const limited = enforceRateLimit(request, {
    scope: 'payos:create-payment',
    limit: 15,
    windowMs: 60_000,
    subject: account.email,
  });
  if (limited) return limited;

  // Purge failed and expired orders before creating a new checkout session.
  try {
    await sweepStaleOrders();
  } catch (error) {
    console.error('[payos] sweep failed:', (error as Error).message);
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
  // Generate a safe unique 12-digit integer order code within Number.MAX_SAFE_INTEGER
  const orderCode = Number(`${Math.floor(Date.now() / 1000)}${Math.floor(Math.random() * 90 + 10)}`);

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
      planName: plan.name,
      couponPercent: percent,
      amountVnd: 0,
      amountUsd: '0.00',
      checkoutUrl: null,
      grantedUntil: grant.expiresAt,
    });
  }

  const { clientId, apiKey, checksumKey } = getPayosKeys();
  const origin = new URL(request.url).origin;
  // payOS v2 expects `expiredAt` as a Unix timestamp in SECONDS (5-minute QR lifetime).
  const expiredAtSec = Math.floor(Date.now() / 1000) + 5 * 60;
  const expiredAtMs = expiredAtSec * 1000;

  const isLocalDev = process.env.NODE_ENV !== 'production' && serverEnv('VERCEL') !== '1';

  // If credentials are not configured on local dev, fallback to a local simulated PayOS order
  // so the QR popup, 5-minute countdown, cancel confirm, and plan upgrade can be exercised offline.
  if (!clientId || !apiKey || !checksumKey) {
    if (!isLocalDev) {
      console.error('[payos] create-payment not configured: missing PAYOS_* keys');
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

  // PayOS description rule: for unlinked bank accounts, maximum length is 9 characters.
  // Using 'ZC' + last 7 digits of orderCode guarantees unique, exactly 9-character ASCII string.
  const description = `ZC${String(orderCode).slice(-7)}`;

  let paymentLink: {
    orderCode: number;
    amount: number;
    description: string;
    checkoutUrl: string;
    qrCode?: string;
  };

  try {
    const payos = new PayOS({ clientId, apiKey, checksumKey });
    paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount,
      description,
      cancelUrl: `${origin}/checkout/return?orderCode=${orderCode}&status=cancelled`,
      returnUrl: `${origin}/checkout/return?orderCode=${orderCode}`,
      expiredAt: expiredAtSec,
    });
  } catch (error) {
    const errMsg = (error as Error).message || 'Không thể tạo link thanh toán PayOS';
    console.error('[payos] paymentRequests.create error:', errMsg);
    return Response.json(
      {
        error: 'PAYLOS_REJECTED',
        desc: errMsg,
      },
      { status: 502 }
    );
  }

  if (!paymentLink?.checkoutUrl) {
    console.error('[payos] create-payment failed: missing checkoutUrl');
    return Response.json({ error: 'PAYLOS_REJECTED', desc: 'PayOS không trả về link thanh toán.' }, { status: 502 });
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
    checkoutUrl: paymentLink.checkoutUrl,
    // In-app QR popup: payOS returns the VietQR code alongside the hosted page link.
    // If qrCode is null or absent, fallback to checkoutUrl so the popup can always render a QR code.
    qrCode: paymentLink.qrCode || paymentLink.checkoutUrl,
    expiredAt: expiredAtMs,
    isDevSimulation: false,
  });
}
