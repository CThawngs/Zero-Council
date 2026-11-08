/**
 * The founder is the hard-coded supreme admin of the whole project. Unlike a normal
 * admin row in `zc_users`, this identity is not stored anywhere and cannot be granted
 * or revoked from the admin page: it is a literal email the server compares against.
 *
 * Only the founder may demote an admin back to `user`, and only the founder's account
 * may have its password reset through the admin API. Normal admins can promote other
 * accounts to admin, but the demotion and the password change are founder-only.
 */
export const FOUNDER_EMAIL = 'nguyenchithang2804@gmail.com';

export const isFounder = (email: string | null | undefined): boolean =>
  typeof email === 'string' && email.trim().toLowerCase() === FOUNDER_EMAIL;

/**
 * Whether `caller` may set `target` to `nextRole`. Promotion (to `admin`) is open to
 * every admin; demotion (from `admin` to `user`) is founder-only, and the founder's
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

/** Only the founder account may be reset through the admin API. */
export const canResetPassword = (callerEmail: string | null | undefined): boolean =>
  isFounder(callerEmail);
