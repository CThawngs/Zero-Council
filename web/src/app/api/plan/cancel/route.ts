import { currentAccount } from '@/lib/currentUser';
import { effectivePlan, revokeGrants } from '@/lib/store/account';
import { planChangeAction } from '@/lib/store/planChange';
import type { PlanId } from '@/prototype/data/plans';

/**
 * POST { to: 'free' | 'pro' } — the cancel / downgrade lever.
 *
 * - to free: revoke the running grant(s). The account is Free from the next read.
 * - to pro (from Ultra only): revoke Ultra, then the client opens a fresh Pro checkout
 *   and pays for Pro normally. Returning `{ checkout: 'pro' }` tells it to do so.
 *
 * The rule lives in the pure helper so both the decision and this route share one truth.
 */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { to?: unknown } | null;
  const to = typeof body?.to === 'string' ? body.to : '';

  const current = (await effectivePlan(account.email).catch(() => null))?.planId ?? 'free';
  const action = planChangeAction(current as PlanId, to);
  if (action === 'invalid') {
    return Response.json({ error: 'PLAN_CHANGE_NOT_ALLOWED', current, to }, { status: 400 });
  }

  await revokeGrants(account.email);
  return Response.json({
    plan: null,
    checkout: action === 'downgrade-pay' ? 'pro' : null,
  });
}
