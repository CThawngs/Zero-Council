/**
 * Drives a real reload in the middle of a deliberation, in real Chrome over CDP.
 *
 * Two claims get checked here, and the second matters more than the first:
 *   1. the transcript survives a page reload
 *   2. clearing the room actually clears it, and does not quietly come back
 *
 * (2) is the one a naive implementation gets wrong. If clearing only resets React state, the stored
 * blob is still there and the "deleted" room reappears on the next refresh — which looks exactly
 * like the button not working.
 *
 * Usage: node tests/drive-persist.mjs <baseUrl> <outPng>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3232';
const OUT = process.argv[3] ?? 'council-persist.png';
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

const clickVisible = (label) => evaluate(`
  const buttons = [...document.querySelectorAll('button, a')];
  const button = buttons.find((b) => {
    if (b.textContent.replace(/\\s+/g, ' ').trim() !== ${JSON.stringify(label)}) return false;
    const box = b.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  if (!button) return 'MISSING: ' + buttons.filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => JSON.stringify(b.textContent.trim())).join(' ');
  button.click();
  return 'clicked';
`);

const typeInto = (selector, value) => evaluate(`
  const input = document.querySelector(${JSON.stringify(selector)});
  if (!input) return 'MISSING ' + ${JSON.stringify(selector)};
  const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
`);

const transcript = () =>
  evaluate(`
    const log = document.querySelector('[role="log"]');
    if (!log) return { present: false, text: '', turns: 0 };
    const text = log.innerText.replace(/\\s+/g, ' ').trim();
    return { present: true, text, turns: (text.match(/Claude Sonnet|GPT-4o/g) || []).length };
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

  await clickVisible('Start free council');
  await sleep(1800);
  await clickVisible('Open room');
  await sleep(1600);
  await evaluate(`
    const d = document.querySelector('dialog[open]');
    const button = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open room');
    button.click();
    return 'joined';
  `);
  await sleep(1400);

  await typeInto('#chat-composer', 'Should we ship the billing flow first?');
  await evaluate(`
    const box = document.querySelector('#chat-composer');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return 'sent';
  `);
  await sleep(7000);

  const before = await transcript();
  check('a room is in session', before.present === true && before.turns > 0, `${before.turns} advisor turns`);
  note('before-reload', JSON.stringify(before).slice(0, 400));

  const stored = await evaluate(`
    const raw = sessionStorage.getItem('zero-council:room');
    if (!raw) return { written: false };
    const parsed = JSON.parse(raw);
    return { written: true, schema: parsed.schema, messages: parsed.messages.length, roster: parsed.roster.length };
  `);
  check('the room is written to the tab store', stored.written === true, JSON.stringify(stored));

  // The real test. IgnoreCache also forces a fresh document, so nothing survives in memory.
  await send('Page.reload', { ignoreCache: true });
  await sleep(4500);

  const after = await transcript();
  note('after-reload', JSON.stringify(after).slice(0, 400));
  check('the room comes back after a reload', after.present === true, `present: ${after.present}`);
  check('every advisor turn is still there', after.turns === before.turns, `${after.turns} vs ${before.turns} before`);
  check('the transcript is byte-identical', after.text === before.text, after.text === before.text ? 'exact match' : 'content differs');

  // Clearing must clear the store, not just the view.
  const cleared = await clickVisible('Clear');
  await sleep(1400);
  check('clear button works', cleared === 'clicked', cleared);
  const goneNow = await evaluate(`
    return { stored: sessionStorage.getItem('zero-council:room'), room: Boolean(document.querySelector('#chat-composer')) };
  `);
  check('clearing removes the stored room too', goneNow.stored === null, `stored = ${goneNow.stored}`);

  await send('Page.reload', { ignoreCache: true });
  await sleep(4500);
  const goneAfter = await transcript();
  check('a cleared room does not come back on reload', goneAfter.present === false, `present: ${goneAfter.present}`);

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(data, 'base64'));
  note('screenshot', OUT);
} finally {
  writeFileSync(
    '.agent/evidence/council-persist.json',
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