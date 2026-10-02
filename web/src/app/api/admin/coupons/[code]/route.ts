import { adminOnly } from '@/lib/api/adminOnly';
import { parseCouponInput } from '@/lib/api/couponInput';
import { deleteCoupon, getCoupon, updateCoupon } from '@/lib/store/account';

type Context = { params: Promise<{ code: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = await adminOnly();
  if (denied) return denied;

  const { code } = await context.params;
  const existing = await getCoupon(code).catch(() => null);
  if (!existing) return Response.json({ error: 'UNKNOWN_CODE' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  // The code is the primary key and the identity a user types; renaming one would orphan its
  // redemption rows. Rejecting it is clearer than silently ignoring the field.
  if (body.code !== undefined && String(body.code).trim().toUpperCase() !== existing.code) {
    return Response.json({ error: 'CODE_IMMUTABLE' }, { status: 400 });
  }

  // Reuse the create-form validation by merging the patch over the stored coupon, so a partial
  // update cannot write a percent of 0 or a cap of -5 that the full form would have refused.
  const parsed = parseCouponInput({
    code: existing.code,
    percent: body.percent ?? existing.percent,
    expiresAt: body.expiresAt === undefined ? existing.expiresAt : body.expiresAt,
    maxTotalRedemptions:
      body.maxTotalRedemptions === undefined ? existing.maxTotalRedemptions : body.maxTotalRedemptions,
    active: body.active === undefined ? existing.active : body.active,
    note: body.note === undefined ? existing.note : body.note,
  });
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const { code: _key, ...changes } = parsed.value;
  void _key;
  const updated = await updateCoupon(existing.code, changes).catch((error: Error) => {
    console.error('[admin] update coupon failed:', error.message);
    return null;
  });
  if (!updated) return Response.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  return Response.json({ coupon: updated });
}

export async function DELETE(_request: Request, context: Context) {
  const denied = await adminOnly();
  if (denied) return denied;

  const { code } = await context.params;
  const removed = await deleteCoupon(code).catch((error: Error) => {
    console.error('[admin] delete coupon failed:', error.message);
    return false;
  });
  if (!removed) return Response.json({ error: 'UNKNOWN_CODE' }, { status: 404 });
  return Response.json({ ok: true });
}
