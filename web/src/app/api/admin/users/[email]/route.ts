import { adminOnly } from '@/lib/api/adminOnly';
import { currentAccount } from '@/lib/currentUser';
import { getUser, listUsers, setUserRole, type Role } from '@/lib/store/account';

type Context = { params: Promise<{ email: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = await adminOnly();
  if (denied) return denied;

  const { email } = await context.params;
  const target = await getUser(email);
  if (!target) return Response.json({ error: 'UNKNOWN_USER' }, { status: 404 });

  let role: unknown;
  try {
    role = ((await request.json()) as { role?: unknown } | null)?.role;
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  if (role !== 'user' && role !== 'admin') {
    return Response.json({ error: 'BAD_ROLE' }, { status: 400 });
  }

  // Refuse to remove the last admin. It is the only way to strand every account in the system with
  // no one able to promote anyone again, and it cannot be undone from the admin page.
  if (role === 'user' && target.role === 'admin') {
    const admins = (await listUsers()).filter((user) => user.role === 'admin');
    if (admins.length <= 1) {
      return Response.json({ error: 'LAST_ADMIN' }, { status: 409 });
    }
  }

  const updated = await setUserRole(target.email, role as Role).catch((error: Error) => {
    console.error('[admin] set role failed:', error.message);
    return null;
  });
  if (!updated) return Response.json({ error: 'UPDATE_FAILED' }, { status: 500 });

  const caller = await currentAccount();
  return Response.json({ user: updated, wasLastAdmin: role === 'admin' && caller?.email === updated.email });
}
