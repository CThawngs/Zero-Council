/**
 * Drives the Integrations screen and then a room turn with a key entered, in real Chrome over CDP.
 *
 * The check that matters is the failure path. A made-up key must produce a visible, named failure in
 * the room — not a silent fall back to the scripted reply. A council that quietly swaps in fake
 * advice when a key is wrong is worse than one that says it is broken.
 *
 * Usage: node tests/drive-keys.mjs <baseUrl> <outPng>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3231';
const OUT = process.argv[3] ?? 'council-keys.png';
const PORT = 9334;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-keys';

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

/** Types into a controlled React input of either tag. The native setter is what makes React see it. */
const typeInto = (selector, value) => evaluate(`
  const input = document.querySelector(${JSON.stringify(selector)});
  if (!input) return 'MISSING ' + ${JSON.stringify(selector)};
  const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
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

  // Enter the room FIRST. Connecting the key later and reloading would wipe the very key under test,
  // because keys live in memory by design — so the order of these steps is the point of the test.
  await clickVisible('Start free council');
  await sleep(1800);
  await clickVisible('Open room');
  await sleep(1600);

  const joined = await evaluate(`
    const d = document.querySelector('dialog[open]');
    if (!d) return 'NO DIALOG: ' + [...document.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().width > 0).map((b) => JSON.stringify(b.textContent.trim())).join(' ');
    const button = [...d.querySelectorAll('button')].find((b) => ['Open room', 'Start council'].includes(b.textContent.trim()));
    if (!button) return 'MISSING confirm: ' + [...d.querySelectorAll('button')].map((b) => b.textContent.trim()).join('|');
    button.click();
    return 'joined';
  `);
  check('joined a room', joined === 'joined', joined);
  await sleep(1200);

  // In-app navigation only from here: a real page load clears the key.
  const opened = await clickVisible('Integrations');
  await sleep(1200);
  check('Integrations opens', opened === 'clicked', opened);

  const vendors = await evaluate(`
    const text = document.body.innerText;
    return ['Anthropic', 'OpenAI', 'Claude Sonnet 4.5', 'GPT-4o']
      .filter((name) => text.includes(name)).join(', ');
  `);
  check('real vendor names, not placeholders', vendors.split(', ').length === 4, vendors);
  check('no placeholder copy survives', !(await evaluate(`return document.body.innerText.includes('Provider A') || document.body.innerText.includes('Provider B');`)), 'scan for "Provider A/B"');

  // Connect Anthropic with a key that cannot possibly work.
  const connect = await clickVisible('Connect');
  await sleep(900);
  const dialogText = await evaluate(`
    const d = document.querySelector('dialog[open]');
    return d ? d.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) : 'NO DIALOG';
  `);
  check('connect dialog asks for a key', dialogText.includes('API key'), dialogText.slice(0, 120));

  const field = await evaluate(`
    const d = document.querySelector('dialog[open]');
    const input = d ? d.querySelector('input[type="password"]') : null;
    if (!input) return 'MISSING password field';
    return { has: true, autocomplete: input.getAttribute('autocomplete') };
  `);
  check('the key field is a password box', field?.has === true, JSON.stringify(field));
  check('the browser will not offer to save it', field?.autocomplete === 'off', `autocomplete=${field?.autocomplete}`);

  await typeInto('dialog[open] input[type="password"]', 'sk-ant-not-a-real-key');
  const confirmed = await evaluate(`
    const d = document.querySelector('dialog[open]');
    const button = [...d.querySelectorAll('button')].find((b) => ['Connect', 'Save'].includes(b.textContent.trim()));
    if (!button) return 'MISSING confirm: ' + [...d.querySelectorAll('button')].map((b) => b.textContent.trim()).join('|');
    button.click();
    return 'clicked';
  `);
  await sleep(1200);
  check('key accepted', confirmed === 'clicked', confirmed);

  const state = await evaluate(`
    const text = document.body.innerText;
    return { connected: text.includes('Connected'), leaked: text.includes('sk-ant-not-a-real-key') };
  `);
  check('provider reads as connected', state.connected === true, JSON.stringify(state));
  check('the key is not rendered back into the page', state.leaked === false, 'no raw key in the DOM');

  // Back to the room through the sidebar — no reload, so the key survives.
  await clickVisible('Council room');
  await sleep(1400);
  const back = await evaluate(`return Boolean(document.querySelector('#chat-composer'));`);
  check('returned to the room with the key still held', back === true, `composer present: ${back}`);

  const before = await evaluate(`return document.querySelector('[role="log"]')?.innerText.length ?? 0;`);
  await typeInto('#chat-composer', 'What should we ship first?');
  await evaluate(`
    const box = document.querySelector('#chat-composer');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return 'sent';
  `);
  await sleep(12000);

  const after = await evaluate(`
    const log = document.querySelector('[role="log"]');
    if (!log) return { text: 'NO LOG' };
    return { text: log.innerText.replace(/\\s+/g, ' ').trim().slice(-700), grew: log.innerText.length > ${before} };
  `);
  note('room-after-bad-key', JSON.stringify(after));
  check('the room says something happened', after.grew === true, 'transcript grew');

  // The scripted reply is the tell. If The Pragmatist still answers with "From my lens", the key was
  // never used and the room silently faked an advisor — the exact failure this check exists for.
  const faked = /From my lens|here is what I would hold/.test(after.text);
  check('the key was actually used, not silently bypassed', faked === false, faked ? 'scripted reply still appeared' : 'no scripted text');
  check('an unusable key is reported, not papered over', /stopped working|transient|fatal|error/i.test(after.text), after.text.slice(-260));

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(data, 'base64'));
  note('screenshot', OUT);
} finally {
  writeFileSync(
    '.agent/evidence/council-keys.json',
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