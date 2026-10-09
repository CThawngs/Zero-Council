/**
 * Checks the self-hosted webfonts actually render Vietnamese, and that the build no longer needs
 * Google at runtime.
 *
 * The failure this guards against is invisible in CI and easy to ship: drop the `unicode-range`
 * block for vietnamese and every accented letter silently falls back to a system font. Text still
 * looks "fine" in a screenshot on a machine that happens to have a good fallback — which is how it
 * shipped twice before. So this measures instead of eyeballing: the same Vietnamese string is set
 * in the webfont and in Georgia, and a width match means the webfont is NOT drawing those glyphs.
 *
 * Usage: node tests/drive-font.mjs <baseUrl> <outPng>
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3230';
const OUT = process.argv[3] ?? 'council-font.png';
const PORT = 9339;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-font';
const EVIDENCE = '.agent/evidence';

// A profile left behind by a killed Chrome keeps a SingletonLock, and the next run's DevTools
// endpoint then never comes up — which looks exactly like "Chrome failed to start".
try {
  rmSync(PROFILE, { recursive: true, force: true });
} catch {}

/** Widths in these must differ if the webfont is drawing the glyphs. */
const VIETNAMESE = 'ễ ậ ở ự quyết định phương án';
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
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

/**
 * Opening the socket is retried on purpose. Chrome replaces its initial `about:blank` target during
 * startup, and a target that dies between being listed and being connected to fails the handshake
 * with a bare "NetworkError" — no clue that the fix is simply to ask for the list again.
 */
const connect = async () => {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const socket = new WebSocket(await cdpTarget());
      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
      });
      return socket;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError;
};

const ws = await connect();
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
// Async wrapper: a snippet that needs to await (waiting for webfonts) has to be allowed to, and
// `awaitPromise` means a snippet that does not simply resolves straight away.
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  return result.value;
}

// "Does the page still talk to Google" is read from the page's own resource timing rather than from
// CDP's Network domain: the timing entries are the requests that actually happened, and turning
// that domain on for a page full of font requests only adds noise here.
const resources = () =>
  evaluate(`
    return performance.getEntriesByType('resource').map((entry) => entry.name);
  `);

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE });
await sleep(2500);

await evaluate(`
  for (const family of ['Inter Local', 'Literata Local']) {
    await document.fonts.load('1em "' + family + '"');
  }
  await document.fonts.ready;
`);
await sleep(500);

const loaded = await evaluate(`
  const names = [...document.fonts].map((f) => f.family + ':' + f.status);
  return {
    faces: [...new Set([...document.fonts].map((f) => f.family))],
    inter: document.fonts.check('16px "Inter Local"'),
    literata: document.fonts.check('16px "Literata Local"'),
    count: names.length,
  };
`);
console.log('[fonts]', JSON.stringify(loaded));
check('Inter Local is registered and usable', loaded.inter === true);
check('Literata Local is registered and usable', loaded.literata === true);

const widths = await evaluate(`
  const measure = (family) => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:64px;font-family:' + family;
    probe.textContent = ${JSON.stringify(VIETNAMESE)};
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(w * 100) / 100;
  };
  return {
    webfont: measure('"Literata Local", serif'),
    georgia: measure('Georgia, serif'),
    system: measure('system-ui, sans-serif'),
  };
`);
console.log('[widths]', JSON.stringify(widths));
check(
  'the webfont draws Vietnamese itself, not Georgia',
  Math.abs(widths.webfont - widths.georgia) > 0.5,
  `webfont=${widths.webfont} georgia=${widths.georgia}`
);

const sansWidths = await evaluate(`
  const measure = (family) => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:64px;font-family:' + family;
    probe.textContent = ${JSON.stringify(VIETNAMESE)};
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(w * 100) / 100;
  };
  return { webfont: measure('"Inter Local", sans-serif'), georgia: measure('Georgia, sans-serif') };
`);
check(
  'the sans webfont draws Vietnamese itself, not Georgia',
  Math.abs(sansWidths.webfont - sansWidths.georgia) > 0.5,
  `webfont=${sansWidths.webfont} georgia=${sansWidths.georgia}`
);

const requested = await resources();
const local = requested.filter((url) => url.includes('/fonts/'));
const google = requested.filter((url) => /fonts\.gstatic\.com|fonts\.googleapis\.com/.test(url));
console.log('[requests] local=' + local.length + ' google=' + google.length);
check('the fonts are fetched from this origin', local.length >= 1, local.join(' ').slice(0, 160));
check('the page never contacts Google at runtime', google.length === 0, google.join(' '));

// Show the text that was measured, in Vietnamese, so the screenshot is evidence of the accent work
// rather than of an English page.
await evaluate(`
  const box = document.createElement('div');
  box.id = 'font-proof';
  box.style.cssText = 'position:fixed;inset:auto 24px 24px auto;z-index:9999;background:#171b24;color:#edeee2;border:1px solid #c9a24b;border-radius:12px;padding:16px 20px;font-family:"Literata Local",Georgia,serif;font-size:22px;line-height:1.5;max-width:420px';
  const heading = document.createElement('div');
  heading.style.cssText = 'font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c9a24b;margin-bottom:8px';
  heading.textContent = 'Dấu tiếng Việt · ' + ${JSON.stringify(VIETNAMESE)}.length + ' ký tự';
  const body = document.createElement('div');
  body.textContent = ${JSON.stringify(VIETNAMESE)};
  box.append(heading, body);
  document.body.appendChild(box);
`);
await sleep(400);

const shot = await send('Page.captureScreenshot', { format: 'png' });
mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(`${EVIDENCE}/${OUT}`, Buffer.from(shot.data, 'base64'));
writeFileSync(
  `${EVIDENCE}/council-font.json`,
  JSON.stringify({ loaded, widths, sansWidths, local, google }, null, 2)
);
console.log(`[screenshot] ${EVIDENCE}/${OUT}`);

console.log(failures.length === 0 ? 'ALL_CHECKS_PASS' : `FAILED: ${failures.join(' | ')}`);
process.exit(failures.length === 0 ? 0 : 1);