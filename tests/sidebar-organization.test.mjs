import assert from 'node:assert/strict';
import test from 'node:test';

const {
  EMPTY_SIDEBAR_ORG,
  RECENT_SOLO_SESSIONS_LIMIT,
  SIDEBAR_SESSION_COPY,
  addDepartment,
  assignConversationDepartment,
  canDeleteSoloSession,
  deleteDepartment,
  exportGroupChatJson,
  formatRelativeTime,
  parseImportedGroupPayload,
  partitionBoundedSessions,
  pruneRemovedConversations,
  readSidebarOrg,
  renameDepartment,
  resolveSoloSessionBotId,
  sanitizeSidebarOrg,
  selectOrderedSoloSessions,
  toggleCollapseDepartment,
  togglePinConversation,
  writeSidebarOrg,
} = await import('../web/src/prototype/sidebar-organization.ts');

test('department lifecycle: add, deduplicate case-insensitively, rename, delete without losing other assignments', () => {
  const { state: s1, department: tech } = addDepartment(EMPTY_SIDEBAR_ORG, '  Tech  ', new Date('2026-11-23T00:00:00Z'));
  assert.ok(tech);
  assert.equal(tech.name, 'Tech');
  assert.equal(s1.departments.length, 1);

  const dup = addDepartment(s1, 'tech');
  assert.equal(dup.state.departments.length, 1);
  assert.equal(dup.department?.id, tech.id);

  const blank = addDepartment(s1, '   ');
  assert.equal(blank.department, null);
  assert.equal(blank.state.departments.length, 1);

  const { state: s2, department: product } = addDepartment(s1, 'Product', new Date('2026-11-23T00:01:00Z'));
  assert.ok(product);

  let s3 = assignConversationDepartment(s2, 'g1', tech.id);
  s3 = assignConversationDepartment(s3, 'g2', product.id);
  s3 = toggleCollapseDepartment(s3, tech.id);
  assert.equal(s3.assignments.g1, tech.id);
  assert.equal(s3.collapsedDepartmentIds.includes(tech.id), true);

  const s4 = renameDepartment(s3, tech.id, 'Engineering');
  assert.equal(s4.departments.find((d) => d.id === tech.id)?.name, 'Engineering');

  const s5 = deleteDepartment(s4, tech.id);
  assert.equal(s5.departments.length, 1);
  assert.equal(s5.assignments.g1, undefined);
  assert.equal(s5.assignments.g2, product.id);
  assert.equal(s5.collapsedDepartmentIds.length, 0);
});

test('pin toggle and pruneRemovedConversations keep org state clean across groups and solo sessions', () => {
  const { state: s1, department: tech } = addDepartment(EMPTY_SIDEBAR_ORG, 'Tech');
  let state = assignConversationDepartment(s1, 'g1', tech.id);
  state = assignConversationDepartment(state, 'g2', tech.id);
  state = togglePinConversation(state, 'g1');
  state = togglePinConversation(state, 'solo-1');
  state = togglePinConversation(state, 'g2');
  assert.deepEqual(state.pinnedIds, ['g2', 'solo-1', 'g1']);

  state = togglePinConversation(state, 'g1');
  assert.deepEqual(state.pinnedIds, ['g2', 'solo-1']);

  // Deleting g2 while solo-1 and g1 stay live preserves solo-1 pin.
  const pruned = pruneRemovedConversations(state, new Set(['g1', 'solo-1']));
  assert.deepEqual(pruned.pinnedIds, ['solo-1']);
  assert.equal(pruned.assignments.g2, undefined);
  assert.equal(pruned.assignments.g1, tech.id);
});

test('storage round-trip and corrupt storage resilience', () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };

  const { state: s1, department: tech } = addDepartment(EMPTY_SIDEBAR_ORG, 'Tech');
  const s2 = assignConversationDepartment(togglePinConversation(s1, 'g1'), 'g1', tech.id);
  writeSidebarOrg(storage, 'user-42', s2);

  const loaded = readSidebarOrg(storage, 'user-42');
  assert.equal(loaded.departments.length, 1);
  assert.equal(loaded.assignments.g1, tech.id);
  assert.deepEqual(loaded.pinnedIds, ['g1']);

  // Different user gets isolated state
  assert.deepEqual(readSidebarOrg(storage, 'user-99').departments, []);

  // Corrupt JSON does not crash
  map.set('zc:sidebar-org:v1:broken', '{not valid json');
  assert.deepEqual(readSidebarOrg(storage, 'broken'), EMPTY_SIDEBAR_ORG);

  // Orphan assignments referencing deleted departments are stripped
  const sanitized = sanitizeSidebarOrg({
    departments: [{ id: 'd1', name: 'Tech' }],
    assignments: { g1: 'd1', g2: 'missing-dept' },
    pinnedIds: ['g1', 'g1', ''],
    collapsedDepartmentIds: ['d1', 'missing-dept'],
  });
  assert.deepEqual(sanitized.assignments, { g1: 'd1' });
  assert.deepEqual(sanitized.pinnedIds, ['g1']);
  assert.deepEqual(sanitized.collapsedDepartmentIds, ['d1']);
});

test('formatRelativeTime formats EN and VI cleanly', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  assert.equal(formatRelativeTime('2026-11-23T11:59:30Z', 'en', now), 'just now');
  assert.equal(formatRelativeTime('2026-11-23T11:59:30Z', 'vi', now), 'vừa xong');
  assert.equal(formatRelativeTime('2026-11-23T11:45:00Z', 'en', now), '15m ago');
  assert.equal(formatRelativeTime('2026-11-23T05:00:00Z', 'en', now), '7h ago');
  assert.equal(formatRelativeTime('2026-11-23T05:00:00Z', 'vi', now), '7g');
  assert.equal(formatRelativeTime('2026-11-21T12:00:00Z', 'en', now), '2d ago');
  assert.equal(formatRelativeTime('2026-11-21T12:00:00Z', 'vi', now), '2n');
  assert.equal(formatRelativeTime('invalid', 'en', now), '');
});

test('solo session selection, bounded slicing, and last-session delete protection', () => {
  const items = [
    {
      id: 'group-1',
      kind: 'group',
      title: 'Council Group',
      roster: ['bot:bot-a', 'bot:bot-b'],
      createdAt: '2026-11-20T00:00:00Z',
      updatedAt: '2026-11-27T12:00:00Z',
    },
    {
      id: 'solo-old',
      kind: 'solo',
      botId: 'bot-a',
      title: 'Old Alpha Spec',
      roster: ['bot:bot-a'],
      createdAt: '2026-11-20T00:00:00Z',
      updatedAt: '2026-11-21T10:00:00Z',
    },
    {
      id: 'solo-newest',
      kind: 'solo',
      botId: 'bot-a',
      title: 'Newest Alpha Spec',
      roster: ['bot:bot-a'],
      createdAt: '2026-11-26T00:00:00Z',
      updatedAt: '2026-11-27T11:00:00Z',
    },
    {
      id: 'solo-roster-fallback',
      kind: 'solo',
      title: 'Beta Only Thread',
      roster: ['bot:bot-b'],
      createdAt: '2026-11-25T00:00:00Z',
      updatedAt: '2026-11-26T09:00:00Z',
    },
    {
      id: 'solo-orphan',
      kind: 'solo',
      botId: 'bot-deleted',
      title: 'Deleted Bot Thread',
      roster: ['bot:bot-deleted'],
      createdAt: '2026-11-27T00:00:00Z',
      updatedAt: '2026-11-27T11:59:00Z',
    },
  ];

  assert.equal(resolveSoloSessionBotId(items[0]), undefined);
  assert.equal(resolveSoloSessionBotId(items[1]), 'bot-a');
  assert.equal(resolveSoloSessionBotId(items[3]), 'bot-b');

  // Filters out group conversations and orphaned bots, orders pinned first then updatedAt desc.
  const ordered = selectOrderedSoloSessions(
    items,
    ['solo-old'],
    new Set(['bot-a', 'bot-b'])
  );
  assert.deepEqual(
    ordered.map((s) => s.id),
    ['solo-old', 'solo-newest', 'solo-roster-fallback']
  );

  // Titles stay exact (never sequential #N fabrication).
  assert.deepEqual(
    ordered.map((s) => s.title),
    ['Old Alpha Spec', 'Newest Alpha Spec', 'Beta Only Thread']
  );

  // Last-session protection: bot-a has 2 threads -> deletable; bot-b has 1 thread -> protected.
  assert.equal(canDeleteSoloSession(items, 'solo-old'), true);
  assert.equal(canDeleteSoloSession(items, 'solo-newest'), true);
  assert.equal(canDeleteSoloSession(items, 'solo-roster-fallback'), false);
  assert.equal(canDeleteSoloSession(items, 'group-1'), false);
  assert.equal(canDeleteSoloSession(items, 'non-existent'), false);

  // Bounded density defaults to RECENT_SOLO_SESSIONS_LIMIT (5) and expands cleanly.
  assert.equal(RECENT_SOLO_SESSIONS_LIMIT, 5);
  const seven = Array.from({ length: 7 }, (_, i) => ({ id: `s-${i}` }));
  const collapsed = partitionBoundedSessions(seven, false);
  assert.equal(collapsed.canExpand, true);
  assert.equal(collapsed.visible.length, 5);
  assert.equal(collapsed.hiddenCount, 2);

  const expanded = partitionBoundedSessions(seven, true);
  assert.equal(expanded.canExpand, true);
  assert.equal(expanded.visible.length, 7);
  assert.equal(expanded.hiddenCount, 0);

  // Bilingual session copy parity.
  for (const key of Object.keys(SIDEBAR_SESSION_COPY.en)) {
    assert.equal(typeof SIDEBAR_SESSION_COPY.en[key], 'string');
    assert.equal(typeof SIDEBAR_SESSION_COPY.vi[key], 'string');
    assert.ok(SIDEBAR_SESSION_COPY.en[key].trim().length > 0);
    assert.ok(SIDEBAR_SESSION_COPY.vi[key].trim().length > 0);
  }
});

test('export and import round-trip + malformed payload rejection', () => {
  const exported = exportGroupChatJson({
    title: 'Zero Council',
    mode: 'panel',
    departmentName: 'Tech',
    rosterCount: 3,
  });
  const parsed = parseImportedGroupPayload(exported);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.groups.length, 1);
    assert.equal(parsed.groups[0].title, 'Zero Council');
    assert.equal(parsed.groups[0].mode, 'panel');
    assert.equal(parsed.groups[0].departmentName, 'Tech');
    assert.deepEqual(parsed.departments, ['Tech']);
  }

  const batch = parseImportedGroupPayload(
    JSON.stringify({
      departments: ['Design'],
      groups: [
        { title: 'Fix 9Router', mode: 'round-robin', departmentName: 'Tech' },
        { title: 'UI Polish', mode: 'panel', department: 'Design' },
      ],
    })
  );
  assert.equal(batch.ok, true);
  if (batch.ok) {
    assert.equal(batch.groups.length, 2);
    assert.deepEqual(batch.departments.sort(), ['Design', 'Tech']);
  }

  assert.deepEqual(parseImportedGroupPayload('   '), { ok: false, error: 'EMPTY' });
  assert.deepEqual(parseImportedGroupPayload('{bad'), { ok: false, error: 'INVALID_JSON' });
  assert.deepEqual(parseImportedGroupPayload('{"foo": 123}'), { ok: false, error: 'INVALID_SCHEMA' });
});
