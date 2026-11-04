/**
 * Drives the Grok-style dashboard left-bar in real Chrome over CDP:
 * councils list visible, inline rename commits, delete needs a confirm
 * and then removes the row. Same CDP pattern as drive-persist.mjs.
 *
 * Usage: node tests/drive-dashboard.mjs <baseUrl> <outPng>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3232';
const OUT = process.argv[3] ?? 'council-dashboard.png';
const PORT = 9335;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-persist';

const trace = [];
const note = (step, detail) => {
  trace.push({ step, detail });
  console.log(`[${step}] ${detail}`);
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
    '--window-size=1440,1000',
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
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
ws.addEventListener('message', (event) => {
  const frame = JSON.parse(event.data);
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

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(() => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  return result.value;
}

const councilRows = () =>
  evaluate(`
    const aside = document.querySelector('aside');
    if (!aside) return { visible: false, count: 0, titles: [] };
    const ul = [...aside.querySelectorAll('ul')].at(-1);
    if (!ul) return { visible: true, count: 0, titles: [] };
    const titles = [...ul.querySelectorAll('li')].map((li) => li.querySelector('button')?.textContent.trim());
    return { visible: true, count: titles.length, titles };
  `);

const clickFirstByAria = (label) =>
  evaluate(`
    const button = document.querySelector('aside button[aria-label=${JSON.stringify(label)}]');
    if (!button) return 'MISSING ' + ${JSON.stringify(label)};
    button.click();
    return 'clicked';
  `);

const failures = [];
const check = (label, ok, detail) => {
  note(label, `${ok ? 'PASS' : 'FAIL'} — ${detail}`);
  if (!ok) failures.push(label);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: BASE });
  await sleep(3500);

  // Landing (overview) has no sidebar by design. Enter the workspace via the
  // header nav ("Sessions" lands on the sessions list, sidebar mounted).
  const nav = await evaluate(`
    const buttons = [...document.querySelectorAll('button, a')];
    const target = buttons.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === 'Sessions');
    if (!target) return 'MISSING Sessions';
    target.click();
    return 'clicked';
  `);
  check('entered workspace via header nav', nav === 'clicked', nav);
  await sleep(1500);

  const before = await councilRows();
  note('before', JSON.stringify(before));
  check('councils list is visible in the sidebar', before.visible === true && before.count > 0, `${before.count} rows`);

  // Rename: click pencil, type, commit with Enter.
  const renamed = await clickFirstByAria('Rename council');
  check('rename button present', renamed === 'clicked', renamed);
  await sleep(400);
  await evaluate(`
    const input = document.querySelector('aside input[aria-label="Rename council"]');
    if (!input) return 'MISSING input';
    const proto = window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, 'Dashboard Rename Check');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return 'committed';
  `);
  await sleep(600);
  const afterRename = await councilRows();
  note('after-rename', JSON.stringify(afterRename));
  check('rename shows the new title', afterRename.titles[0] === 'Dashboard Rename Check', afterRename.titles[0]);

  // Delete first row: trash -> confirm (checkmark, same aria-label) -> row gone.
  const confirmed = await clickFirstByAria('Delete council');
  check('delete button present', confirmed === 'clicked', confirmed);
  await sleep(400);
  const del = await clickFirstByAria('Delete council');
  check('delete confirm present', del === 'clicked', del);
  await sleep(600);
  const afterDelete = await councilRows();
  note('after-delete', JSON.stringify(afterDelete));
  check('row count decreased by one', afterDelete.count === afterRename.count - 1, `${afterRename.count} -> ${afterDelete.count}`);
  check('deleted title is gone', !afterDelete.titles.includes('Dashboard Rename Check'), afterDelete.titles.join(' | '));

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(data, 'base64'));
  note('screenshot', OUT);
} finally {
  writeFileSync(
    '.agent/evidence/council-dashboard.json',
    JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, trace, failures }, null, 2)
  );
  try {
    chrome.kill();
  } catch {}
}

if (failures.length) {
  console.log(`\nFAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nALL_CHECKS_PASS');
