/**
 * drive-keys-verify-gate.mjs — E2E proof that "Save" is bound to a successful Test of the EXACT
 * (API key, Base URL) pair currently in the form, for built-in and custom providers.
 *
 * The app server's verdict (`POST /api/providers/verify`) and the save route (`POST /api/providers`)
 * are mocked in-page so every scenario is deterministic and no real provider key is needed.
 * Direct provider hosts are blocked, so a silent client-side fallback can never produce a pass.
 *
 * Built-in provider (Anthropic):
 *   B1 wrong key            → Test fails, alert shown, Save hidden, Test button stays
 *   B2 correct key          → Save appears, Test button gone, success status shown
 *   B3 edit key after pass  → Save hidden again, Test button back
 *   B4 stale in-flight pass → key edited while the probe runs → late success is ignored
 *   B5 save rejected (503)  → typed error shown, Save stays available for retry
 *   B6 save accepted        → provider ends up connected
 * Custom OpenAI-compatible provider:
 *   C1 wrong key            → Test fails, Save hidden
 *   C2 wrong Base URL       → Test fails, Save hidden
 *   C3 correct pair         → Save appears
 *   C4 edit Base URL        → Save hidden, Test button back
 *   C5 edit key             → Save hidden, Test button back
 *   C6 bare origin          → server-resolved `/v1` URL is shown to the user before saving
 *
 * Usage: node tests/drive-keys-verify-gate.mjs <baseUrl> <outPng>
 * Zero new dependencies — Node 22+ built-in WebSocket + fetch only.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3231';
const OUT = process.argv[3] ?? '.agent/evidence/drive-keys-verify-gate.png';
const PORT = 9335;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-gate-' + Date.now();

const BUILTIN_GOOD_KEY = 'sk-ant-GATE_GOOD_KEY_000111';
const BUILTIN_WRONG_KEY = 'sk-ant-GATE_WRONG_KEY_000222';
const BUILTIN_SLOW_KEY = 'sk-ant-GATE_SLOW_GOOD_KEY_000333';
const CUSTOM_GOOD_KEY = 'sk-GATE_CUSTOM_GOOD_KEY_000444';
const CUSTOM_WRONG_KEY = 'sk-GATE_CUSTOM_WRONG_KEY_000555';
const CUSTOM_ORIGIN = 'https://llm.gate-test.example';
const CUSTOM_GOOD_URL = `${CUSTOM_ORIGIN}/v1`;
const CUSTOM_WRONG_URL = 'https://wrong.gate-test.example/v1';

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

// ── Chrome ──────────────────────────────────────────────────────────────────
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
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

const socket = new WebSocket(await cdpTarget());
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const frame = JSON.parse(event.data);
  const entry = pending.get(frame.id);
  if (!entry) return;
  pending.delete(frame.id);
  if (frame.error) entry.reject(new Error(JSON.stringify(frame.error)));
  else entry.resolve(frame.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    sequence++;
    pending.set(sequence, { resolve, reject });
    socket.send(JSON.stringify({ id: sequence, method, params }));
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

/** Polls a boolean page expression until it is true or the timeout elapses. */
async function waitFor(expression, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`return Boolean(${expression});`)) return true;
    await sleep(150);
  }
  return false;
}

const isVisible = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
})()`;

const visibleAlertText = `(() => {
  const el = [...document.querySelectorAll('[role="alert"]')].find(a => a.getBoundingClientRect().width > 0);
  return el ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
})()`;

const clickVisible = (label) =>
  evaluate(`
  const els = [...document.querySelectorAll('button, a')];
  const el = els.find(b => {
    if (b.textContent.replace(/\\s+/g,' ').trim() !== ${JSON.stringify(label)}) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!el) return 'MISSING';
  if (el.disabled) return 'DISABLED';
  el.click(); return 'clicked';
`);

const clickSelector = (selector) =>
  evaluate(`
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return 'MISSING';
  if (el.disabled) return 'DISABLED';
  el.click(); return 'clicked';
`);

const typeInto = (selector, value) =>
  evaluate(`
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return 'MISSING';
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
`);

const closeModal = () =>
  evaluate(`
  const btn = [...document.querySelectorAll('button')].find(b => {
    const r = b.getBoundingClientRect();
    const label = b.textContent.trim();
    return r.width > 0 && r.height > 0 && (label === 'Cancel' || label === 'Close');
  });
  if (!btn) return 'NOT FOUND';
  btn.click(); return 'closed';
`);

/** Installs deterministic mocks for the verify + save routes and blocks direct provider hosts. */
const installMocks = () =>
  evaluate(`
  if (window.__gateOriginalFetch) return 'already installed';
  window.__gateOriginalFetch = window.fetch;
  window.__gateVerifyCalls = [];
  window.__gateSaveCalls = [];
  window.__gateSaveMode = 'reject';
  const json = (body, status) => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
  const trimSlash = (value) => String(value ?? '').replace(/\\/+$/, '');
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input));
    const method = String(init?.method ?? 'GET').toUpperCase();
    if (url.includes('/api/providers/verify')) {
      const body = JSON.parse(init?.body ?? '{}');
      window.__gateVerifyCalls.push({ provider: body.provider, key: body.key, baseUrl: body.baseUrl ?? null });
      if (body.provider === 'anthropic') {
        if (body.key === ${JSON.stringify(BUILTIN_SLOW_KEY)}) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          return json({ ok: true, models: ['claude-haiku-4-5'], verifiedModel: 'claude-haiku-4-5' }, 200);
        }
        if (body.key === ${JSON.stringify(BUILTIN_GOOD_KEY)}) {
          return json({ ok: true, models: ['claude-haiku-4-5'], verifiedModel: 'claude-haiku-4-5' }, 200);
        }
        return json({ ok: false, error: 'INVALID_KEY' }, 401);
      }
      const baseUrl = trimSlash(body.baseUrl);
      if (body.key !== ${JSON.stringify(CUSTOM_GOOD_KEY)}) return json({ ok: false, error: 'INVALID_KEY' }, 401);
      if (baseUrl === ${JSON.stringify(CUSTOM_ORIGIN)}) {
        return json({ ok: true, models: ['gate-model'], verifiedModel: 'gate-model',
          resolvedBaseUrl: ${JSON.stringify(CUSTOM_GOOD_URL)} }, 200);
      }
      if (baseUrl === ${JSON.stringify(CUSTOM_GOOD_URL)}) {
        return json({ ok: true, models: ['gate-model'], verifiedModel: 'gate-model' }, 200);
      }
      return json({ ok: false, error: 'INVALID_BASE_URL' }, 400);
    }
    if (url.includes('/api/providers') && method === 'POST' && !url.includes('/api/providers/test')) {
      const body = JSON.parse(init?.body ?? '{}');
      window.__gateSaveCalls.push({ provider: body.provider, key: body.key, baseUrl: body.baseUrl ?? null });
      if (window.__gateSaveMode === 'reject') return json({ error: 'MISSING_PROVIDER_KEY_SECRET' }, 503);
      return json({ ok: true, provider: { id: body.provider, baseUrl: body.baseUrl ?? null } }, 201);
    }
    if (/api\\.anthropic\\.com|api\\.openai\\.com|generativelanguage|groq\\.com|api\\.x\\.ai|openrouter\\.ai|nvidia|deepseek|gate-test\\.example/.test(url)) {
      return json({ error: { message: 'direct provider call blocked by gate E2E' } }, 403);
    }
    return window.__gateOriginalFetch(input, init);
  };
  return 'mocks installed';
`);

const lastVerifyCall = () => evaluate('return window.__gateVerifyCalls.at(-1) ?? null;');
const verifyCallCount = () => evaluate('return window.__gateVerifyCalls.length;');

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: BASE });
  await sleep(3500);

  note('enter-workspace', await clickVisible('Start free council'));
  await sleep(1800);
  note('cookie-banner', await clickVisible('Only necessary'));
  await sleep(400);

  await evaluate(
    "return fetch('/api/language',{method:'POST',headers:{'Content-Type':'application/json'},body:'{\\\"language\\\":\\\"en\\\"}'}).then(() => 'ok');"
  );
  let toKeys = await clickSelector('#sidebar-api-keys-btn');
  if (toKeys !== 'clicked') toKeys = await clickVisible('API Keys');
  if (toKeys !== 'clicked') toKeys = await clickVisible('Integrations');
  if (toKeys !== 'clicked') {
    note('nav-account-settings', await clickVisible('Account settings'));
    await sleep(1200);
    toKeys = await clickVisible('Integrations');
    if (toKeys !== 'clicked') toKeys = await clickVisible('Tích hợp');
  }
  check('nav to Integrations', toKeys === 'clicked', toKeys);
  await sleep(1200);

  note('mocks', await installMocks());

  // ── Built-in provider ────────────────────────────────────────────────────
  let opened = await clickSelector('#provider-connect-anthropic');
  if (opened !== 'clicked') opened = await clickVisible('Connect');
  check('open built-in connect modal', opened === 'clicked', opened);
  await waitFor(isVisible('#provider-api-key'));

  // B1 wrong key
  await typeInto('#provider-api-key', BUILTIN_WRONG_KEY);
  await clickSelector('#provider-test-btn');
  const b1Alert = await waitFor(`${visibleAlertText}.length > 0`);
  const b1Call = await lastVerifyCall();
  check('B1 wrong key → verify called with the exact key', b1Call?.key === BUILTIN_WRONG_KEY, JSON.stringify(b1Call?.provider));
  check('B1 wrong key → alert shown', b1Alert, await evaluate(`return ${visibleAlertText};`));
  check('B1 wrong key → Save hidden', !(await evaluate(`return ${isVisible('#provider-save-btn')};`)), 'save hidden');
  check('B1 wrong key → Test button stays', await evaluate(`return ${isVisible('#provider-test-btn')};`), 'test visible');

  // B2 correct key
  await typeInto('#provider-api-key', BUILTIN_GOOD_KEY);
  await clickSelector('#provider-test-btn');
  const b2Save = await waitFor(isVisible('#provider-save-btn'));
  check('B2 correct key → Save appears', b2Save, 'save visible');
  check('B2 correct key → Test button gone', !(await evaluate(`return ${isVisible('#provider-test-btn')};`)), 'test hidden');
  check('B2 correct key → success status', await evaluate(`return ${isVisible('#provider-test-status')};`), 'status visible');

  // B3 edit key after a successful test
  await typeInto('#provider-api-key', BUILTIN_GOOD_KEY + 'x');
  const b3Back = await waitFor(`!${isVisible('#provider-save-btn')} && ${isVisible('#provider-test-btn')}`, 3000);
  check('B3 edited key → Save hidden, Test button back', b3Back, 'back to Test');
  check('B3 edited key → success status cleared', !(await evaluate(`return ${isVisible('#provider-test-status')};`)), 'status hidden');

  // B4 stale in-flight success must not unlock Save for a different key
  await typeInto('#provider-api-key', BUILTIN_SLOW_KEY);
  const callsBeforeSlow = await verifyCallCount();
  await clickSelector('#provider-test-btn');
  await waitFor(`window.__gateVerifyCalls.length > ${callsBeforeSlow}`, 3000);
  await typeInto('#provider-api-key', BUILTIN_WRONG_KEY);
  await sleep(2200);
  check(
    'B4 late success for an edited key → Save stays hidden',
    !(await evaluate(`return ${isVisible('#provider-save-btn')};`)),
    'save hidden'
  );
  check('B4 late success → Test button available', await evaluate(`return ${isVisible('#provider-test-btn')};`), 'test visible');

  // B5 save rejected by the server → typed error, Save remains for retry
  await typeInto('#provider-api-key', BUILTIN_GOOD_KEY);
  await clickSelector('#provider-test-btn');
  await waitFor(isVisible('#provider-save-btn'));
  await clickSelector('#provider-save-btn');
  const b5Error = await waitFor(isVisible('#provider-save-error'));
  const b5Save = await evaluate('return window.__gateSaveCalls.at(-1) ?? null;');
  check('B5 save posts the tested key', b5Save?.key === BUILTIN_GOOD_KEY, JSON.stringify(b5Save?.provider));
  check('B5 server rejection → save error shown', b5Error, await evaluate(`return ${visibleAlertText};`));
  check('B5 server rejection → Save still available', await evaluate(`return ${isVisible('#provider-save-btn')};`), 'save visible');

  // B6 save accepted → connected
  await evaluate("window.__gateSaveMode = 'accept'; return 'accept';");
  await clickSelector('#provider-save-btn');
  const b6Closed = await waitFor(`!${isVisible('#provider-api-key')}`, 6000);
  check('B6 accepted save → modal closes', b6Closed, 'modal closed');
  const b6Connected = await evaluate("return /connected/i.test(document.body.innerText);");
  check('B6 accepted save → provider shows connected', b6Connected, String(b6Connected));
  const keyLeaked = await evaluate(`return document.body.innerText.includes(${JSON.stringify(BUILTIN_GOOD_KEY)});`);
  check('built-in key never rendered in DOM text', keyLeaked === false, `leaked=${keyLeaked}`);
  if (!b6Closed) await closeModal();
  await sleep(500);

  // ── Custom OpenAI-compatible provider ────────────────────────────────────
  const openedCustom = await clickSelector('#add-custom-provider-btn');
  check('open custom provider modal', openedCustom === 'clicked', openedCustom);
  await waitFor(isVisible('#custom-provider-name'));
  await clickSelector('#custom-standard-openai');
  await typeInto('#custom-provider-name', 'Gate Test LLM');
  await typeInto('#custom-provider-url', CUSTOM_GOOD_URL);

  // C1 wrong key
  await typeInto('#custom-provider-key', CUSTOM_WRONG_KEY);
  await clickSelector('#custom-provider-test-btn');
  const c1Alert = await waitFor(`${visibleAlertText}.length > 0`);
  check('C1 wrong key → alert shown', c1Alert, await evaluate(`return ${visibleAlertText};`));
  check('C1 wrong key → Save hidden', !(await evaluate(`return ${isVisible('#custom-provider-save-btn')};`)), 'save hidden');

  // C2 wrong base URL with the right key
  await typeInto('#custom-provider-key', CUSTOM_GOOD_KEY);
  await typeInto('#custom-provider-url', CUSTOM_WRONG_URL);
  await clickSelector('#custom-provider-test-btn');
  const c2Alert = await waitFor(`${visibleAlertText}.length > 0`);
  const c2Call = await lastVerifyCall();
  check('C2 verify called with the typed Base URL', c2Call?.baseUrl?.replace(/\/+$/, '') === CUSTOM_WRONG_URL, String(c2Call?.baseUrl));
  check('C2 wrong Base URL → alert shown', c2Alert, await evaluate(`return ${visibleAlertText};`));
  check('C2 wrong Base URL → Save hidden', !(await evaluate(`return ${isVisible('#custom-provider-save-btn')};`)), 'save hidden');

  // C3 correct pair
  await typeInto('#custom-provider-url', CUSTOM_GOOD_URL);
  await clickSelector('#custom-provider-test-btn');
  const c3Save = await waitFor(isVisible('#custom-provider-save-btn'));
  check('C3 correct key + Base URL → Save appears', c3Save, 'save visible');

  // C4 edit base URL after success
  await typeInto('#custom-provider-url', CUSTOM_GOOD_URL + '/chat');
  const c4Back = await waitFor(`!${isVisible('#custom-provider-save-btn')} && ${isVisible('#custom-provider-test-btn')}`, 3000);
  check('C4 edited Base URL → Save hidden, Test button back', c4Back, 'back to Test');

  // C5 edit key after success
  await typeInto('#custom-provider-url', CUSTOM_GOOD_URL);
  await clickSelector('#custom-provider-test-btn');
  await waitFor(isVisible('#custom-provider-save-btn'));
  await typeInto('#custom-provider-key', CUSTOM_GOOD_KEY + 'x');
  const c5Back = await waitFor(`!${isVisible('#custom-provider-save-btn')} && ${isVisible('#custom-provider-test-btn')}`, 3000);
  check('C5 edited key → Save hidden, Test button back', c5Back, 'back to Test');

  // C6 bare origin → server resolves /v1 and the UI tells the user before saving
  await typeInto('#custom-provider-key', CUSTOM_GOOD_KEY);
  await typeInto('#custom-provider-url', CUSTOM_ORIGIN);
  await clickSelector('#custom-provider-test-btn');
  const c6Save = await waitFor(isVisible('#custom-provider-save-btn'));
  check('C6 bare origin → Save appears', c6Save, 'save visible');
  const adjusted = await evaluate(`
    const el = document.querySelector('#custom-provider-url-adjusted');
    return el ? el.textContent.trim() : '';
  `);
  check('C6 bare origin → resolved /v1 URL shown', adjusted.includes(CUSTOM_GOOD_URL), adjusted);
  const customKeyLeaked = await evaluate(`return document.body.innerText.includes(${JSON.stringify(CUSTOM_GOOD_KEY)});`);
  check('custom key never rendered in DOM text', customKeyLeaked === false, `leaked=${customKeyLeaked}`);

  mkdirSync(dirname(OUT), { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(OUT, Buffer.from(data, 'base64'));
  note('screenshot', OUT);

  await closeModal();
  await evaluate('window.fetch = window.__gateOriginalFetch; delete window.__gateOriginalFetch; return "restored";');
} catch (error) {
  failures.push(`runtime: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
} finally {
  mkdirSync('.agent/evidence', { recursive: true });
  writeFileSync(
    '.agent/evidence/drive-keys-verify-gate.json',
    JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, trace, failures }, null, 2)
  );
  try {
    chrome.kill();
  } catch {}
}

if (failures.length) {
  console.log(`\nFAILED (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nALL_CHECKS_PASS');
