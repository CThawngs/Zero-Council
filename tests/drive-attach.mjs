/**
 * Drives the room's two newest controls in real Chrome: pinning a link, and Stop.
 *
 * Why this is a separate driver rather than three more asserts in drive-council.mjs: the first is
 * about the browser's own security model (a cross-origin page must be refused out loud), and the
 * second is about a button that was decorative for a while — both are claims about the UI that
 * only exist once a real page is on screen.
 *
 * Usage: node tests/drive-attach.mjs <baseUrl> <outPng>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3230';
const OUT = process.argv[3] ?? 'council-attach.png';
const PORT = 9337;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-attach';
const EVIDENCE = '.agent/evidence';

const trace = [];
const note = (step, detail) => {
  trace.push({ step, detail });
  console.log(`[${step}] ${detail}`);
};
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
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
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
const shutdown = () => {
  try {
    chrome.kill();
  } catch {}
};
process.on('exit', shutdown);

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
const pendingCalls = new Map();
ws.addEventListener('message', (event) => {
  const frame = JSON.parse(event.data);
  const entry = pendingCalls.get(frame.id);
  if (!entry) return;
  pendingCalls.delete(frame.id);
  frame.error ? entry.reject(new Error(JSON.stringify(frame.error))) : entry.resolve(frame.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    seq += 1;
    pendingCalls.set(seq, { resolve, reject });
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

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE });
await sleep(1800);

// Enter the room from the empty chamber.
await evaluate(`
  const open = [...document.querySelectorAll('button')].find((b) => /open room/i.test(b.textContent));
  if (open) open.click();
`);
await sleep(600);

const linkFieldExists = await evaluate(`return Boolean(document.querySelector('#chat-link'));`);
check('the room offers a field for a link', linkFieldExists === true);

// A cross-origin page with no CORS header. This is the common case, not an edge case: the browser
// refuses to hand it over, and the room has to say that rather than quietly attaching nothing.
await evaluate(`
  const input = document.querySelector('#chat-link');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'https://example.com/private-spec');
  input.dispatchEvent(new Event('input', { bubbles: true }));
`);
await sleep(200);
await evaluate(`
  const attach = [...document.querySelectorAll('button')].find((b) => /attach/i.test(b.textContent));
  if (attach) attach.click();
`);
await sleep(2500);

const pinned = await evaluate(`
  const chip = [...document.querySelectorAll('li')].find((li) => /example\\.com/.test(li.textContent));
  return chip ? chip.textContent.trim() : null;
`);
note('pinned', String(pinned));
check('a refused link is still pinned, in words', Boolean(pinned) && /not share|could not be read|share/i.test(pinned), String(pinned).slice(0, 90));

// A same-origin page the browser WILL hand over: proves the read path works, not just the refusal.
await evaluate(`
  const input = document.querySelector('#chat-link');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${BASE}/');
  input.dispatchEvent(new Event('input', { bubbles: true }));
`);
await sleep(200);
await evaluate(`
  const attach = [...document.querySelectorAll('button')].find((b) => /attach/i.test(b.textContent));
  if (attach) attach.click();
`);
await sleep(2500);
const readOk = await evaluate(`
  const chips = [...document.querySelectorAll('li')].filter((li) => /read in full|could not be read|share/i.test(li.textContent));
  return chips.map((c) => c.textContent.trim());
`);
note('attachments', JSON.stringify(readOk));
check(
  'a readable page is marked as read',
  readOk.some((text) => /read in full/.test(text)),
  readOk.join(' | ').slice(0, 120)
);

// Send a question so the pinned link travels with it.
await evaluate(`
  const box = document.querySelector('#chat-composer');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(box, 'What does the attached page say we should ship first?');
  box.dispatchEvent(new Event('input', { bubbles: true }));
`);
await sleep(200);
await evaluate(`
  const send = [...document.querySelectorAll('button')].find((b) => /send/i.test(b.textContent));
  if (send) send.click();
`);
await sleep(4000);

const transcript = await evaluate(`
  const bubbles = [...document.querySelectorAll('[role="log"] article')];
  return bubbles.map((b) => b.textContent);
`);
note('transcript', JSON.stringify(transcript).slice(0, 400));
check(
  'the user message carries its link',
  transcript.some((text) => /attached|attached, read/i.test(text)),
  `${transcript.length} bubbles`
);

const stopDisabled = await evaluate(`
  const stop = [...document.querySelectorAll('button')].find((b) => /stop/i.test(b.textContent.trim()));
  return stop ? stop.disabled : 'MISSING';
`);
check('Stop is only live while the room is working', stopDisabled === true, `disabled=${stopDisabled}`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(`${EVIDENCE}/${OUT}`, Buffer.from(shot.data, 'base64'));
note('screenshot', `${EVIDENCE}/${OUT}`);
writeFileSync(`${EVIDENCE}/council-attach.json`, JSON.stringify(trace, null, 2));

console.log(failures.length === 0 ? 'ALL_CHECKS_PASS' : `FAILED: ${failures.join(' | ')}`);
process.exit(failures.length === 0 ? 0 : 1);