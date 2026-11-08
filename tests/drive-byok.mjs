/**
 * Drives the BYOK integrations view in real Chrome over CDP:
 * view renders, connect modal opens, failed test shows honest error, save never enabled.
 *
 * Usage: node tests/drive-byok.mjs <baseUrl> <outPng>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3236';
const OUT = process.argv[3] ?? '.agent/evidence/byok.png';
const PORT = 9336;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-byok';

const trace = [];
const note = (step, detail) => {
  trace.push({ step, detail });
  console.log(`[${step}] ${detail}`);
};

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1440,1000',
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => {
  try { chrome.kill(); } catch {}
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

const failures = [];
const check = (label, ok, detail) => {
  note(label, `${ok ? 'PASS' : 'FAIL'} — ${detail}`);
  if (!ok) failures.push(label);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: BASE });
  await sleep(4000);

  // Enter workspace: signed-in dev user lands on empty-chamber once per sign-in; use header "Sessions" then "Integrations".
  const nav = await evaluate(`
    const buttons = [...document.querySelectorAll('button, a')];
    const target = buttons.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === 'Sessions')
      ?? buttons.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === 'Integrations');
    if (!target) return 'MISSING nav: ' + [...document.querySelectorAll('button, a')].slice(0, 20).map((b) => b.textContent.trim()).join('|');
    target.click();
    return 'clicked';
  `);
  check('entered workspace', nav === 'clicked', nav);
  await sleep(1500);

  const integ = await evaluate(`
    const buttons = [...document.querySelectorAll('button, a')];
    const target = buttons.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === 'Integrations');
    if (!target) return 'MISSING Integrations';
    target.click();
    return 'clicked';
  `);
  check('integrations nav present', integ === 'clicked', integ);
  await sleep(1500);

  const heading = await evaluate(`
    const h1 = document.querySelector('h1');
    return h1 ? h1.textContent.trim() : null;
  `);
  note('heading', String(heading));
  check('BYOK heading renders', heading === 'Bring your own key', heading);

  const rows = await evaluate(`
    const arts = [...document.querySelectorAll('article')];
    return arts.map((a) => a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120));
  `);
  note('provider rows', JSON.stringify(rows));
  check('two provider rows', rows.length === 2, rows.join(' | '));

  // Open Anthropic connect modal.
  const connect = await evaluate(`
    const button = [...document.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label')?.startsWith('Connect:') && b.textContent.includes('Connect')
    );
    if (!button) return 'MISSING connect';
    button.click();
    return 'clicked';
  `);
  check('connect button present', connect === 'clicked', connect);
  await sleep(600);

  // Type a fake key and test -> provider rejects (401) -> honest error, no save enabled.
  await evaluate(`
    const input = document.querySelector('input[type=\"password\"]');
    if (!input) return 'MISSING input';
    const proto = window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, 'sk-ant-fake-key-for-check');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  `);
  await sleep(300);
  const testClicked = await evaluate(`
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Test connection');
    if (!button) return 'MISSING test button';
    if (button.disabled) return 'DISABLED test button';
    button.click();
    return 'clicked';
  `);
  check('test connection button enabled', testClicked === 'clicked', testClicked);
  await sleep(8000);

  const alertText = await evaluate(`
    const alert = document.querySelector('[role=\"alert\"]');
    return alert ? alert.textContent.trim() : null;
  `);
  note('error alert', String(alertText));
  check('invalid key error shown', (alertText ?? '').includes('rejected'), alertText);

  const savePresent = await evaluate(`
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save');
    return button ? 'present' : 'absent';
  `);
  check('no save before successful test', savePresent === 'absent', savePresent);

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(data, 'base64'));
  note('screenshot', OUT);
} finally {
  writeFileSync(
    '.agent/evidence/byok.json',
    JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, trace, failures }, null, 2)
  );
  try { chrome.kill(); } catch {}
}

if (failures.length) {
  console.log(`FAILURES: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('ALL_CHECKS_PASS');
