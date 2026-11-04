// Single source of truth for "user must create a password before dashboard".
// Any OAuth user (Google) without a password claim is forced through
// SetPasswordView. Merged email+Google accounts have has_password=true and
// pass through to the dashboard with the same user id (Supabase links the
// provider to the existing email account server-side).
export function hasPasswordClaim(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.user_metadata?.has_password === true;
}

export function needsPasswordSet(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  if (!user) return false;
  return !hasPasswordClaim(user);
}
