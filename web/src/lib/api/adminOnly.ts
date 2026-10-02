import { requireAdmin } from '@/lib/currentUser';

/**
 * Returns a ready-to-send refusal, or null when the caller is an admin.
 *
 * Reads as `if (denied) return denied;` at every call site, which keeps the role check impossible
 * to forget — the failure mode that matters here is an admin route that quietly works for anyone.
 * The role is read from the database on every call, never from a cookie or a header, so removing
 * someone's admin tag takes effect on their next request rather than when their session expires.
 */
export const adminOnly = async (): Promise<Response | null> => {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    const reason = (error as Error).message;
    if (reason === 'FORBIDDEN') {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (reason === 'UNAUTHENTICATED') {
      return Response.json({ error: 'NEED_LOGIN' }, { status: 401 });
    }
    console.error('[admin] guard failed:', reason);
    return Response.json({ error: 'ADMIN_GUARD_FAILED' }, { status: 500 });
  }
};
