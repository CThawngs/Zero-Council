import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const i18n = await import('../web/src/prototype/i18n.ts');

test('Group sidebar rows support right-click context menu only on app rows while keeping ellipsis and keyboard a11y', () => {
  const sidebar = read('web/src/prototype/components/Sidebar.tsx');
  const groupMenu = read('web/src/prototype/components/sidebar/GroupActionMenu.tsx');

  // Right-click handler is attached to group <li> rows (exactly once), never to <aside> or <nav>.
  assert.equal((sidebar.match(/onContextMenu=/g) ?? []).length, 1);
  assert.match(sidebar, /data-sidebar-group=\{group\.id\}[\s\S]*?onContextMenu=/);
  assert.match(sidebar, /event\.preventDefault\(\)/);
  assert.match(sidebar, /openGroupContextMenu\(/);

  // Existing ellipsis trigger, keyboard menu key / Shift+F10, portal, and viewport clamping remain wired.
  assert.match(sidebar, /data-group-menu-trigger=\{group\.id\}/);
  assert.match(sidebar, /event\.key === 'ContextMenu'/);
  assert.match(sidebar, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(sidebar, /createPortal\(renderedGroupMenu,\s*document\.body\)/);
  assert.match(sidebar, /clampMenuToViewport\(/);
  assert.match(sidebar, /adjustMenuRectToViewport\(/);
  assert.match(sidebar, /handleFloatingMenuKeyDown\(/);

  // Existing 5 group actions remain intact in GroupActionMenu.
  assert.equal((groupMenu.match(/role="menuitem"/g) ?? []).length, 5);
  assert.ok(groupMenu.includes('onRename'));
  assert.ok(groupMenu.includes('onEditGroup'));
  assert.ok(groupMenu.includes('onTogglePin'));
  assert.ok(groupMenu.includes('onExport'));
  assert.ok(groupMenu.includes('onConfirmOrDelete'));

  // Global create buttons remain untouched.
  assert.ok(sidebar.includes('id="sidebar-new-group-btn"'));
  assert.ok(sidebar.includes('id="sidebar-new-bot-btn"'));
});

test('SidebarBotsSection adds per-bot fresh-thread (+) button and accessible right-click menu with explicit delete modal', () => {
  const botsSection = read('web/src/prototype/components/sidebar/SidebarBotsSection.tsx');
  const header = read('web/src/prototype/components/chat-room/ChatRoomHeader.tsx');

  // Per-bot + button calls createSoloThread(bot.id) rather than openBotChat(bot.id).
  assert.match(botsSection, /data-bot-new-chat=\{bot\.id\}/);
  assert.match(
    botsSection,
    /const handleNewSoloChat = async \(botId: string\) => \{[\s\S]*?await createSoloThread\(botId\);/
  );

  // Keep the third global create button inside ChatRoomHeader untouched.
  assert.ok(header.includes('id="solo-new-thread-btn"'));

  // Right-click handler is attached only to bot rows (exactly once).
  assert.equal((botsSection.match(/onContextMenu=/g) ?? []).length, 1);
  assert.match(botsSection, /data-sidebar-bot-row=\{bot\.id\}[\s\S]*?onContextMenu=/);
  assert.match(botsSection, /data-bot-menu-trigger=\{bot\.id\}/);
  assert.match(botsSection, /data-sidebar-popover="bot"/);

  // Bot menu includes New chat, Edit bot (opens right inspector), and Delete bot (opens explicit confirmation modal).
  assert.match(botsSection, /data-bot-menu-new-chat=\{activeBotForMenu\.id\}/);
  assert.match(botsSection, /data-bot-menu-edit=\{activeBotForMenu\.id\}/);
  assert.match(botsSection, /data-bot-menu-delete=\{activeBotForMenu\.id\}/);
  assert.match(
    botsSection,
    /const handleEditBot = \(botId: string\) => \{[\s\S]*?openBotChat\(botId\);[\s\S]*?if \(!panel\.visible\) \{[\s\S]*?panel\.toggle\(\);/
  );

  // Delete menu item opens a confirmation modal instead of calling deleteBot directly.
  assert.match(botsSection, /setPendingDeleteBot\(target\)/);
  assert.match(
    botsSection,
    /<Modal[\s\S]*?isOpen=\{Boolean\(pendingDeleteBot\)\}[\s\S]*?data-bot-delete-cancel[\s\S]*?data-bot-delete-confirm/
  );
  assert.match(botsSection, /createPortal\(renderedBotMenu,\s*document\.body\)/);
});

test('ChatRoomView renders full-pane without nested card borders, rounding, shadow, or max-w-4xl cap', () => {
  const chatRoom = read('web/src/prototype/components/ChatRoomView.tsx');

  assert.match(chatRoom, /data-chat-pane=\{expanded \? 'expanded' : 'full'\}/);
  assert.match(
    chatRoom,
    /-mx-4 -my-5 flex h-\[calc\(100dvh-76px\)\] flex-col bg-surface sm:-mx-6 sm:-my-7 lg:-mx-8 lg:-my-9/
  );
  assert.doesNotMatch(chatRoom, /max-w-4xl/);
  assert.doesNotMatch(chatRoom, /rounded-3xl/);
  assert.doesNotMatch(chatRoom, /shadow-\[var\(--shadow-lift\)\]/);

  // Header, transcript, composer, and clear confirmation modal stay preserved.
  assert.ok(chatRoom.includes('<ChatRoomHeader'));
  assert.ok(chatRoom.includes('<ChatTranscriptLog'));
  assert.ok(chatRoom.includes('<ChatComposer'));
  assert.ok(chatRoom.includes('id="confirm-clear-room-btn"'));
});

test('Bilingual sidebar bot menu strings exist and are non-empty in EN and VI', () => {
  assert.deepEqual(i18n.missingCopyKeys('en'), []);
  assert.deepEqual(i18n.missingCopyKeys('vi'), []);
  for (const key of [
    'sidebarBotNewChatWith',
    'sidebarActionEditBot',
    'sidebarBotMoreActions',
    'sidebarMenuNewChat',
    'wsDeleteBot',
    'wsDeleteConfirm',
    'wsDeleteCancel',
  ]) {
    assert.equal(typeof i18n.copy.en[key], 'string', 'en.' + key);
    assert.equal(typeof i18n.copy.vi[key], 'string', 'vi.' + key);
    assert.ok(i18n.copy.en[key].trim().length > 0, 'en.' + key + ' non-empty');
    assert.ok(i18n.copy.vi[key].trim().length > 0, 'vi.' + key + ' non-empty');
  }
  assert.ok(i18n.copy.en.sidebarBotNewChatWith.includes('{name}'));
  assert.ok(i18n.copy.vi.sidebarBotNewChatWith.includes('{name}'));
  assert.ok(i18n.copy.en.sidebarBotMoreActions.includes('{name}'));
  assert.ok(i18n.copy.vi.sidebarBotMoreActions.includes('{name}'));
});
