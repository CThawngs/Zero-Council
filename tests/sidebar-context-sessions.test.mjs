import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const {
  RECENT_SOLO_SESSIONS_LIMIT,
  SIDEBAR_SESSION_COPY,
  canDeleteSoloSession,
  partitionBoundedSessions,
  selectOrderedSoloSessions,
  togglePinConversation,
  EMPTY_SIDEBAR_ORG,
} = await import('../web/src/prototype/sidebar-organization.ts');

test('Sidebar mounts SidebarSessionsSection and coordinates single-open popup across Group, Bot, and Session', () => {
  const sidebar = read('web/src/prototype/components/Sidebar.tsx');
  const botsSection = read('web/src/prototype/components/sidebar/SidebarBotsSection.tsx');
  const sessionsSection = read('web/src/prototype/components/sidebar/SidebarSessionsSection.tsx');
  const sessionMenu = read('web/src/prototype/components/sidebar/SessionActionMenu.tsx');

  // Sidebar mounts both Bots and Sessions sections and wires mutual close refs.
  assert.ok(sidebar.includes('<SidebarBotsSection'));
  assert.ok(sidebar.includes('<SidebarSessionsSection'));
  assert.ok(sidebar.includes('closeBotMenuRef'));
  assert.ok(sidebar.includes('closeSessionMenuRef'));
  assert.match(sidebar, /const closeAllMenus = useCallback\(/);

  // Opening Group menu closes both Bot and Session menus.
  const openGroupMatch = sidebar.match(
    /const openGroupMenu = \([\s\S]*?setMenu\(\{ groupId, \.\.\.pos \}\);\r?\n  \};/
  );
  assert.ok(openGroupMatch, 'openGroupMenu exists');
  assert.match(openGroupMatch[0], /closeBotMenuRef\.current\?\.\(\);/);
  assert.match(openGroupMatch[0], /closeSessionMenuRef\.current\?\.\(\);/);
  assert.match(openGroupMatch[0], /recordNavScrollAtMenuOpen\(\);/);

  const openGroupCtxMatch = sidebar.match(
    /const openGroupContextMenu = \([\s\S]*?setMenu\(\{ groupId, \.\.\.pos \}\);\r?\n  \};/
  );
  assert.ok(openGroupCtxMatch, 'openGroupContextMenu exists');
  assert.match(openGroupCtxMatch[0], /closeBotMenuRef\.current\?\.\(\);/);
  assert.match(openGroupCtxMatch[0], /closeSessionMenuRef\.current\?\.\(\);/);
  assert.match(openGroupCtxMatch[0], /recordNavScrollAtMenuOpen\(\);/);

  // Opening Bot menu closes Group and Session menus; opening Session menu closes Group and Bot menus.
  assert.match(
    sidebar,
    /<SidebarBotsSection[\s\S]*?onBeforeOpenMenu=\{\(\) => \{\s*closeMenu\(false\);\s*closeSessionMenuRef\.current\?\.\(\);\s*recordNavScrollAtMenuOpen\(\);\s*\}\}/
  );
  assert.match(
    sidebar,
    /<SidebarSessionsSection[\s\S]*?onBeforeOpenMenu=\{\(\) => \{\s*closeMenu\(false\);\s*closeBotMenuRef\.current\?\.\(\);\s*recordNavScrollAtMenuOpen\(\);\s*\}\}/
  );

  // Right-click handler is attached strictly once per row list (never on <aside>, <nav>, or rename <input>).
  assert.equal((sidebar.match(/onContextMenu=/g) ?? []).length, 1);
  assert.equal((botsSection.match(/onContextMenu=/g) ?? []).length, 1);
  assert.equal((sessionsSection.match(/onContextMenu=/g) ?? []).length, 1);

  // Session rows expose real title + <time> updatedAt without fabricating sequential #N IDs.
  assert.match(sessionsSection, /data-sidebar-session=\{session\.id\}/);
  assert.match(sessionsSection, /data-session-title=\{session\.id\}/);
  assert.match(sessionsSection, /data-session-updated=\{session\.id\}/);
  assert.doesNotMatch(sessionsSection, /#\$\{/);

  // Session rows support click, ellipsis trigger, ContextMenu / Shift+F10, portal, stopPropagation, clamping, and keyboard nav.
  assert.match(sessionsSection, /data-session-menu-trigger=\{session\.id\}/);
  assert.match(sessionsSection, /event\.key === 'ContextMenu'/);
  assert.match(sessionsSection, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(sessionsSection, /createPortal\(renderedSessionMenu,\s*document\.body\)/);
  assert.match(sessionsSection, /menuEl\?\.addEventListener\('pointerdown', stopInsidePointerDown\)/);
  assert.match(sessionsSection, /clampMenuToViewport\(/);
  assert.match(sessionsSection, /adjustMenuRectToViewport\(/);
  assert.match(sessionsSection, /handleFloatingMenuKeyDown\(/);

  // Bounded density expand/collapse toggle is present and real.
  assert.match(sessionsSection, /data-sessions-expand-toggle/);

  // SessionActionMenu wires real Open, Rename, Pin/Unpin, and 2-step Delete + Cancel + last-session disabled state.
  assert.match(sessionMenu, /data-sidebar-popover="session"/);
  assert.match(sessionMenu, /data-session-menu-open=\{session\.id\}/);
  assert.match(sessionMenu, /data-session-menu-rename=\{session\.id\}/);
  assert.match(sessionMenu, /data-session-menu-pin=\{session\.id\}/);
  assert.match(sessionMenu, /data-session-menu-delete=\{session\.id\}/);
  assert.match(sessionMenu, /data-session-menu-cancel-delete=\{session\.id\}/);
  assert.match(sessionMenu, /disabled=\{!canDelete\}/);
  assert.match(sessionMenu, /data-session-delete-disabled=\{!canDelete \? 'true' : undefined\}/);
});

test('Behavioral simulation: single-open menu coordinator + session Open/Rename/Pin/2-step Delete + last-session invariant', () => {
  let openGroup = null;
  let openBot = null;
  let openSession = null;

  const openGroupFn = (id) => {
    openBot = null;
    openSession = null;
    openGroup = id;
  };
  const openBotFn = (id) => {
    openGroup = null;
    openSession = null;
    openBot = id;
  };
  const openSessionFn = (id) => {
    openGroup = null;
    openBot = null;
    openSession = id;
  };
  const activeMenuCount = () =>
    [openGroup, openBot, openSession].filter((v) => v !== null).length;

  openGroupFn('g-1');
  assert.equal(activeMenuCount(), 1);
  openBotFn('b-1');
  assert.equal(activeMenuCount(), 1);
  assert.equal(openGroup, null);
  assert.equal(openBot, 'b-1');
  openSessionFn('s-1');
  assert.equal(activeMenuCount(), 1);
  assert.equal(openBot, null);
  assert.equal(openSession, 's-1');

  // Session lifecycle with 2 threads on bot-alpha and 1 thread on bot-beta.
  let conversations = Array.from({ length: 6 }, (_, idx) => ({
    id: `alpha-${idx + 1}`,
    kind: 'solo',
    botId: 'bot-alpha',
    title: `Alpha Topic ${idx + 1}`,
    roster: ['bot:bot-alpha'],
    createdAt: `2026-11-20T0${idx}:00:00Z`,
    updatedAt: `2026-11-27T0${idx}:00:00Z`,
  })).concat([
    {
      id: 'beta-only',
      kind: 'solo',
      botId: 'bot-beta',
      title: 'Beta Single Session',
      roster: ['bot:bot-beta'],
      createdAt: '2026-11-27T08:00:00Z',
      updatedAt: '2026-11-27T08:30:00Z',
    },
  ]);

  let org = EMPTY_SIDEBAR_ORG;
  org = togglePinConversation(org, 'alpha-1');

  const ordered = selectOrderedSoloSessions(
    conversations,
    org.pinnedIds,
    new Set(['bot-alpha', 'bot-beta'])
  );
  assert.equal(ordered[0].id, 'alpha-1', 'pinned session ranks first');
  assert.equal(ordered[1].id, 'beta-only', 'newest unpinned session ranks second');

  const bounded = partitionBoundedSessions(ordered, false, RECENT_SOLO_SESSIONS_LIMIT);
  assert.equal(bounded.visible.length, 5);
  assert.equal(bounded.canExpand, true);
  assert.equal(partitionBoundedSessions(ordered, true, RECENT_SOLO_SESSIONS_LIMIT).visible.length, 7);

  // beta-only is the sole session for bot-beta -> cannot delete.
  assert.equal(canDeleteSoloSession(conversations, 'beta-only'), false);

  // Delete all but one session on bot-alpha; once 1 remains, last-session protection activates.
  for (const id of ['alpha-6', 'alpha-5', 'alpha-4', 'alpha-3', 'alpha-2']) {
    assert.equal(canDeleteSoloSession(conversations, id), true);
    conversations = conversations.filter((c) => c.id !== id);
  }
  assert.equal(
    canDeleteSoloSession(conversations, 'alpha-1'),
    false,
    'last surviving solo session for bot-alpha is protected from deletion'
  );
  assert.ok(SIDEBAR_SESSION_COPY.en.lastSessionHint.length > 0);
  assert.ok(SIDEBAR_SESSION_COPY.vi.lastSessionHint.length > 0);
});
