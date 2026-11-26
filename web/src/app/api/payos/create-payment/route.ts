import { PLANS } from '@/prototype/data/plans';
import { currentAccount } from '@/lib/currentUser';
import { amountAfterCoupon, checkCoupon } from '@/lib/coupons';
import { addGrant, redeemCoupon } from '@/lib/store/account';
import {
  amountUsdAfterCoupon,
  generateOrderCode,
  getPayosCredentials,
  isPayosDevSimulationAllowed,
} from '@/lib/payos/config';
import { deleteOrder, putOrder, sweepStaleOrders } from '@/lib/payos/orders';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, resolveCanonicalOrigin, verifySameOrigin } from '@/lib/security/request-guard';
import { PayOS } from '@payos/node';

const MAX_BODY_BYTES = 16 * 1024;

const normaliseCouponCode = (code: string) => code.trim().toUpperCase();

/**
 * The browser only ever names a plan. The amount is read from `plans.ts` on the server, so a
 * tampered client cannot choose what it pays.
 */
export async function POST(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

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
  const discountedUsd = amountUsdAfterCoupon(plan.priceUsd, percent);
  const orderCode = generateOrderCode();

  // A 100% coupon settles inside the system without creating a zero-dong PayOS transaction.
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

  const { clientId, apiKey, checksumKey } = getPayosCredentials();
  const origin = resolveCanonicalOrigin(request);
  const expiredAtSec = Math.floor(Date.now() / 1000) + 5 * 60;
  const expiredAtMs = expiredAtSec * 1000;

  if (!clientId || !apiKey || !checksumKey) {
    if (!isPayosDevSimulationAllowed()) {
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
      amountUsd: discountedUsd,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      userEmail: account.email,
      ...(percent > 0 ? { couponCode: normaliseCouponCode(code as string), couponPercent: percent } : {}),
    });

    const mockVietQr = `00020101021238570010A0000007270127000697042201131133666688880208999988885303704540${amount}5802VN62150811ZC ${orderCode}6304`;
    return Response.json({
      orderCode,
      planId: plan.id,
      planName: plan.name,
      couponCode: percent > 0 ? normaliseCouponCode(code as string) : null,
      couponPercent: percent,
      originalAmountVnd: plan.priceVnd,
      amountVnd: amount,
      amountUsd: discountedUsd,
      checkoutUrl: `${origin}/checkout/return?orderCode=${orderCode}`,
      qrCode: mockVietQr,
      expiredAt: expiredAtMs,
      isDevSimulation: true,
    });
  }

  // Persist PENDING order BEFORE calling PayOS so an immediate webhook callback never races
  // ahead of the local database write and drops a paid order as `404 unknown order`.
  await putOrder({
    orderCode,
    planId: plan.id,
    amountVnd: amount,
    amountUsd: discountedUsd,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    userEmail: account.email,
    ...(percent > 0 ? { couponCode: normaliseCouponCode(code as string), couponPercent: percent } : {}),
  });

  // PayOS description rule: for unlinked bank accounts, maximum length is 9 characters.
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
    await deleteOrder(orderCode).catch(() => undefined);
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
    await deleteOrder(orderCode).catch(() => undefined);
    console.error('[payos] create-payment failed: missing checkoutUrl');
    return Response.json(
      { error: 'PAYLOS_REJECTED', desc: 'PayOS không trả về link thanh toán.' },
      { status: 502 }
    );
  }

  return Response.json({
    orderCode,
    planId: plan.id,
    planName: plan.name,
    couponCode: percent > 0 ? normaliseCouponCode(code as string) : null,
    couponPercent: percent,
    originalAmountVnd: plan.priceVnd,
    amountVnd: amount,
    amountUsd: discountedUsd,
    checkoutUrl: paymentLink.checkoutUrl,
    qrCode: paymentLink.qrCode || paymentLink.checkoutUrl,
    expiredAt: expiredAtMs,
    isDevSimulation: false,
  });
}
