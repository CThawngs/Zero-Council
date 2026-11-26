import { currentAccount } from '@/lib/currentUser';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';
import { effectivePlan, revokeGrants } from '@/lib/store/account';
import { planChangeAction } from '@/lib/store/planChange';
import type { PlanId } from '@/prototype/data/plans';

const MAX_BODY_BYTES = 4 * 1024;

/**
 * POST { to: 'free' | 'pro' } — the cancel / downgrade lever.
 *
 * - to free: revoke the running grant(s). The account is Free from the next read.
 * - to pro (from Ultra only): revoke Ultra, then the client opens a fresh Pro checkout
 *   and pays for Pro normally. Returning `{ checkout: 'pro' }` tells it to do so.
 */
export async function POST(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const account = await currentAccount();
  if (!account) return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });

  const limited = enforceRateLimit(request, {
    scope: 'plan:cancel',
    limit: 20,
    windowMs: 60_000,
    subject: account.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson<{ to?: unknown }>(request, MAX_BODY_BYTES);
  const body = parsedBody.ok ? parsedBody.data : null;
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
