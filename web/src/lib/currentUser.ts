import { devLoginEmail, isSupabaseServerConfigured } from './devAuth.ts';
import { ensureUser, type AccountUser } from './store/account.ts';
import { createClient } from './supabase/server.ts';

export interface SessionUser {
  id: string;
  email: string;
}

const authenticateFromSession = async (): Promise<SessionUser | null> => {
  if (!isSupabaseServerConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    return { id: user.id, email: user.email.trim().toLowerCase() };
  } catch {
    return null;
  }
};

export const currentUser = async (): Promise<SessionUser | null> => {
  const dev = devLoginEmail();
  if (dev) return { id: dev, email: dev };
  return authenticateFromSession();
};

export const currentAccount = async (): Promise<AccountUser | null> => {
  const user = await currentUser();
  if (!user) return null;
  return ensureUser(user.email);
};

export const requireAdmin = async (): Promise<AccountUser> => {
  const account = await currentAccount();
  if (!account) throw new Error('UNAUTHENTICATED');
  if (account.role !== 'admin') throw new Error('FORBIDDEN');
  return account;
};
