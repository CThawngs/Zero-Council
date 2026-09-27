import { adminOnly } from '@/lib/api/adminOnly';
import { parseCouponInput } from '@/lib/api/couponInput';
import { createCoupon, listCoupons, listRedemptions, type Coupon } from '@/lib/store/account';

export async function GET() {
  const denied = await adminOnly();
  if (denied) return denied;

  try {
    const [coupons, redemptions] = await Promise.all([listCoupons(), listRedemptions()]);
    // Usage is counted from the redemptions rather than stored on the coupon, so the number cannot
    // drift away from the rows that justify it.
    const usage = new Map<string, number>();
    for (const row of redemptions) usage.set(row.couponCode, (usage.get(row.couponCode) ?? 0) + 1);
    return Response.json({
      coupons: coupons.map((coupon) => ({ ...coupon, used: usage.get(coupon.code) ?? 0 })),
    });
  } catch (error) {
    console.error('[admin] list coupons failed:', (error as Error).message);
    return Response.json({ error: 'LIST_FAILED' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await adminOnly();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = parseCouponInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const coupon: Coupon = {
    ...parsed.value,
    createdBy: typeof (body as { createdBy?: unknown }).createdBy === 'string' ? (body as { createdBy: string }).createdBy : null,
    createdAt: new Date().toISOString(),
  };

  try {
    const created = await createCoupon(coupon);
    return Response.json({ coupon: { ...created, used: 0 } }, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('COUPON_EXISTS') || message.includes('SUPABASE_409')) {
      return Response.json({ error: 'COUPON_EXISTS' }, { status: 409 });
    }
    console.error('[admin] create coupon failed:', message);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
}
