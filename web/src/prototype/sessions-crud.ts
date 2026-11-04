// Ponytail: pure CRUD for the sidebar session list. Ceiling: client state only,
// same store as the rest of the prototype. When deliberations move server-side,
// these two functions stay the same shape over DB rows.

import type { DeliberationSession } from './types';

/** Rename one session by id. Blank title is a no-op — the list must never hold an empty name. */
export const renameSessionInList = (
  sessions: DeliberationSession[],
  id: string,
  title: string,
): DeliberationSession[] => {
  const normalized = title.trim();
  if (!normalized) return sessions;
  return sessions.map((session) =>
    session.id === id ? { ...session, title: normalized, titlePinned: true } : session,
  );
};

/** Delete one session by id. Unknown id returns the same array so callers can skip re-render checks. */
export const deleteSessionFromList = (
  sessions: DeliberationSession[],
  id: string,
): DeliberationSession[] => {
  if (!sessions.some((session) => session.id === id)) return sessions;
  return sessions.filter((session) => session.id !== id);
};
