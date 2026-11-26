import { PLANS } from '@/prototype/data/plans';
import { currentAccount } from '@/lib/currentUser';
import { amountAfterCoupon, checkCoupon } from '@/lib/coupons';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';

const MAX_BODY_BYTES = 16 * 1024;

/**
 * Validates a discount code for a specific plan and returns the server-computed discounted price.
 * Does NOT redeem the coupon — redemption still happens only when payment is confirmed
 * (or immediately for a 100% coupon during create-payment).
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

  const account = await currentAccount();
  const limited = enforceRateLimit(request, {
    scope: 'coupons:validate',
    limit: 20,
    windowMs: 60_000,
    subject: account?.email ?? 'anonymous',
    includeIp: true,
  });
  if (limited) return limited;

  const planId = (body as { planId?: unknown } | null)?.planId;
  const plan = PLANS.find((item) => item.id === planId);
  if (!plan) return Response.json({ ok: false, error: 'UNKNOWN_PLAN' }, { status: 400 });
  if (plan.priceVnd <= 0) {
    return Response.json({ ok: false, error: 'FREE_PLAN_NOT_BILLABLE' }, { status: 400 });
  }

  if (!account) {
    return Response.json({ ok: false, error: 'NEED_LOGIN' }, { status: 401 });
  }

  const rawCode = (body as { code?: unknown } | null)?.code;
  if (typeof rawCode !== 'string' || rawCode.trim() === '') {
    return Response.json(
      { ok: false, error: 'COUPON_REJECTED', reason: 'UNKNOWN_CODE' },
      { status: 400 }
    );
  }

  const check = await checkCoupon(rawCode, account.email);
  if (!check.ok) {
    return Response.json(
      { ok: false, error: 'COUPON_REJECTED', reason: check.reason },
      { status: 400 }
    );
  }

  const discountedVnd = amountAfterCoupon(plan.priceVnd, check.percent);
  return Response.json({
    ok: true,
    planId: plan.id,
    code: check.coupon.code,
    percent: check.percent,
    originalVnd: plan.priceVnd,
    discountedVnd,
    discountVnd: plan.priceVnd - discountedVnd,
  });
}
