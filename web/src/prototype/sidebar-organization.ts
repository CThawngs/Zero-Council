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
  /** Ordered list of pinned group conversation IDs */
  pinnedIds: string[];
  /** Department IDs currently collapsed in the sidebar */
  collapsedDepartmentIds: string[];
}

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

export const GROUP_CHAT_TEMPLATES: readonly GroupChatTemplate[] = [
  {
    id: 'product-council',
    mode: 'round-robin',
    title: { en: 'Product Council', vi: 'Hội đồng Sản phẩm' },
    description: {
      en: 'Debate roadmap priorities, user value, and launch trade-offs across your bots.',
      vi: 'Tranh luận ưu tiên roadmap, giá trị người dùng và đánh đổi khi ra mắt sản phẩm.',
    },
    suggestedDepartment: { en: 'Product', vi: 'Sản phẩm' },
  },
  {
    id: 'tech-architecture',
    mode: 'round-robin',
    title: { en: 'Architecture Review', vi: 'Đánh giá Kiến trúc' },
    description: {
      en: 'Stress-test system design, edge cases, scalability, and maintenance cost.',
      vi: 'Soi thiết kế hệ thống, trường hợp biên, khả năng mở rộng và chi phí bảo trì.',
    },
    suggestedDepartment: { en: 'Tech', vi: 'Kỹ thuật' },
  },
  {
    id: 'red-team',
    mode: 'round-robin',
    title: { en: 'Red Team Critique', vi: 'Phản biện Ý tưởng' },
    description: {
      en: 'Challenge assumptions and expose hidden failure modes before committing.',
      vi: 'Phản biện giả định và tìm điểm gãy tiềm ẩn trước khi xuống tiền hoặc triển khai.',
    },
    suggestedDepartment: { en: 'Strategy', vi: 'Chiến lược' },
  },
  {
    id: 'independent-panel',
    mode: 'panel',
    title: { en: 'Independent Panel', vi: 'Hội đồng Độc lập' },
    description: {
      en: 'Every bot answers independently first without seeing each other to avoid groupthink.',
      vi: 'Mỗi bot trả lời độc lập trước khi xem ý kiến nhau để tránh tâm lý bầy đàn.',
    },
    suggestedDepartment: { en: 'Research', vi: 'Nghiên cứu' },
  },
] as const;

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
