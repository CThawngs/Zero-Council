import { serverEnv } from './serverEnv.ts';
import { ensureUser, type AccountUser } from './store/account.ts';
import { createClient } from './supabase/server.ts';

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * The seam between the platform login and everything in this repo.
 *
 * -------------------------------------------------------------------------------------------
 * DELEGATED: login is a colleague's work. They implement `authenticateFromSession` below and
 * nothing else in this repository needs to change. This repo owns the ROLE, not the identity —
 * see web/supabase/migrations/0002_zc_coupons.sql.
 *
 * The whole contract is this one function: { id, email } or null. No roles, no permissions, no
 * password handling. That is deliberate — the fewer assumptions this file makes about a system
 * that does not exist yet, the less of it has to be rewritten when it does.
 * -------------------------------------------------------------------------------------------
 */

/**
 * Left for the colleague. Returning null means "no session", which is the correct answer for
 * every anonymous visitor and keeps the admin surface closed until real auth lands.
 */

// Colleague: should be done nơw
const authenticateFromSession = async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return { id: user.id, email: user.email.trim().toLowerCase() };
};

const devEmail = (): string | null => {
  const email = serverEnv('ZC_DEV_LOGIN_EMAIL');
  if (!email) return null;
  // Refused on the host, not just discouraged. On Vercel this variable would make every visitor
  // to the live site be that person — if the address happens to be an admin, the whole coupon
  // admin page is public. It is gated on VERCEL rather than NODE_ENV because `next start` is a
  // production build too, and that is how the app gets driven locally; refusing it there would
  // make local verification impossible while protecting nothing.
  if (serverEnv('VERCEL') === '1') {
    throw new Error(
      'ZC_DEV_LOGIN_EMAIL is set on a deployed host. Every visitor would be logged in as that ' +
        'account. Remove it from the host environment.'
    );
  }
  return email.trim().toLowerCase();
};

export const currentUser = async (): Promise<SessionUser | null> => {
  const dev = devEmail();
  if (dev) return { id: dev, email: dev };
  return authenticateFromSession();
};

/**
 * The account row, created on first sight with role `user`. Never returns null: an authenticated
 * email that is not in `zc_users` yet becomes a user record rather than an error, so the first
 * admin seed in the migration stays the only way to make anyone an admin.
 */
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
