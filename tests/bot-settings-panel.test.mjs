import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const logic = await import('../web/src/prototype/bot-settings-panel-logic.ts');
const {
  PANEL_PREF_KEY,
  WORKSPACE_COPY,
  addRosterMember,
  addableBots,
  buildProviderOptions,
  canAddMember,
  canRemoveMember,
  draftFromBot,
  fill,
  isDraftDirty,
  normalizeDraft,
  pickLandingTarget,
  pickModelOnProviderChange,
  rawBotId,
  readPanelPref,
  removeRosterMember,
  resolveRosterMembers,
  resolveSelectedBotId,
  validateDraft,
  workspaceCopy,
  writePanelPref,
} = logic;

const webSrcRoot = fileURLToPath(new URL('../web/src', import.meta.url));
const src = (rel) => readFileSync(path.join(webSrcRoot, rel), 'utf8');
const srcWithDir = (entryRel, dirRel) => {
  const parts = [src(entryRel)];
  const dirPath = path.join(webSrcRoot, dirRel);
  if (existsSync(dirPath)) {
    for (const file of readdirSync(dirPath).sort()) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        parts.push(readFileSync(path.join(dirPath, file), 'utf8'));
      }
    }
  }
  return parts.join('\n');
};

const bot = (id, over = {}) => ({
  id,
  name: `Bot ${id}`,
  instruction: 'Be helpful',
  provider: 'openai',
  model: 'gpt-4o',
  ...over,
});
const labelOf = (provider, custom) => custom ?? provider.toUpperCase();

/* ---------------- bilingual copy ---------------- */

test('EN and VI workspace copy define exactly the same keys, none empty', () => {
  const en = Object.keys(WORKSPACE_COPY.en).sort();
  const vi = Object.keys(WORKSPACE_COPY.vi).sort();
  assert.deepEqual(vi, en);
  for (const lang of ['en', 'vi']) {
    for (const [key, value] of Object.entries(WORKSPACE_COPY[lang])) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('VI copy is really translated (differs from EN) for every user-facing label', () => {
  const same = Object.keys(WORKSPACE_COPY.en).filter(
    (key) => WORKSPACE_COPY.en[key] === WORKSPACE_COPY.vi[key]
  );
  // Only language-neutral strings (the word "Bot", a provider/model template) may match.
  assert.deepEqual(same.sort(), ['botSection', 'modelOf']);
});

test('placeholders are preserved identically across languages', () => {
  const tokens = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(WORKSPACE_COPY.en)) {
    assert.deepEqual(tokens(WORKSPACE_COPY.vi[key]), tokens(WORKSPACE_COPY.en[key]), key);
  }
});

test('fill replaces known tokens and leaves unknown ones visible', () => {
  assert.equal(fill('Delete "{name}"?', { name: 'Ada' }), 'Delete "Ada"?');
  assert.equal(fill('{a}-{b}', { a: 1 }), '1-{b}');
  assert.equal(workspaceCopy('vi').newBot, 'Bot mới');
  assert.equal(workspaceCopy('en').newBot, 'New bot');
});

/* ---------------- roster + selection ---------------- */

test('resolveRosterMembers maps bot:<id> to editable bots and presets to names', () => {
  const members = resolveRosterMembers(
    ['bot:a', 'pragmatist', 'bot:ghost'],
    [bot('a')],
    { pragmatist: 'Pragmatist' }
  );
  assert.equal(members[0].bot?.id, 'a');
  assert.equal(members[1].bot, null);
  assert.equal(members[1].name, 'Pragmatist');
  assert.equal(members[2].bot, null);
  assert.equal(members[2].name, 'ghost');
  assert.equal(rawBotId('bot:a'), 'a');
  assert.equal(rawBotId('pragmatist'), 'pragmatist');
});

test('resolveSelectedBotId: solo uses its bot; group uses the clicked member else first bot', () => {
  const members = resolveRosterMembers(['pragmatist', 'bot:a', 'bot:b'], [bot('a'), bot('b')]);
  assert.equal(resolveSelectedBotId({ kind: 'solo', soloBotId: 'b', members, selectedId: null }), 'b');
  assert.equal(resolveSelectedBotId({ kind: 'group', members, selectedId: 'b' }), 'b');
  assert.equal(resolveSelectedBotId({ kind: 'group', members, selectedId: null }), 'a');
  // stale selection (bot removed from room) falls back to the first editable member
  assert.equal(resolveSelectedBotId({ kind: 'group', members, selectedId: 'zzz' }), 'a');
  // all presets: nothing editable
  const presets = resolveRosterMembers(['pragmatist', 'dreamer'], []);
  assert.equal(resolveSelectedBotId({ kind: 'group', members: presets, selectedId: null }), null);
});

test('a group can never drop below 2 members and respects the plan cap', () => {
  assert.equal(canRemoveMember(['a', 'b']), false);
  assert.equal(removeRosterMember(['bot:a', 'bot:b'], 'bot:a'), null);
  assert.deepEqual(removeRosterMember(['bot:a', 'bot:b', 'bot:c'], 'bot:b'), ['bot:a', 'bot:c']);
  assert.equal(canAddMember(['a', 'b'], 2), false);
  assert.equal(addRosterMember(['bot:a', 'bot:b'], 'bot:c', 2), null);
  assert.deepEqual(addRosterMember(['bot:a', 'bot:b'], 'bot:c', 3), ['bot:a', 'bot:b', 'bot:c']);
  assert.equal(addRosterMember(['bot:a', 'bot:b'], 'bot:a', 5), null, 'no duplicates');
  assert.deepEqual(
    addableBots([bot('a'), bot('b'), bot('c')], ['bot:a', 'pragmatist']).map((b) => b.id),
    ['b', 'c']
  );
});

/* ---------------- draft ---------------- */

test('draft dirty/valid logic trims, and flags the first problem', () => {
  const b = bot('a');
  const same = draftFromBot(b);
  assert.equal(isDraftDirty(b, same), false);
  assert.equal(isDraftDirty(b, { ...same, name: `  ${b.name}  ` }), false, 'whitespace only is not dirty');
  assert.equal(isDraftDirty(b, { ...same, model: 'gpt-4o-mini' }), true);
  assert.equal(isDraftDirty(b, { ...same, provider: 'groq' }), true);
  assert.equal(normalizeDraft({ ...same, name: ' X ', instruction: ' y ' }).name, 'X');

  assert.equal(validateDraft({ ...same, name: '   ' }), 'name');
  assert.equal(validateDraft({ ...same, instruction: '' }), 'instruction');
  assert.equal(validateDraft({ ...same, provider: '' }), 'provider');
  assert.equal(validateDraft({ ...same, model: '' }), 'model');
  assert.equal(validateDraft(same), null);
});

/* ---------------- provider/model ---------------- */

test('provider options: connected only, plus the current provider even when disconnected', () => {
  const keys = [
    { provider: 'openai', modelName: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini'], connected: true },
    { provider: 'groq', modelName: 'llama', models: [], connected: true, label: 'Groq Cloud' },
    { provider: 'xai', modelName: 'grok', models: ['grok'], connected: false },
  ];
  const opts = buildProviderOptions(keys, { provider: 'openai', model: 'gpt-4o' }, labelOf);
  assert.deepEqual(opts.map((o) => o.provider), ['openai', 'groq']);
  assert.deepEqual(opts[1].models, ['llama'], 'falls back to modelName when no list');
  assert.equal(opts[1].label, 'Groq Cloud');

  const orphan = buildProviderOptions(keys, { provider: 'xai', model: 'grok-old' }, labelOf);
  assert.equal(orphan[0].provider, 'xai');
  assert.equal(orphan[0].connected, false);
  assert.deepEqual(orphan[0].models, ['grok-old']);

  const withUnlistedModel = buildProviderOptions(keys, { provider: 'openai', model: 'gpt-legacy' }, labelOf);
  assert.ok(withUnlistedModel[0].models.includes('gpt-legacy'));
});

test('changing provider keeps the model only when the new provider offers it', () => {
  const option = { provider: 'groq', label: 'Groq', connected: true, models: ['a', 'b'] };
  assert.equal(pickModelOnProviderChange(option, 'b'), 'b');
  assert.equal(pickModelOnProviderChange(option, 'gpt-4o'), 'a');
  assert.equal(pickModelOnProviderChange(undefined, 'x'), '');
});

/* ---------------- landing ---------------- */

test('landing: latest valid chat, else first bot, else wizard', () => {
  const bots = [{ id: 'a' }, { id: 'b' }];
  const conv = (id, kind, botId, updatedAt) => ({ id, kind, botId, updatedAt });
  assert.deepEqual(pickLandingTarget([], []), { type: 'wizard' });
  assert.deepEqual(pickLandingTarget(bots, []), { type: 'bot', botId: 'a' });
  assert.deepEqual(
    pickLandingTarget(bots, [
      conv('c1', 'solo', 'a', '2026-01-01T00:00:00Z'),
      conv('c2', 'group', undefined, '2026-03-01T00:00:00Z'),
      conv('c3', 'solo', 'b', '2026-02-01T00:00:00Z'),
    ]),
    { type: 'group', conversationId: 'c2' }
  );
  assert.deepEqual(
    pickLandingTarget(bots, [
      conv('gone', 'solo', 'deleted-bot', '2026-09-01T00:00:00Z'),
      conv('c1', 'solo', 'b', '2026-02-01T00:00:00Z'),
    ]),
    { type: 'solo', botId: 'b', conversationId: 'c1' },
    'a thread whose bot no longer exists is skipped'
  );
});

/* ---------------- panel preference ---------------- */

test('panel preference defaults open, persists closed, survives broken storage', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(readPanelPref(storage), true);
  writePanelPref(storage, false);
  assert.equal(store.get(PANEL_PREF_KEY), 'closed');
  assert.equal(readPanelPref(storage), false);
  writePanelPref(storage, true);
  assert.equal(readPanelPref(storage), true);
  store.set(PANEL_PREF_KEY, '{garbage');
  assert.equal(readPanelPref(storage), true);
  const broken = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  assert.equal(readPanelPref(broken), true);
  assert.doesNotThrow(() => writePanelPref(broken, false));
  assert.equal(readPanelPref(null), true);
});

/* ---------------- component contracts (source-level) ---------------- */

test('BotSettingsPanel wires the required AppContext actions and bot fields', () => {
  const panelEntry = src('prototype/components/BotSettingsPanel.tsx');
  const panel = srcWithDir(
    'prototype/components/BotSettingsPanel.tsx',
    'prototype/components/bot-settings'
  );
  assert.match(panelEntry, /export const BotSettingsPanel\b/);
  assert.match(panelEntry, /\buseBotSettingsPanel\b/);
  for (const hook of ['updateBot', 'deleteBot', 'updateGroupChat', 'openEditGroup', 'apiKeys', 'currentRoom', 'bots']) {
    assert.match(panel, new RegExp(`\\b${hook}\\b`), `uses ${hook} from useApp()`);
  }
  for (const field of ['data-bot-settings-name', 'data-bot-settings-instruction', 'data-bot-settings-provider', 'data-bot-settings-model', 'data-bot-settings-save', 'data-bot-settings-delete']) {
    assert.ok(panel.includes(field), `has ${field}`);
  }
  // Delete is two-step: a confirm dialog must exist before deleteBot is called.
  assert.ok(panel.indexOf('data-bot-settings-delete-confirm') < panel.indexOf('void remove()'));
  assert.match(panel, /setConfirmingDelete\(true\)/);
  // Group room editing: members list, mode switch, add/remove.
  for (const hook of ['data-bot-settings-member', 'data-bot-settings-mode', 'data-bot-settings-add', 'data-bot-settings-remove']) {
    assert.ok(panel.includes(hook), `has ${hook}`);
  }
  // Mobile drawer accessibility + no horizontal overflow.
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /overflow-x-hidden/);
  assert.match(panel, /w-\[min\(92vw,400px\)\]/);
  // Theme: only design tokens, no hard-coded palette colours across entry + submodules.
  assert.doesNotMatch(panel, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(panel, /\b(bg|border)-(white|gray|slate|zinc|neutral)\b/);
  assert.doesNotMatch(panel, /\btext-(white|black|gray|slate|zinc|neutral)\b/);
  assert.doesNotMatch(panel, /\blanguage\s*[!=]==/);
  assert.ok(panel.includes('data-bot-settings-reset'), 'has data-bot-settings-reset');
});

test('Sidebar keeps every data-* hook the existing sidebar group tests rely on', () => {
  const sidebar = srcWithDir(
    'prototype/components/Sidebar.tsx',
    'prototype/components/sidebar'
  );
  for (const hook of ['data-sidebar-group', 'data-sidebar-pinned', 'data-group-menu-trigger', 'data-sidebar-popover="group"', 'data-group-menu-delete', 'id="sidebar-new-group-btn"']) {
    assert.ok(sidebar.includes(hook), `kept ${hook}`);
  }
  // Popover still exposes exactly 5 menu items.
  assert.equal((sidebar.match(/role="menuitem"/g) ?? []).length, 5);
  // Legacy clutter the earlier driver asserts is gone must stay gone.
  for (const gone of ['sidebar-search-input', 'sidebar-create-menu-btn', 'sidebar-select-threads-btn']) {
    assert.ok(!sidebar.includes(gone), `${gone} must not return`);
  }
  // New left-bar surface.
  assert.ok(sidebar.includes('id="sidebar-new-bot-btn"'));
  assert.ok(sidebar.includes('id="sidebar-api-keys-btn"'));
  assert.ok(sidebar.includes('id="sidebar-settings-btn"'));
});

test('Header exposes the right-bar toggle only in the chat workspace', () => {
  const header = src('prototype/components/Header.tsx');
  assert.match(header, /useBotSettingsPanel\(\)/);
  assert.match(header, /showPanelToggle = isWorkspace && currentView === 'chat-room'/);
  assert.ok(header.includes('id="bot-settings-toggle"'));
  assert.match(header, /aria-pressed=\{panel\.visible\}/);
});

test('dashboard page mounts the panel for chat-room and lands on chat, not legacy lists', () => {
  const page = src('app/dashboard/page.tsx');
  assert.match(page, /<BotSettingsPanel \/>/);
  assert.match(page, /currentView === 'chat-room' && currentRoom/);
  assert.match(page, /pickLandingTarget\(/);
  assert.doesNotMatch(page, /setCurrentView\(bots\.length > 0 \? 'sessions' : 'bot-wizard'\)/);
});

test('i18n.ts defines all workspace keys in EN/VI parity and components avoid text-white contrast traps', async () => {
  const i18n = await import('../web/src/prototype/i18n.ts');
  assert.deepEqual(i18n.missingCopyKeys('en'), []);
  assert.deepEqual(i18n.missingCopyKeys('vi'), []);
  for (const key of Object.keys(i18n.copy.en)) {
    if (key.startsWith('ws')) {
      assert.equal(typeof i18n.copy.vi[key], 'string', `vi.${key} exists`);
      assert.ok(i18n.copy.vi[key].trim().length > 0, `vi.${key} non-empty`);
    }
  }

  for (const [label, content] of [
    ['BotSettingsPanel', srcWithDir('prototype/components/BotSettingsPanel.tsx', 'prototype/components/bot-settings')],
    ['Sidebar', srcWithDir('prototype/components/Sidebar.tsx', 'prototype/components/sidebar')],
    ['OverviewView.tsx', src('prototype/components/OverviewView.tsx')],
    ['Header.tsx', src('prototype/components/Header.tsx')],
  ]) {
    assert.doesNotMatch(content, /\btext-white\b/, `${label} must use semantic text-accent-ink instead of text-white`);
  }
  assert.doesNotMatch(
    srcWithDir('prototype/components/Sidebar.tsx', 'prototype/components/sidebar'),
    /\blanguage\s*[!=]==/
  );
});

test('globals.css defines --color-accent-ink in @theme and WCAG AA >= 4.5:1 tokens for light and dark', () => {
  const css = src('app/globals.css');
  assert.match(css, /--color-accent-ink:\s*var\(--color-accent-ink\);/);

  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf("[data-theme='dark'] {"));
  const darkBlock = css.slice(css.indexOf("[data-theme='dark'] {"));
  const pick = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

  assert.ok(ratio(pick(rootBlock, '--color-accent-ink'), pick(rootBlock, '--color-accent')) >= 4.5);
  assert.ok(ratio(pick(rootBlock, '--color-accent-ink'), pick(rootBlock, '--color-accent-rust')) >= 4.5);
  assert.ok(ratio(pick(rootBlock, '--color-ink-muted'), pick(rootBlock, '--color-background')) >= 4.5);
  assert.ok(ratio(pick(darkBlock, '--color-accent-ink'), pick(darkBlock, '--color-accent')) >= 4.5);
  assert.ok(ratio(pick(darkBlock, '--color-accent-ink'), pick(darkBlock, '--color-accent-rust')) >= 4.5);
  assert.ok(ratio(pick(darkBlock, '--color-ink-muted'), pick(darkBlock, '--color-surface')) >= 4.5);
});
