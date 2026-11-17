import { currentUser } from '@/lib/currentUser';
import { ensureUser } from '@/lib/store/account';

/** Returns a ready-to-send refusal, or the session user. Ensures the user row exists in zc_users
 *  before routes write to child tables with foreign keys on zc_users(email). */
type GuardResult =
  | { user: { id: string; email: string }; denied: null }
  | { user: null; denied: Response };

export const currentUserOnly = async (): Promise<GuardResult> => {
  const user = await currentUser();
  if (!user) return { user: null, denied: Response.json({ error: 'NEED_LOGIN' }, { status: 401 }) };
  await ensureUser(user.email).catch(() => undefined);
  return { user, denied: null };
};
