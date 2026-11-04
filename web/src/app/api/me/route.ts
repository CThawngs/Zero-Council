import { currentAccount } from '@/lib/currentUser';
import { isFounder } from '@/lib/founder';

export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
  return Response.json({ email: account.email, role: account.role, isFounder: isFounder(account.email) });
}
