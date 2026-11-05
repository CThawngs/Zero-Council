import { adminOnly } from '@/lib/api/adminOnly';
import { canResetPassword } from '@/lib/founder';
import { currentAccount } from '@/lib/currentUser';
import { createAdminClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ email: string }> };

/** Founder-only password reset via Supabase Auth Admin API (bcrypt handled by Supabase). */
export async function POST(request: Request, context: Context) {
  const denied = await adminOnly();
  if (denied) return denied;
  const caller = await currentAccount();
  if (!canResetPassword(caller?.email)) {
    return Response.json({ error: 'ONLY_FOUNDER' }, { status: 403 });
  }
  const { email } = await context.params;
  const target = decodeURIComponent(email).trim().toLowerCase();
  let password: unknown;
  try {
    password = ((await request.json()) as { password?: unknown } | null)?.password;
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return Response.json({ error: 'PASSWORD_TOO_SHORT' }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    // Find auth user id by email (list + filter; no plaintext password in app store).
    const { data, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return Response.json({ error: 'LIST_FAILED' }, { status: 500 });
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (!found) return Response.json({ error: 'UNKNOWN_USER' }, { status: 404 });
    const { error } = await admin.auth.admin.updateUserById(found.id, { password });
    if (error) return Response.json({ error: 'RESET_FAILED', detail: error.message }, { status: 500 });
  } catch (error) {
    console.error('[admin] password reset failed:', (error as Error).message);
    return Response.json({ error: 'RESET_FAILED' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
