import { currentAccount } from '@/lib/currentUser';
import { isFounder } from '@/lib/founder';
import { effectivePlan } from '@/lib/store/account';

export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
  const plan = await effectivePlan(account.email).catch(() => null);
  return Response.json({ email: account.email, role: account.role, isFounder: isFounder(account.email), plan });
}
