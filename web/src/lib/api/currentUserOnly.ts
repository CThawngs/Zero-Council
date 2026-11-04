import { currentUser } from '@/lib/currentUser';

/** Returns a ready-to-send refusal, or the session user. Same shape as adminOnly: the check
 *  cannot be forgotten at a call site. The email returned is the only identity provider-key
 *  routes trust — a client cannot ask for another account's keys. */
type GuardResult =
  | { user: { id: string; email: string }; denied: null }
  | { user: null; denied: Response };

export const currentUserOnly = async (): Promise<GuardResult> => {
  const user = await currentUser();
  if (!user) return { user: null, denied: Response.json({ error: 'NEED_LOGIN' }, { status: 401 }) };
  return { user, denied: null };
};
