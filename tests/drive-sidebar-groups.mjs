/**
 * Drives the restored original Sidebar + '...' group action menu in real Chrome over CDP:
 * - Original top button '#sidebar-new-group-btn', 'MY BOTS' / 'BOT CỦA TÔI', 'GROUP CHATS' / 'NHÓM CHAT AI',
 *   privacy badge, and settings button
 * - Group row '...' trigger opens floating popover with exact 5 actions:
 *   Rename, Edit members, Pin/Unpin, Export JSON, Delete (2-step confirm)
 * - Pin reorders pinned group to top and persists across reload
 * - Inline rename commits cleanly
 * - Delete requires 2 clicks (Confirm delete) before removing the group
 * - Responsive check (desktop 1440x960 & mobile 375x812) + zero console exceptions
 *
 * Usage: node tests/drive-sidebar-groups.mjs <baseUrl>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3236';
const PORT = 9346;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(os.tmpdir(), `zc-chrome-sidebar-restored-${Date.now()}`);

const trace = [];
const failures = [];
const note = (step, detail) => {
  trace.push({ step, detail });
  console.log(`[${step}] ${detail}`);
};
const check = (label, ok, detail) => {
  note(label, `${ok ? 'PASS' : 'FAIL'} — ${detail}`);
  if (!ok) failures.push(label);
};

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,960',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
process.on('exit', () => {
  try {
    chrome.kill();
  } catch {}
});

async function cdpTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

const ws = new WebSocket(await cdpTarget());
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let seq = 0;
const pending = new Map();
const consoleErrors = [];
ws.addEventListener('message', (event) => {
  const frame = JSON.parse(event.data);
  if (frame.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(frame.params?.exceptionDetails?.text ?? 'exception');
  }
  const entry = pending.get(frame.id);
  if (!entry) return;
  pending.delete(frame.id);
  frame.error ? entry.reject(new Error(JSON.stringify(frame.error))) : entry.resolve(frame.result);
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    seq += 1;
    pending.set(seq, { resolve, reject });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });

async function evaluate(body) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(async () => { ${body} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  }
  return result?.value;
}

async function screenshot(filename) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join('.agent', 'evidence', filename);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(data, 'base64'));
  note('screenshot', outPath);
}

const createdBotIds = [];
const createdGroupIds = [];
let seededProvider = false;

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `${BASE}/dashboard` });
  await sleep(3000);

  // Switch to dark theme + Vietnamese so screenshot matches user's reference directly
  await evaluate(`
    localStorage.setItem('zc-theme', 'dark');
    document.documentElement.dataset.theme = 'dark';
    localStorage.setItem('zc-analytics-consent', 'necessary');
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('zc:sidebar-org:v1:')) localStorage.removeItem(k);
    }
  `);

  // Seed provider, 2 bots, and 2 group chats via real API
  const seed = await evaluate(`
    const meRes = await fetch('/api/me');
    const me = meRes.ok ? await meRes.json() : null;

    const provRes = await fetch('/api/providers');
    const provBody = provRes.ok ? await provRes.json() : { providers: [] };
    let seededProvider = false;
    if (!(provBody.providers ?? []).some((p) => p.provider === 'openai')) {
      const pPost = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          key: 'sk-test-sidebar-verify-000000000000000000',
          model: 'gpt-4o-mini',
          models: ['gpt-4o-mini'],
        }),
      });
      seededProvider = pPost.ok;
    }

    const botsRes = await fetch('/api/bots');
    const botsBody = botsRes.ok ? await botsRes.json() : { bots: [] };
    const existingBots = botsBody.bots ?? [];
    const createdBots = [];
    const need = Math.max(0, 2 - existingBots.length);
    for (let i = 0; i < need; i++) {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: i === 0 ? 'Atlas' : 'Vanguard',
          instruction: 'Concise advisor.',
          provider: 'openai',
          model: 'gpt-4o-mini',
        }),
      });
      if (res.ok) {
        const b = await res.json();
        if (b.bot?.id) createdBots.push(b.bot.id);
      }
    }

    const allBotIds = [...existingBots.map((b) => b.id), ...createdBots].slice(0, 2);
    const roster = allBotIds.map((id) => 'bot:' + id);
    const createdGroups = [];
    for (const title of ['Nhóm chiến lược Alpha', 'Nhóm kỹ thuật Beta']) {
      const gRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'group', title, mode: 'round-robin', roster, messages: [] }),
      });
      if (gRes.ok) {
        const g = await gRes.json();
        if (g.conversation?.id) createdGroups.push(g.conversation.id);
      }
    }
    return { email: me?.email ?? null, seededProvider, createdBots, createdGroups };
  `);

  seededProvider = Boolean(seed.seededProvider);
  createdBotIds.push(...(seed.createdBots ?? []));
  createdGroupIds.push(...(seed.createdGroups ?? []));
  check(
    'auth-and-seed',
    Boolean(seed.email) && createdGroupIds.length === 2,
    `user=${seed.email}, groups=${createdGroupIds.length}`
  );

  // Switch language to VI via real cookie/API or header toggle and reload
  await evaluate(`await fetch('/api/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'vi' }) });`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(3000);

  // 1. Verify original sidebar layout is back (primary button, no search/dept/select-threads)
  const layoutCheck = await evaluate(`
    const newGroupBtn = document.querySelector('#sidebar-new-group-btn');
    const hasSearch = Boolean(document.querySelector('#sidebar-search-input'));
    const hasCreateMenu = Boolean(document.querySelector('#sidebar-create-menu-btn'));
    const hasSelectThreads = Boolean(document.querySelector('#sidebar-select-threads-btn'));
    return {
      newGroupText: newGroupBtn?.textContent?.trim() ?? '',
      hasSearch,
      hasCreateMenu,
      hasSelectThreads,
    };
  `);
  check(
    'original-layout-restored',
    layoutCheck.newGroupText.length > 0 &&
      !layoutCheck.hasSearch &&
      !layoutCheck.hasCreateMenu &&
      !layoutCheck.hasSelectThreads,
    JSON.stringify(layoutCheck)
  );

  // 2. Open '...' popover menu on the second group chat and verify exact 5 items
  const secondGroupId = createdGroupIds[1];
  await evaluate(`document.querySelector('[data-group-menu-trigger=${JSON.stringify(secondGroupId)}]')?.click();`);
  await sleep(300);
  const menuItems = await evaluate(`
    const pop = document.querySelector('[data-sidebar-popover="group"]');
    if (!pop) return [];
    return [...pop.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent.replace(/\\s+/g, ' ').trim());
  `);
  check('ellipsis-menu-5-items', menuItems.length === 5, `items=${JSON.stringify(menuItems)}`);
  await screenshot('sidebar-group-menu.png');

  // 3. Pin the second group -> moves to top of list & persists across reload
  await evaluate(`
    const pop = document.querySelector('[data-sidebar-popover="group"]');
    const pinBtn = [...pop.querySelectorAll('[role="menuitem"]')][2];
    pinBtn?.click();
  `);
  await sleep(300);
  const firstIdAfterPin = await evaluate(`
    return document.querySelector('[data-sidebar-group]')?.getAttribute('data-sidebar-group') ?? null;
  `);
  check('pin-moves-to-top', firstIdAfterPin === secondGroupId, `first=${firstIdAfterPin}, expected=${secondGroupId}`);

  await send('Page.reload', { ignoreCache: true });
  await sleep(2800);
  const firstIdAfterReload = await evaluate(`
    const el = document.querySelector('[data-sidebar-group]');
    return { id: el?.getAttribute('data-sidebar-group') ?? null, pinned: el?.getAttribute('data-sidebar-pinned') };
  `);
  check(
    'pin-persists-after-reload',
    firstIdAfterReload.id === secondGroupId && firstIdAfterReload.pinned === 'true',
    JSON.stringify(firstIdAfterReload)
  );

  // 4. Inline rename via '...' menu -> first item
  await evaluate(`document.querySelector('[data-group-menu-trigger=${JSON.stringify(secondGroupId)}]')?.click();`);
  await sleep(250);
  await evaluate(`
    const pop = document.querySelector('[data-sidebar-popover="group"]');
    [...pop.querySelectorAll('[role="menuitem"]')][0]?.click();
  `);
  await sleep(250);
  await evaluate(`
    const input = document.querySelector('[data-sidebar-group=${JSON.stringify(secondGroupId)}] input');
    if (input) {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Nhóm đã đổi tên');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  `);
  await sleep(700);
  const renamedText = await evaluate(`
    return document.querySelector('[data-sidebar-group=${JSON.stringify(secondGroupId)}]')?.textContent ?? '';
  `);
  check('inline-rename-commits', renamedText.includes('Nhóm đã đổi tên'), `text="${renamedText.trim()}"`);

  // 5. 2-step delete inside '...' menu
  await evaluate(`document.querySelector('[data-group-menu-trigger=${JSON.stringify(secondGroupId)}]')?.click();`);
  await sleep(250);
  await evaluate(`document.querySelector('[data-group-menu-delete=${JSON.stringify(secondGroupId)}]')?.click();`);
  await sleep(250);
  const stillPresentAfterFirst = await evaluate(`
    return Boolean(document.querySelector('[data-sidebar-group=${JSON.stringify(secondGroupId)}]'));
  `);
  check('delete-needs-confirm', stillPresentAfterFirst, `stillPresent=${stillPresentAfterFirst}`);

  await evaluate(`document.querySelector('[data-group-menu-delete=${JSON.stringify(secondGroupId)}]')?.click();`);
  await sleep(800);
  const goneAfterSecond = await evaluate(`
    return !document.querySelector('[data-sidebar-group=${JSON.stringify(secondGroupId)}]');
  `);
  check('delete-confirmed-removes-row', goneAfterSecond, `removed=${goneAfterSecond}`);

  // 6. Responsive check + zero console exceptions
  const desktopOk = await evaluate(`return document.documentElement.scrollWidth <= window.innerWidth;`);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(400);
  const mobileOk = await evaluate(`return document.documentElement.scrollWidth <= window.innerWidth;`);
  check('responsive-no-overflow', desktopOk && mobileOk, `desktop=${desktopOk}, mobile=${mobileOk}`);
  check('no-console-exceptions', consoleErrors.length === 0, `errors=${JSON.stringify(consoleErrors)}`);

  // Cleanup all seeded data
  await evaluate(`
    for (const id of ${JSON.stringify(createdGroupIds)}) {
      await fetch('/api/conversations?id=' + encodeURIComponent(id), { method: 'DELETE' });
    }
    for (const id of ${JSON.stringify(createdBotIds)}) {
      await fetch('/api/bots?id=' + encodeURIComponent(id), { method: 'DELETE' });
    }
    if (${JSON.stringify(seededProvider)}) {
      await fetch('/api/providers/openai', { method: 'DELETE' });
    }
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('zc:sidebar-org:v1:')) localStorage.removeItem(k);
    }
  `);
} finally {
  writeFileSync(
    path.join('.agent', 'evidence', 'sidebar-groups-drive.json'),
    JSON.stringify({ ok: failures.length === 0, failures, trace }, null, 2)
  );
  ws.close();
  try {
    chrome.kill();
  } catch {}
}

if (failures.length > 0) {
  console.error('FAILED CHECKS:', failures);
  process.exit(1);
}
console.log('ALL_CHECKS_PASS');
