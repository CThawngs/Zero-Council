import { serverEnv } from './serverEnv.ts';

/**
 * Default supreme-admin founder email when `FOUNDER_EMAILS` is not configured.
 *
 * Unlike normal `admin` rows in `zc_users`, founder identities cannot be granted or
 * revoked from the admin UI: only a founder may demote an `admin` back to `user`, and
 * only a founder may reset passwords through the admin API.
 */
export const FOUNDER_EMAIL = 'nguyenchithang2804@gmail.com';

/**
 * Resolves the active set of lowercased founder emails at runtime.
 * Reads comma-separated `FOUNDER_EMAILS` when configured, falling back to `[FOUNDER_EMAIL]`.
 */
export const getFounderEmails = (): ReadonlySet<string> => {
  const configured = serverEnv('FOUNDER_EMAILS')?.trim();
  if (!configured) {
    return new Set([FOUNDER_EMAIL]);
  }
  const parsed = configured
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? new Set(parsed) : new Set([FOUNDER_EMAIL]);
};

export const isFounder = (email: string | null | undefined): boolean =>
  typeof email === 'string' && getFounderEmails().has(email.trim().toLowerCase());

/**
 * Whether `caller` may set `target` to `nextRole`. Promotion (to `admin`) is open to
 * every admin; demotion (from `admin` to `user`) is founder-only, and a founder's
 * own row can never be demoted at all.
 */
export const canSetRole = (
  callerEmail: string | null | undefined,
  targetEmail: string | null | undefined,
  targetRole: 'user' | 'admin',
  nextRole: 'user' | 'admin'
): boolean => {
  if (!targetEmail) return false;
  if (isFounder(targetEmail) && nextRole !== 'admin') return false;
  if (nextRole === 'admin') return true;
  if (targetRole !== 'admin') return true;
  return isFounder(callerEmail);
};

/** Only a founder account may reset passwords through the admin API. */
export const canResetPassword = (callerEmail: string | null | undefined): boolean =>
  isFounder(callerEmail);
