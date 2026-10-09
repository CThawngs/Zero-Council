/**
 * Drives the council room in real Chrome over CDP, using only Node built-ins.
 *
 * Why hand-rolled: `agent-browser` is not installed and installing a global CLI is a machine-level
 * change nobody asked for. Node 22+ ships `WebSocket` and `fetch`, and Chrome is already on disk, so
 * the whole loop needs zero new dependencies.
 *
 * Usage: node tests/drive-council.mjs <baseUrl> <outPng>
 * Writes a screenshot and prints a JSON trace of what it saw. Exits non-zero on a failed check.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3230';
const OUT = process.argv[3] ?? 'council-room.png';
const PORT = 9333;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-profile';

const trace = [];
const note = (step, detail) => {
  trace.push({ step, detail });
  console.log(`[${step}] ${detail}`);
};

// A fresh profile every run: no inherited cookies, no "restore pages" dialog, no shared state.
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

const wsUrl = await cdpTarget();
const ws = new WebSocket(wsUrl);
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

/** Evaluates an expression in the page and returns its JSON value. Rejections surface as errors. */
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(() => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  return result.value;
}

const CLICK_BUTTON = `
  const wanted = %TEXT%;
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(wanted));
  if (!button) return 'MISSING: ' + [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).join(' | ');
  if (button.disabled) return 'DISABLED: ' + wanted;
  button.click();
  return 'clicked: ' + wanted;
`;

const click = (text) => evaluate(CLICK_BUTTON.replace('%TEXT%', JSON.stringify(text)));

/** Types into a controlled React input: native setter first, so React actually sees the event. */
const typeInto = (selector, value) => evaluate(`
  const input = document.querySelector(${JSON.stringify(selector)});
  if (!input) return 'MISSING ' + ${JSON.stringify(selector)};
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
`);

const submit = () => evaluate(`
  const box = document.querySelector('#chat-composer');
  if (!box) return 'MISSING composer';
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  return 'submitted';
`);

const bubbles = () =>
  evaluate(`
    const log = document.querySelector('[role="log"]');
    if (!log) return { error: 'no chat log on screen' };
    return [...log.querySelectorAll('[data-testid="bubble"], li, div')].map((n) => n.textContent.trim()).filter(Boolean);
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

  const landed = await evaluate('return document.title + " :: " + location.pathname');
  note('navigate', landed);

  /** Clicks a visible button by exact label. Hidden buttons inside a closed <dialog> are skipped. */
const clickVisible = (label) => evaluate(`
  const buttons = [...document.querySelectorAll('button')];
  const button = buttons.find((b) => {
    if (b.textContent.replace(/\\s+/g, ' ').trim() !== ${JSON.stringify(label)}) return false;
    const box = b.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  if (!button) return 'MISSING: ' + buttons.filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => JSON.stringify(b.textContent.trim())).join(' ');
  if (button.disabled) return 'DISABLED';
  button.click();
  return 'clicked';
`);

  // `/` is the marketing landing, not the workspace. Enter the app before touching the room.
  const entered = await clickVisible('Start free council');
  await sleep(1800);
  note('enter', entered);
  check('reached the workspace', entered === 'clicked', entered);

  const joined = await clickVisible('Open room');
  await sleep(1200);
  note('open', `room entry: ${joined}`);

  const dialogOpen = await evaluate(`
    const d = document.querySelector('dialog[open]');
    return d ? d.textContent.replace(/\\s+/g, ' ').trim().slice(0, 300) : 'NO DIALOG';
  `);
  note('modal', dialogOpen);
  check('join modal appears', dialogOpen !== 'NO DIALOG', dialogOpen.slice(0, 90));

  const started = await evaluate(`
    const d = document.querySelector('dialog[open]');
    if (!d) return 'NO DIALOG';
    const button = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open room');
    if (!button) return 'MISSING confirm';
    if (button.disabled) return 'DISABLED';
    button.click();
    return 'clicked';
  `);
  await sleep(1200);
  note('join', started);
  check('room opened', started === 'clicked', started);

  const emptyRoom = await evaluate(`
    const log = document.querySelector('[role="log"]');
    return log ? 'log present' : 'NO LOG';
  `);
  check('chat log present', emptyRoom === 'log present', emptyRoom);

  const typed = await typeInto('#chat-composer', 'Should we ship the council engine before billing?');
  note('type', typed);
  const sent = await submit();
  note('submit', sent);
  await sleep(2500);

  const text = await evaluate(`
    const log = document.querySelector('[role="log"]');
    return log ? log.innerText : 'NO LOG';
  `);
  note('transcript', text.replace(/\\s+/g, ' ').slice(0, 700));

  // Advisors quote the question back, so counting occurrences of the raw string proves nothing.
  // The duplication bug lived in the transcript structure, so count the user ROW, not the text.
  const rows = await evaluate(`
    const log = document.querySelector('[role="log"]');
    const nodes = [...log.children];
    return nodes.map((n) => n.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40));
  `);
  note('rows', JSON.stringify(rows));

  // The Free plan seats two advisors, so the room is capped — name someone who is actually in it.
  const seated = 'The Dreamer';
  const spare = 'The Pragmatist';

  // --- Round two: a named advisor takes the floor instead of the rotation. ---
  const mark = await evaluate(`return document.querySelector('[role="log"]').innerText.length;`);
  await typeInto('#chat-composer', `@${seated} what do you object to?`);
  await submit();
  await sleep(2500);

  const round2 = await evaluate(`return document.querySelector('[role="log"]').innerText;`);
  // Slice by LENGTH, never by searching for the prompt: every advisor echoes the question, so a
  // text search lands mid-sentence and hides the very reply under test.
  const fresh = round2.slice(mark);
  note('round2', fresh.replace(/\s+/g, ' ').slice(0, 400));
  check(
    'a named advisor opens its turn',
    fresh.toUpperCase().indexOf('THE DREAMER') >= 0 && fresh.toUpperCase().indexOf('THE PRAGMATIST') < 0,
    'dreamer led, pragmatist did not'
  );

  const userRowCount = await evaluate(`
    return [...document.querySelector('[role="log"]').children]
      .filter((n) => n.innerText.trim().startsWith('YOU')).length;
  `);
  check('exactly two user rows after two messages', userRowCount === 2, `saw ${userRowCount}`);

  // Assert on ROWS, not on raw text: the user's own line repeats the advisor's name, so a text search
  // would "find" them in the message that silenced them.
  const advisorRowsAfter = (from) =>
    evaluate(`
      const log = document.querySelector('[role="log"]');
      const rows = [...log.children].map((n) => n.innerText.replace(/\\s+/g, ' ').trim());
      const marker = rows.findIndex((r) => r.startsWith('YOU') && r.includes(${JSON.stringify(from)}));
      if (marker < 0) return { error: 'row not found', rows };
      return rows.slice(marker + 1).filter((r) => !r.startsWith('YOU')).map((r) => r.slice(0, 30));
    `);

  // --- Hold: `stop @X` is a command, not a question, so it must not produce a round at all. ---
  await typeInto('#chat-composer', `stop @${spare}`);
  await submit();
  await sleep(2000);
  const heldRows = await advisorRowsAfter(`stop @${spare}`);
  note('stop', JSON.stringify(heldRows));
  check(
    'a stop directive produces no advisor turn',
    Array.isArray(heldRows) && heldRows.length === 0,
    'no advisor spoke after the stop'
  );

  const whole = await evaluate(`return document.querySelector('[role="log"]').innerText;`);
  check(
    'a stop directive is not reported as "nobody answered"',
    !/No advisor answered/i.test(whole),
    'a control message is not a failed round'
  );

  // --- Release: `@all` must call the held advisor back AND let them answer. ---
  const beforeResume = await evaluate(`return document.querySelector('[role="log"]').innerText.length;`);
  await typeInto('#chat-composer', '@all carry on');
  await submit();
  await sleep(2500);
  const resumed = (await evaluate(`return document.querySelector('[role="log"]').innerText;`)).slice(beforeResume);
  note('resume', resumed.replace(/\s+/g, ' ').slice(0, 300));
  check(
    '@all brings the held advisor back',
    resumed.toUpperCase().indexOf('THE PRAGMATIST') >= 0,
    'pragmatist returned and answered'
  );

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  mkdirSync('C:\\Users\\nguye\\OneDrive\\Documents\\Projects\\Zero-Council\\.agent\\evidence', { recursive: true });
  const outPath = `C:\\Users\\nguye\\OneDrive\\Documents\\Projects\\Zero-Council\\.agent\\evidence\\${OUT}`;
  writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  note('screenshot', outPath);

  writeFileSync(
    'C:\\Users\\nguye\\OneDrive\\Documents\\Projects\\Zero-Council\\.agent\\evidence\\council-drive.json',
    JSON.stringify({ at: new Date().toISOString(), base: BASE, trace, failures }, null, 2)
  );
  console.log(failures.length ? `FAILED_CHECKS: ${failures.join(', ')}` : 'ALL_CHECKS_PASS');
} catch (error) {
  note('crash', error.message);
  process.exitCode = 1;
} finally {
  ws.close();
  shutdown();
}