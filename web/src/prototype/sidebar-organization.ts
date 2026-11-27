import { copy } from './i18n.ts';
import type { ChatMode } from './chat/engine';

export interface SidebarDepartment {
  id: string;
  name: string;
  createdAt: string;
}

export interface SidebarOrgState {
  version: 1;
  departments: SidebarDepartment[];
  /** Maps group conversationId -> departmentId */
  assignments: Record<string, string>;
  /** Ordered list of pinned conversation IDs (group or solo session) */
  pinnedIds: string[];
  /** Department IDs currently collapsed in the sidebar */
  collapsedDepartmentIds: string[];
}

export interface SoloSessionCandidate {
  id: string;
  kind: 'solo' | 'group';
  botId?: string;
  title: string;
  roster: readonly string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SidebarSessionCopy {
  sectionTitle: string;
  emptyText: string;
  openAction: string;
  renameAction: string;
  pinAction: string;
  unpinAction: string;
  deleteAction: string;
  confirmDeleteAction: string;
  cancelDeleteAction: string;
  lastSessionHint: string;
  showAll: string;
  showLess: string;
}

export const RECENT_SOLO_SESSIONS_LIMIT = 5;

export const SIDEBAR_SESSION_COPY: Record<'en' | 'vi', SidebarSessionCopy> = {
  en: {
    sectionTitle: 'Recent sessions',
    emptyText: 'No 1-on-1 sessions yet. Pick a bot above to start chatting.',
    openAction: 'Open',
    renameAction: copy.en.sidebarActionRename,
    pinAction: copy.en.sidebarActionPin,
    unpinAction: copy.en.sidebarActionUnpin,
    deleteAction: copy.en.sidebarActionDelete,
    confirmDeleteAction: copy.en.sidebarConfirmDelete,
    cancelDeleteAction: copy.en.adminCancel,
    lastSessionHint: 'Keep at least 1 session for this bot',
    showAll: 'Show all ({count})',
    showLess: 'Show less',
  },
  vi: {
    sectionTitle: 'Phiên chat gần đây',
    emptyText: 'Chưa có phiên chat 1-1 nào. Chọn một bot ở trên để bắt đầu.',
    openAction: 'Mở',
    renameAction: copy.vi.sidebarActionRename,
    pinAction: copy.vi.sidebarActionPin,
    unpinAction: copy.vi.sidebarActionUnpin,
    deleteAction: copy.vi.sidebarActionDelete,
    confirmDeleteAction: copy.vi.sidebarConfirmDelete,
    cancelDeleteAction: copy.vi.adminCancel,
    lastSessionHint: 'Cần giữ lại ít nhất 1 phiên cho bot này',
    showAll: 'Xem tất cả ({count})',
    showLess: 'Thu gọn',
  },
};

export interface GroupChatTemplate {
  id: string;
  mode: ChatMode;
  title: { en: string; vi: string };
  description: { en: string; vi: string };
  suggestedDepartment: { en: string; vi: string };
}

export interface ImportedGroupSpec {
  title: string;
  mode: ChatMode;
  departmentName?: string;
}

export type ParseImportResult =
  | {
      ok: true;
      groups: ImportedGroupSpec[];
      departments: string[];
    }
  | {
      ok: false;
      error: 'EMPTY' | 'INVALID_JSON' | 'INVALID_SCHEMA';
    };

export const MAX_DEPARTMENT_NAME_LENGTH = 60;
export const MAX_IMPORT_GROUPS = 20;

export const EMPTY_SIDEBAR_ORG: SidebarOrgState = {
  version: 1,
  departments: [],
  assignments: {},
  pinnedIds: [],
  collapsedDepartmentIds: [],
};

export const sidebarOrgStorageKey = (userId?: string | null): string =>
  `zc:sidebar-org:v1:${userId && userId.trim() ? userId.trim() : 'anon'}`;

const cleanName = (value: unknown, maxLen = MAX_DEPARTMENT_NAME_LENGTH): string => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
};

export const sanitizeSidebarOrg = (raw: unknown): SidebarOrgState => {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SIDEBAR_ORG };
  const record = raw as Record<string, unknown>;

  const seenDeptIds = new Set<string>();
  const departments: SidebarDepartment[] = [];
  if (Array.isArray(record.departments)) {
    for (const item of record.departments) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      const name = cleanName(obj.name);
      if (!id || !name || seenDeptIds.has(id)) continue;
      seenDeptIds.add(id);
      departments.push({
        id,
        name,
        createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : new Date(0).toISOString(),
      });
    }
  }

  const assignments: Record<string, string> = {};
  if (record.assignments && typeof record.assignments === 'object' && !Array.isArray(record.assignments)) {
    for (const [convId, deptId] of Object.entries(record.assignments as Record<string, unknown>)) {
      if (typeof convId === 'string' && convId.trim() && typeof deptId === 'string' && seenDeptIds.has(deptId)) {
        assignments[convId] = deptId;
      }
    }
  }

  const pinnedIds: string[] = [];
  const seenPinned = new Set<string>();
  if (Array.isArray(record.pinnedIds)) {
    for (const item of record.pinnedIds) {
      if (typeof item === 'string' && item.trim() && !seenPinned.has(item)) {
        seenPinned.add(item);
        pinnedIds.push(item);
      }
    }
  }

  const collapsedDepartmentIds: string[] = [];
  const seenCollapsed = new Set<string>();
  if (Array.isArray(record.collapsedDepartmentIds)) {
    for (const item of record.collapsedDepartmentIds) {
      if (typeof item === 'string' && seenDeptIds.has(item) && !seenCollapsed.has(item)) {
        seenCollapsed.add(item);
        collapsedDepartmentIds.push(item);
      }
    }
  }

  return {
    version: 1,
    departments,
    assignments,
    pinnedIds,
    collapsedDepartmentIds,
  };
};

export interface SimpleStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const readSidebarOrg = (
  storage: SimpleStorage | null | undefined,
  userId?: string | null
): SidebarOrgState => {
  if (!storage) return { ...EMPTY_SIDEBAR_ORG };
  try {
    const raw = storage.getItem(sidebarOrgStorageKey(userId));
    if (!raw) return { ...EMPTY_SIDEBAR_ORG };
    return sanitizeSidebarOrg(JSON.parse(raw));
  } catch {
    return { ...EMPTY_SIDEBAR_ORG };
  }
};

export const writeSidebarOrg = (
  storage: SimpleStorage | null | undefined,
  userId: string | null | undefined,
  state: SidebarOrgState
): void => {
  if (!storage) return;
  try {
    storage.setItem(sidebarOrgStorageKey(userId), JSON.stringify(sanitizeSidebarOrg(state)));
  } catch {
    // Ignore quota or private-mode errors safely.
  }
};

const orgListeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; parsed: SidebarOrgState }>();

const notifySidebarOrgListeners = () => {
  for (const listener of orgListeners) listener();
};

export const subscribeSidebarOrg = (listener: () => void): (() => void) => {
  orgListeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      orgListeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith('zc:sidebar-org:v1:')) {
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    orgListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const getSidebarOrgSnapshot = (userId?: string | null): SidebarOrgState => {
  if (typeof window === 'undefined') return EMPTY_SIDEBAR_ORG;
  const key = sidebarOrgStorageKey(userId);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY_SIDEBAR_ORG;
  }
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.parsed;
  let parsed: SidebarOrgState = EMPTY_SIDEBAR_ORG;
  if (raw) {
    try {
      parsed = sanitizeSidebarOrg(JSON.parse(raw));
    } catch {
      parsed = EMPTY_SIDEBAR_ORG;
    }
  }
  snapshotCache.set(key, { raw, parsed });
  return parsed;
};

export const mutateSidebarOrg = (
  userId: string | null | undefined,
  updater: (current: SidebarOrgState) => SidebarOrgState
): SidebarOrgState => {
  const current = getSidebarOrgSnapshot(userId);
  const next = sanitizeSidebarOrg(updater(current));
  if (typeof window !== 'undefined') {
    writeSidebarOrg(window.localStorage, userId, next);
    const key = sidebarOrgStorageKey(userId);
    try {
      snapshotCache.set(key, { raw: window.localStorage.getItem(key), parsed: next });
    } catch {
      snapshotCache.set(key, { raw: null, parsed: next });
    }
  }
  notifySidebarOrgListeners();
  return next;
};

export const addDepartment = (
  state: SidebarOrgState,
  rawName: string,
  now = new Date()
): { state: SidebarOrgState; department: SidebarDepartment | null } => {
  const name = cleanName(rawName);
  if (!name) return { state, department: null };

  const existing = state.departments.find(
    (dept) => dept.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return { state, department: existing };
  }

  const id = `dept-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const department: SidebarDepartment = {
    id,
    name,
    createdAt: now.toISOString(),
  };

  return {
    state: {
      ...state,
      departments: [...state.departments, department],
    },
    department,
  };
};

export const renameDepartment = (
  state: SidebarOrgState,
  departmentId: string,
  rawName: string
): SidebarOrgState => {
  const name = cleanName(rawName);
  if (!name) return state;
  return {
    ...state,
    departments: state.departments.map((dept) =>
      dept.id === departmentId ? { ...dept, name } : dept
    ),
  };
};

export const deleteDepartment = (
  state: SidebarOrgState,
  departmentId: string
): SidebarOrgState => {
  const nextAssignments: Record<string, string> = {};
  for (const [convId, assignedDeptId] of Object.entries(state.assignments)) {
    if (assignedDeptId !== departmentId) {
      nextAssignments[convId] = assignedDeptId;
    }
  }
  return {
    ...state,
    departments: state.departments.filter((dept) => dept.id !== departmentId),
    assignments: nextAssignments,
    collapsedDepartmentIds: state.collapsedDepartmentIds.filter((id) => id !== departmentId),
  };
};

export const assignConversationDepartment = (
  state: SidebarOrgState,
  conversationId: string,
  departmentId: string | null
): SidebarOrgState => {
  const nextAssignments = { ...state.assignments };
  if (!departmentId) {
    delete nextAssignments[conversationId];
  } else if (state.departments.some((dept) => dept.id === departmentId)) {
    nextAssignments[conversationId] = departmentId;
  }
  return {
    ...state,
    assignments: nextAssignments,
  };
};

export const togglePinConversation = (
  state: SidebarOrgState,
  conversationId: string
): SidebarOrgState => {
  const exists = state.pinnedIds.includes(conversationId);
  return {
    ...state,
    pinnedIds: exists
      ? state.pinnedIds.filter((id) => id !== conversationId)
      : [conversationId, ...state.pinnedIds],
  };
};

export const toggleCollapseDepartment = (
  state: SidebarOrgState,
  departmentId: string
): SidebarOrgState => {
  const collapsed = state.collapsedDepartmentIds.includes(departmentId);
  return {
    ...state,
    collapsedDepartmentIds: collapsed
      ? state.collapsedDepartmentIds.filter((id) => id !== departmentId)
      : [...state.collapsedDepartmentIds, departmentId],
  };
};

export const pruneRemovedConversations = (
  state: SidebarOrgState,
  existingIds: ReadonlySet<string>
): SidebarOrgState => {
  let changed = false;
  const nextAssignments: Record<string, string> = {};
  for (const [convId, deptId] of Object.entries(state.assignments)) {
    if (existingIds.has(convId)) {
      nextAssignments[convId] = deptId;
    } else {
      changed = true;
    }
  }
  const nextPinned = state.pinnedIds.filter((id) => existingIds.has(id));
  if (nextPinned.length !== state.pinnedIds.length) changed = true;

  if (!changed) return state;
  return {
    ...state,
    assignments: nextAssignments,
    pinnedIds: nextPinned,
  };
};

export type PendingPruneStatus = 'inflight' | 'settled';

/**
 * Reconciles pending conversation prune candidates against the latest rendered `conversations` IDs:
 * - Confirmed absent (`!liveIds.has(id)`): removes from `pending` and returns `true` so callers prune org storage.
 * - Still present after `deleteConversationById` settled (`status === 'settled'`): API delete failed; clears pending without pruning.
 * - Still present while `status === 'inflight'`: keeps pending until the async delete settles and React commits.
 */
export const reconcilePendingConversationPrunes = (
  pending: Map<string, PendingPruneStatus>,
  liveIds: ReadonlySet<string>
): boolean => {
  if (pending.size === 0) return false;
  let shouldPrune = false;
  for (const [candidateId, status] of pending.entries()) {
    if (!liveIds.has(candidateId)) {
      pending.delete(candidateId);
      shouldPrune = true;
    } else if (status === 'settled') {
      pending.delete(candidateId);
    }
  }
  return shouldPrune;
};

/**
 * Resolves the owning UserBot ID for a solo conversation, falling back to `bot:<id>` in `roster`.
 */
export const resolveSoloSessionBotId = (
  conv: Pick<SoloSessionCandidate, 'kind' | 'botId' | 'roster'>
): string | undefined => {
  if (conv.kind !== 'solo') return undefined;
  if (typeof conv.botId === 'string' && conv.botId.trim()) {
    return conv.botId.trim();
  }
  for (const member of conv.roster) {
    if (typeof member === 'string' && member.startsWith('bot:')) {
      const id = member.slice(4).trim();
      if (id) return id;
    }
  }
  return undefined;
};

const parseConversationTimestampMs = (
  conv: Pick<SoloSessionCandidate, 'updatedAt' | 'createdAt'>
): number => {
  if (conv.updatedAt) {
    const updatedMs = Date.parse(conv.updatedAt);
    if (!Number.isNaN(updatedMs)) return updatedMs;
  }
  if (conv.createdAt) {
    const createdMs = Date.parse(conv.createdAt);
    if (!Number.isNaN(createdMs)) return createdMs;
  }
  return 0;
};

/**
 * Selects solo conversations ordered with pinned items first (in `pinnedIds` order),
 * followed by most-recently-updated (`updatedAt` desc).
 */
export const selectOrderedSoloSessions = <T extends SoloSessionCandidate>(
  conversations: readonly T[],
  pinnedIds: readonly string[],
  validBotIds?: ReadonlySet<string>
): T[] => {
  const seenIds = new Set<string>();
  const indexed: Array<{ item: T; index: number; updatedMs: number }> = [];

  conversations.forEach((conv, index) => {
    if (conv.kind !== 'solo' || !conv.id || seenIds.has(conv.id)) return;
    const botId = resolveSoloSessionBotId(conv);
    if (!botId) return;
    if (validBotIds && !validBotIds.has(botId)) return;
    seenIds.add(conv.id);
    indexed.push({
      item: conv,
      index,
      updatedMs: parseConversationTimestampMs(conv),
    });
  });

  const pinnedOrder = new Map(pinnedIds.map((id, idx) => [id, idx]));

  indexed.sort((a, b) => {
    const pa = pinnedOrder.get(a.item.id);
    const pb = pinnedOrder.get(b.item.id);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    if (b.updatedMs !== a.updatedMs) return b.updatedMs - a.updatedMs;
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.item);
};

/**
 * Slices ordered solo sessions for bounded sidebar density while exposing expand metadata.
 */
export const partitionBoundedSessions = <T>(
  orderedSessions: readonly T[],
  expanded: boolean,
  limit = RECENT_SOLO_SESSIONS_LIMIT
): { visible: T[]; hiddenCount: number; canExpand: boolean } => {
  const safeLimit = Math.max(1, limit);
  const canExpand = orderedSessions.length > safeLimit;
  const visible =
    expanded || !canExpand ? [...orderedSessions] : orderedSessions.slice(0, safeLimit);
  return {
    visible,
    hiddenCount: Math.max(0, orderedSessions.length - visible.length),
    canExpand,
  };
};

/**
 * Returns `true` iff `sessionId` is a solo conversation whose bot owns at least 2 solo threads,
 * preserving the invariant that a bot's last solo session cannot be deleted via session actions.
 */
export const canDeleteSoloSession = (
  conversations: readonly SoloSessionCandidate[],
  sessionId: string
): boolean => {
  const target = conversations.find((conv) => conv.id === sessionId);
  if (!target || target.kind !== 'solo') return false;
  const botId = resolveSoloSessionBotId(target);
  if (!botId) return false;

  let count = 0;
  for (const conv of conversations) {
    if (conv.kind === 'solo' && resolveSoloSessionBotId(conv) === botId) {
      count += 1;
      if (count > 1) return true;
    }
  }
  return false;
};

export const formatRelativeTime = (
  iso: string | undefined,
  language: 'en' | 'vi',
  nowMs = Date.now()
): string => {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  const dict = copy[language];
  if (diffSec < 60) return dict.relJustNow;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return dict.relMinutesAgo.replace('{n}', String(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return dict.relHoursAgo.replace('{n}', String(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return dict.relDaysAgo.replace('{n}', String(diffDay));
  const diffMonth = Math.floor(diffDay / 30);
  return dict.relMonthsAgo.replace('{n}', String(diffMonth));
};

export const exportGroupChatJson = (input: {
  title: string;
  mode: ChatMode;
  departmentName?: string;
  rosterCount: number;
}): string =>
  JSON.stringify(
    {
      version: 1,
      type: 'zero-council-group',
      title: input.title,
      mode: input.mode,
      ...(input.departmentName ? { departmentName: input.departmentName } : {}),
      rosterCount: input.rosterCount,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );

const parseSingleGroup = (raw: unknown): ImportedGroupSpec | null => {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title = cleanName(obj.title, 100);
  if (!title) return null;
  const mode: ChatMode = obj.mode === 'panel' ? 'panel' : 'round-robin';
  const departmentName = cleanName(obj.departmentName ?? obj.department);
  return {
    title,
    mode,
    ...(departmentName ? { departmentName } : {}),
  };
};

export const parseImportedGroupPayload = (rawText: string): ParseImportResult => {
  const trimmed = rawText.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }

  const groups: ImportedGroupSpec[] = [];
  const deptSet = new Set<string>();

  if (Array.isArray(parsed)) {
    for (const item of parsed.slice(0, MAX_IMPORT_GROUPS)) {
      const group = parseSingleGroup(item);
      if (group) {
        groups.push(group);
        if (group.departmentName) deptSet.add(group.departmentName);
      }
    }
  } else if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.departments)) {
      for (const d of record.departments) {
        const name = typeof d === 'string' ? cleanName(d) : cleanName((d as Record<string, unknown>)?.name);
        if (name) deptSet.add(name);
      }
    }
    if (Array.isArray(record.groups)) {
      for (const item of record.groups.slice(0, MAX_IMPORT_GROUPS)) {
        const group = parseSingleGroup(item);
        if (group) {
          groups.push(group);
          if (group.departmentName) deptSet.add(group.departmentName);
        }
      }
    } else {
      const single = parseSingleGroup(record);
      if (single) {
        groups.push(single);
        if (single.departmentName) deptSet.add(single.departmentName);
      }
    }
  }

  if (groups.length === 0 && deptSet.size === 0) {
    return { ok: false, error: 'INVALID_SCHEMA' };
  }

  return {
    ok: true,
    groups,
    departments: [...deptSet],
  };
};
