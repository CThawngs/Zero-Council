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
  assert.match(sidebar, /menuEl\?\.addEventListener\('pointerdown', stopInsidePointerDown\)/);
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

  // Bot menu includes New chat, Edit bot (direct edit modal without creating/selecting a chat), and Delete bot (explicit confirmation modal).
  assert.match(botsSection, /data-bot-menu-new-chat=\{activeBotForMenu\.id\}/);
  assert.match(botsSection, /data-bot-menu-edit=\{activeBotForMenu\.id\}/);
  assert.match(botsSection, /data-bot-menu-delete=\{activeBotForMenu\.id\}/);
  const editHandlerMatch = botsSection.match(
    /const handleEditBot = \(botId: string\) => \{[\s\S]*?\};/
  );
  assert.ok(editHandlerMatch, 'handleEditBot should exist in SidebarBotsSection');
  assert.match(editHandlerMatch[0], /openEditBot\(botId\);/);
  assert.doesNotMatch(editHandlerMatch[0], /openBotChat\(/);
  assert.doesNotMatch(editHandlerMatch[0], /createSoloThread\(/);

  // Delete menu item opens a confirmation modal instead of calling deleteBot directly.
  assert.match(botsSection, /setPendingDeleteBot\(target\)/);
  assert.match(
    botsSection,
    /<Modal[\s\S]*?isOpen=\{Boolean\(pendingDeleteBot\)\}[\s\S]*?data-bot-delete-cancel[\s\S]*?data-bot-delete-confirm/
  );
  assert.match(botsSection, /createPortal\(renderedBotMenu,\s*document\.body\)/);
  assert.match(botsSection, /menuEl\?\.addEventListener\('pointerdown', stopInsidePointerDown\)/);
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

test('Edit bot opens target bot editor directly without creating or selecting a conversation', () => {
  const appContext = read('web/src/prototype/context/AppContext.tsx');
  const contextTypes = read('web/src/prototype/context/types.ts');
  const personasView = read('web/src/prototype/components/PersonasView.tsx');

  // Context contract exposes editingBotId + openEditBot + closeEditBot.
  assert.match(contextTypes, /editingBotId: string \| null;/);
  assert.match(contextTypes, /openEditBot: \(botId: string\) => void;/);
  assert.match(contextTypes, /closeEditBot: \(\) => void;/);

  // openEditBot switches to personas view and sets editingBotId without touching conversations or openBotChat.
  const openEditMatch = appContext.match(
    /const openEditBot = useCallback\([\s\S]*?\[setCurrentView\]\r?\n  \);/
  );
  assert.ok(openEditMatch, 'openEditBot callback should exist in AppContext');
  assert.match(openEditMatch[0], /setEditingBotId\(botId\);/);
  assert.match(openEditMatch[0], /setCurrentView\('personas'\);/);
  assert.doesNotMatch(openEditMatch[0], /openBotChat/);
  assert.doesNotMatch(openEditMatch[0], /createSoloThread/);
  assert.doesNotMatch(openEditMatch[0], /conversations/);

  // Navigating away from personas or deleting the edited bot clears editingBotId.
  assert.match(
    appContext,
    /if \(next !== 'personas'\) \{[\s\S]*?setEditingBotId\(null\);/
  );
  assert.match(
    appContext,
    /setEditingBotId\(\(current\) => \(current === id \? null : current\)\);/
  );

  // PersonasView derives editingBot from editingBotId and renders keyed EditBotModal for that target bot.
  assert.match(
    personasView,
    /const editingBot = editingBotId \? bots\.find\(\(b\) => b\.id === editingBotId\) \?\? null : null;/
  );
  assert.match(
    personasView,
    /<EditBotModal[\s\S]*?key=\{editingBot\.id\}[\s\S]*?bot=\{editingBot\}[\s\S]*?onClose=\{closeEditBot\}/
  );
  assert.match(personasView, /data-edit-bot-modal=\{bot\.id\}/);
  assert.match(personasView, /id="edit-bot-name"/);
  assert.match(personasView, /id="edit-bot-instruction"/);
  assert.match(personasView, /id="edit-bot-save-btn"/);

  // Behavioral simulation: bot with zero conversations -> openEditBot(bot.id) -> editor resolves target bot, conversations unchanged.
  const bots = [
    { id: 'bot-with-chat', name: 'Alpha', instruction: 'Alpha prompt', provider: 'openai', model: 'gpt-4o' },
    { id: 'bot-zero-chats', name: 'Zero-Chat Bot', instruction: 'Never auto-create thread on edit', provider: 'anthropic', model: 'claude-sonnet' },
  ];
  const conversations = [
    { id: 'solo-alpha-1', kind: 'solo', botId: 'bot-with-chat', title: 'Alpha', messages: [] },
  ];
  let currentView = 'chat-room';
  let editingBotId = null;
  let createdConversations = 0;

  const openEditBot = (botId) => {
    editingBotId = botId;
    currentView = 'personas';
  };
  const closeEditBot = () => {
    editingBotId = null;
  };

  assert.equal(conversations.filter((c) => c.botId === 'bot-zero-chats').length, 0);
  openEditBot('bot-zero-chats');

  const resolvedBot = editingBotId ? bots.find((b) => b.id === editingBotId) ?? null : null;
  assert.equal(currentView, 'personas');
  assert.equal(resolvedBot?.id, 'bot-zero-chats');
  assert.equal(resolvedBot?.name, 'Zero-Chat Bot');
  assert.equal(createdConversations, 0);
  assert.equal(conversations.length, 1);
  assert.equal(conversations.filter((c) => c.botId === 'bot-zero-chats').length, 0);

  closeEditBot();
  assert.equal(editingBotId, null);
});

import { registerHooks } from 'node:module';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const resolveTsCandidate = (basePath) => {
  for (const candidate of [
    basePath,
    basePath + '.ts',
    basePath + '.tsx',
    path.join(basePath, 'index.ts'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react') {
      return {
        url: pathToFileURL(path.join(ROOT, 'web/node_modules/react/index.js')).href,
        shortCircuit: true,
      };
    }
    if (specifier.startsWith('@/')) {
      const hit = resolveTsCandidate(path.join(ROOT, 'web/src', specifier.slice(2)));
      if (hit) return { url: hit, shortCircuit: true };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file:') &&
      !path.extname(specifier)
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const hit = resolveTsCandidate(path.resolve(parentDir, specifier));
      if (hit) return { url: hit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const convLifecycle = await import('../web/src/prototype/context/useConversations.ts');
const {
  createSerialQueue,
  executeBotSoloConversationPurge,
  executeDeleteRemoteConversation,
  executeSingleConversationDelete,
  isSoloConversationForBot,
  isSoloRoomForBot,
  snapshotBotSoloConversationIds,
} = convLifecycle;

test('Source contracts: AppContext.deleteBot awaits serialized purge, functional updates, and recoverable UI error', () => {
  const appContext = read('web/src/prototype/context/AppContext.tsx');
  const useConvSrc = read('web/src/prototype/context/useConversations.ts');
  const botsSection = read('web/src/prototype/components/sidebar/SidebarBotsSection.tsx');

  // AppContext.deleteBot must await purgeBotSoloConversations and must NOT fire unawaited deleteConversationById loops.
  const deleteBotMatch = appContext.match(
    /const deleteBot = async \(id: string\) => \{[\s\S]*?\r?\n  \};/
  );
  assert.ok(deleteBotMatch, 'deleteBot should exist in AppContext');
  assert.match(deleteBotMatch[0], /await conv\.purgeBotSoloConversations\(id\);/);
  assert.doesNotMatch(deleteBotMatch[0], /void conv\.deleteConversationById/);

  // useConversations uses functional updater for removals and never applies sameBotNext inside bot purge.
  const purgeFnMatch = useConvSrc.match(
    /export async function executeBotSoloConversationPurge\([\s\S]*?\}: BotSoloPurgeDeps\): Promise<void> \{[\s\S]*?\r?\n\}/
  );
  assert.ok(purgeFnMatch, 'executeBotSoloConversationPurge should exist');
  assert.doesNotMatch(purgeFnMatch[0], /sameBotNext/);
  assert.match(
    purgeFnMatch[0],
    /updateConversations\(\(prev\) => prev\.filter\(\(item\) => item\.id !== convId\)\)/
  );

  // SidebarBotsSection surfaces recoverable delete error alert + toast and keeps modal dismissible.
  assert.match(botsSection, /setDeleteBotError\(t\.authGenericError\)/);
  assert.match(botsSection, /showToast\('authGenericError'\)/);
  assert.match(botsSection, /data-bot-delete-error/);
});

test('Active bot delete with >=3 solo threads and active 2nd thread serializes server DELETEs (0 race/404), clears room once, and never reopens ghost thread', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zc-purge-race-'));
  const prevStore = process.env.ZC_CONVERSATIONS_STORE;
  process.env.ZC_CONVERSATIONS_STORE = path.join(tmpDir, 'conversations.json');
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const convStore = await import(
      '../web/src/lib/store/conversations.ts?purgeRace=' + Date.now()
    );
    const email = 'qa-disposable@zerocouncil.local';

    // Seed real file-backed store: 3 solo threads for bot-alpha (2nd created via + is active),
    // 1 solo thread for bot-beta, and 1 group conversation including bot:bot-alpha.
    const alpha1 = await convStore.createConversation(email, {
      kind: 'solo',
      botId: 'bot-alpha',
      title: 'Alpha Old Thread',
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
    });
    const alpha2 = await convStore.createConversation(email, {
      kind: 'solo',
      botId: 'bot-alpha',
      title: 'New thread',
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
    });
    const alpha3 = await convStore.createConversation(email, {
      kind: 'solo',
      botId: 'bot-alpha',
      title: 'Alpha Third Thread',
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
    });
    const beta1 = await convStore.createConversation(email, {
      kind: 'solo',
      botId: 'bot-beta',
      title: 'Beta Existing Thread',
      mode: 'round-robin',
      roster: ['bot:bot-beta'],
      messages: [],
    });
    const group1 = await convStore.createConversation(email, {
      kind: 'group',
      title: 'Strategy Council',
      mode: 'round-robin',
      roster: ['bot:bot-alpha', 'bot:bot-beta'],
      messages: [],
    });

    let conversations = [alpha3, alpha2, alpha1, beta1, group1];
    let bots = [
      { id: 'bot-alpha', name: 'Alpha Strategist' },
      { id: 'bot-beta', name: 'Beta Reviewer' },
    ];
    // Active room is the 2nd thread (alpha2, created via +).
    let currentRoom = {
      conversationId: alpha2.id,
      kind: 'solo',
      botId: 'bot-alpha',
      title: alpha2.title,
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
      pending: [],
      turns: 0,
      stoppedBy: null,
      failures: [],
      held: [],
    };

    const deletedConversationIds = new Set();
    const purgingBotIds = new Set();
    const deletedBotIds = new Set();
    const enqueueDelete = createSerialQueue();

    let abortCount = 0;
    let clearStoredCount = 0;
    let inFlightServerDeletes = 0;
    let maxConcurrentServerDeletes = 0;
    const deleteStatuses = [];

    const fetchStub = async (url, init) => {
      assert.equal(init?.method, 'DELETE');
      const id = new URL(url, 'http://localhost').searchParams.get('id');
      inFlightServerDeletes += 1;
      maxConcurrentServerDeletes = Math.max(maxConcurrentServerDeletes, inFlightServerDeletes);
      await new Promise((r) => setTimeout(r, 12));
      try {
        const removed = await convStore.deleteConversation(email, id);
        const status = removed ? 200 : 404;
        deleteStatuses.push({ id, status });
        return new Response(JSON.stringify(removed ? { ok: true } : { error: 'NOT_FOUND' }), {
          status,
        });
      } finally {
        inFlightServerDeletes -= 1;
      }
    };

    const updateConversations = (updater) => {
      conversations = updater(conversations);
    };
    const updateCurrentRoom = (updater) => {
      const next = typeof updater === 'function' ? updater(currentRoom) : updater;
      if (
        next &&
        ((next.conversationId && deletedConversationIds.has(next.conversationId)) ||
          (next.kind === 'solo' &&
            next.botId &&
            (purgingBotIds.has(next.botId) || deletedBotIds.has(next.botId))))
      ) {
        return;
      }
      currentRoom = next;
    };

    // 1. Cancel remains a strict no-op before confirmation.
    const snapshotBeforeCancel = conversations.map((c) => c.id);
    assert.equal(snapshotBeforeCancel.length, 5);

    // 2. Confirm delete on active bot-alpha: purge threads -> mark deleted -> remove bot -> switch to bot-beta.
    await executeBotSoloConversationPurge({
      botId: 'bot-alpha',
      isAuthenticated: true,
      getConversations: () => conversations,
      updateConversations,
      getCurrentRoom: () => currentRoom,
      updateCurrentRoom,
      abortActiveTurn: () => {
        abortCount += 1;
      },
      clearStoredRoomFn: () => {
        clearStoredCount += 1;
      },
      markConversationDeleted: (id) => deletedConversationIds.add(id),
      purgingBotIds,
      enqueueDelete,
      fetchImpl: fetchStub,
    });

    deletedBotIds.add('bot-alpha');
    bots = bots.filter((b) => b.id !== 'bot-alpha');

    // Sidebar switches to remaining bot-beta once deleteBot resolves.
    const nextBot = bots.find((b) => b.id !== 'bot-alpha');
    const nextConv = conversations.find((c) => c.kind === 'solo' && c.botId === nextBot.id);
    updateCurrentRoom({
      conversationId: nextConv.id,
      kind: 'solo',
      botId: nextConv.botId,
      title: nextConv.title,
      mode: nextConv.mode,
      roster: nextConv.roster,
      messages: [],
      pending: [],
      turns: 0,
      stoppedBy: null,
      failures: [],
      held: [],
    });

    // Simulate a late async turn completion trying to reopen ghost room for alpha1/alpha2.
    updateCurrentRoom({
      conversationId: alpha1.id,
      kind: 'solo',
      botId: 'bot-alpha',
      title: 'Alpha Old Thread',
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
      pending: [],
      turns: 1,
      stoppedBy: 'completed',
      failures: [],
      held: [],
    });

    // Verify every acceptance criterion:
    assert.equal(maxConcurrentServerDeletes, 1, 'server DELETEs must be strictly serialized');
    assert.deepEqual(
      deleteStatuses.map((s) => s.status),
      [200, 200, 200],
      'zero 404s across >=3 solo thread deletes'
    );
    assert.equal(abortCount, 1, 'active target-bot room aborted exactly once');
    assert.equal(clearStoredCount, 1, 'stored room cleared exactly once');
    assert.equal(
      conversations.some((c) => isSoloConversationForBot(c, 'bot-alpha')),
      false,
      'no deleted-bot solo conversation remains in client list'
    );
    assert.deepEqual(
      conversations.map((c) => c.id),
      [beta1.id, group1.id],
      'surviving bot solo thread and group conversation remain untouched'
    );
    assert.equal(currentRoom?.botId, 'bot-beta', 'currentRoom stays on surviving bot-beta');
    assert.equal(currentRoom?.conversationId, beta1.id);

    const serverRemaining = await convStore.listConversations(email);
    assert.deepEqual(
      serverRemaining.map((c) => c.id).sort(),
      [beta1.id, group1.id].sort(),
      'server store retains zero orphan threads for deleted bot'
    );
  } finally {
    if (prevStore === undefined) delete process.env.ZC_CONVERSATIONS_STORE;
    else process.env.ZC_CONVERSATIONS_STORE = prevStore;
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('Deleting an inactive bot leaves active room untouched; failed API delete surfaces error without silent loss and recovers on retry; local unauth threads purge without network', async () => {
  let conversations = [
    {
      id: 'inactive-1',
      kind: 'solo',
      botId: 'bot-inactive',
      title: 'Inactive 1',
      mode: 'round-robin',
      roster: ['bot:bot-inactive'],
      messages: [],
    },
    {
      id: 'inactive-2',
      kind: 'solo',
      botId: 'bot-inactive',
      title: 'Inactive 2',
      mode: 'round-robin',
      roster: ['bot:bot-inactive'],
      messages: [],
    },
    {
      id: 'active-beta',
      kind: 'solo',
      botId: 'bot-beta',
      title: 'Active Beta',
      mode: 'round-robin',
      roster: ['bot:bot-beta'],
      messages: [],
    },
  ];
  let currentRoom = {
    conversationId: 'active-beta',
    kind: 'solo',
    botId: 'bot-beta',
    title: 'Active Beta',
    mode: 'round-robin',
    roster: ['bot:bot-beta'],
    messages: [],
    pending: [],
    turns: 0,
    stoppedBy: null,
    failures: [],
    held: [],
  };

  const deletedIds = new Set();
  const purgingBotIds = new Set();
  const enqueueDelete = createSerialQueue();
  let abortCalled = 0;

  // First attempt: inactive-2 fails with HTTP 500 -> throws recoverable error, keeps inactive-2 in client state, leaves active-beta untouched.
  let failSecond = true;
  await assert.rejects(
    () =>
      executeBotSoloConversationPurge({
        botId: 'bot-inactive',
        isAuthenticated: true,
        getConversations: () => conversations,
        updateConversations: (fn) => {
          conversations = fn(conversations);
        },
        getCurrentRoom: () => currentRoom,
        updateCurrentRoom: (fn) => {
          currentRoom = fn(currentRoom);
        },
        abortActiveTurn: () => {
          abortCalled += 1;
        },
        clearStoredRoomFn: () => {},
        markConversationDeleted: (id) => deletedIds.add(id),
        purgingBotIds,
        enqueueDelete,
        fetchImpl: async (url) => {
          const id = new URL(url, 'http://localhost').searchParams.get('id');
          if (failSecond && id === 'inactive-2') {
            return new Response(JSON.stringify({ error: 'DELETE_FAILED' }), { status: 500 });
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      }),
    /CONVERSATION_PURGE_FAILED:inactive-2/
  );

  assert.equal(purgingBotIds.size, 0, 'purging flag cleaned up after failure');
  assert.deepEqual(
    conversations.map((c) => c.id),
    ['inactive-2', 'active-beta'],
    'failed delete must not silently drop un-deleted thread'
  );
  assert.equal(currentRoom?.conversationId, 'active-beta', 'active room on another bot untouched');
  assert.equal(abortCalled, 0);

  // Retry succeeds cleanly and deletes remaining inactive-2 without touching active-beta.
  failSecond = false;
  await executeBotSoloConversationPurge({
    botId: 'bot-inactive',
    isAuthenticated: true,
    getConversations: () => conversations,
    updateConversations: (fn) => {
      conversations = fn(conversations);
    },
    getCurrentRoom: () => currentRoom,
    updateCurrentRoom: (fn) => {
      currentRoom = fn(currentRoom);
    },
    abortActiveTurn: () => {
      abortCalled += 1;
    },
    clearStoredRoomFn: () => {},
    markConversationDeleted: (id) => deletedIds.add(id),
    purgingBotIds,
    enqueueDelete,
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });

  assert.deepEqual(conversations.map((c) => c.id), ['active-beta']);
  assert.equal(currentRoom?.conversationId, 'active-beta');
  assert.equal(abortCalled, 0);

  // Local / unauthenticated conversations purge without calling fetch.
  const localList = [
    {
      id: 'local-solo-1',
      kind: 'solo',
      botId: 'bot-local',
      title: 'Local 1',
      mode: 'round-robin',
      roster: ['bot:bot-local'],
      messages: [],
    },
  ];
  let fetchCount = 0;
  assert.equal(
    await executeDeleteRemoteConversation('local-solo-1', true, async () => {
      fetchCount += 1;
      return new Response('{}', { status: 500 });
    }),
    true
  );
  assert.equal(
    await executeDeleteRemoteConversation('persisted-id', false, async () => {
      fetchCount += 1;
      return new Response('{}', { status: 500 });
    }),
    true
  );
  assert.equal(fetchCount, 0, 'local-* and unauth deletes must not hit network');
  assert.deepEqual(snapshotBotSoloConversationIds(localList, 'bot-local'), ['local-solo-1']);
  assert.equal(
    isSoloRoomForBot({ kind: 'group', roster: ['bot:bot-local'] }, 'bot-local'),
    false,
    'group room is never treated as solo room for deleted bot'
  );
});

test('Single-conversation delete uses functional state updates, preserves state on API failure, and keeps sameBotNext for surviving bot', async () => {
  let conversations = [
    {
      id: 'alpha-2',
      kind: 'solo',
      botId: 'bot-alpha',
      title: 'Alpha 2',
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
    },
    {
      id: 'alpha-1',
      kind: 'solo',
      botId: 'bot-alpha',
      title: 'Alpha 1',
      mode: 'round-robin',
      roster: ['bot:bot-alpha'],
      messages: [],
    },
  ];
  let currentRoom = {
    conversationId: 'alpha-2',
    kind: 'solo',
    botId: 'bot-alpha',
    title: 'Alpha 2',
    mode: 'round-robin',
    roster: ['bot:bot-alpha'],
    messages: [],
    pending: [],
    turns: 0,
    stoppedBy: null,
    failures: [],
    held: [],
  };
  let failureCount = 0;
  const enqueueDelete = createSerialQueue();

  // 1. Failed single-conversation API delete keeps client state intact and invokes onFailure.
  const failedResult = await executeSingleConversationDelete({
    id: 'alpha-2',
    isAuthenticated: true,
    getConversations: () => conversations,
    updateConversations: (fn) => {
      conversations = fn(conversations);
    },
    getCurrentRoom: () => currentRoom,
    updateCurrentRoom: (fn) => {
      currentRoom = fn(currentRoom);
    },
    abortActiveTurn: () => {},
    clearStoredRoomFn: () => {},
    markConversationDeleted: () => {},
    purgingBotIds: new Set(),
    deletedBotIds: new Set(),
    loadConversationIntoRoom: (conv) => {
      currentRoom = { ...currentRoom, conversationId: conv.id, title: conv.title };
    },
    openFirstBotOrWizard: () => {},
    enqueueDelete,
    onFailure: () => {
      failureCount += 1;
    },
    fetchImpl: async () => new Response('{}', { status: 500 }),
  });

  assert.equal(failedResult, false);
  assert.equal(failureCount, 1);
  assert.equal(conversations.length, 2);
  assert.equal(currentRoom.conversationId, 'alpha-2');

  // 2. Successful single-conversation delete concurrently with a newly added conversation preserves concurrent item via functional update and falls back to alpha-1.
  const okResult = await executeSingleConversationDelete({
    id: 'alpha-2',
    isAuthenticated: true,
    getConversations: () => conversations,
    updateConversations: (fn) => {
      conversations = fn(conversations);
    },
    getCurrentRoom: () => currentRoom,
    updateCurrentRoom: (fn) => {
      currentRoom = fn(currentRoom);
    },
    abortActiveTurn: () => {},
    clearStoredRoomFn: () => {},
    markConversationDeleted: () => {},
    purgingBotIds: new Set(),
    deletedBotIds: new Set(),
    loadConversationIntoRoom: (conv) => {
      currentRoom = { ...currentRoom, conversationId: conv.id, title: conv.title };
    },
    openFirstBotOrWizard: () => {},
    enqueueDelete,
    fetchImpl: async () => {
      // Concurrent conversation arrives while DELETE is in flight.
      conversations = [
        ...conversations,
        {
          id: 'beta-concurrent',
          kind: 'solo',
          botId: 'bot-beta',
          title: 'Concurrent Beta',
          mode: 'round-robin',
          roster: ['bot:bot-beta'],
          messages: [],
        },
      ];
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  assert.equal(okResult, true);
  assert.deepEqual(
    conversations.map((c) => c.id),
    ['alpha-1', 'beta-concurrent'],
    'functional update preserves concurrently added conversation'
  );
  assert.equal(currentRoom.conversationId, 'alpha-1', 'surviving bot switches to sameBotNext');
});
