/**
 * drive-group-mentions.mjs — Real Chrome CDP E2E for PR 4:
 *   1. Interactive @-mention autocomplete (#chat-mention-popover, #chat-mention-btn,
 *      live EN & Vietnamese accent-insensitive filtering, ArrowDown/ArrowUp/Enter/Tab/Escape
 *      without premature submit).
 *   2. Rich inline [data-mention-pill] rendering & WCAG AA (>= 4.5:1) computed contrast
 *      in BOTH Light & Dark modes across user (bg-accent) and bot bubbles.
 *   3. Honest No-Key Preview Banner (#chat-no-key-banner, #chat-connect-key-cta) +
 *      100% Vietnamese scripted fallback & conclusion localization (zero fake English).
 *   4. Responsive 0-overflow check at 1440x900, 375x812, and 320x640 + 0 console errors.
 *
 * Usage: node tests/drive-group-mentions.mjs [baseUrl] [outPng]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? process.env.ZC_URL ?? 'http://127.0.0.1:3324';
const OUT = process.argv[3] ?? '';
const PORT = 9344;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = join(process.env.TEMP || os.tmpdir(), 'zc-chrome-pr4-' + Date.now());

const trace = [];
const failures = [];
const consoleErrors = [];

const note = (step, detail) => {
  trace.push({ step, detail });
  console.log(`[${step}] ${detail}`);
};
const check = (label, ok, detail) => {
  note(label, `${ok ? 'PASS' : 'FAIL'} — ${detail}`);
  if (!ok) failures.push(`${label}: ${detail}`);
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
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const cleanup = () => {
  try {
    chrome.kill();
  } catch {}
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {}
};
process.on('exit', cleanup);

async function cdpTarget() {
  for (let i = 0; i < 40; i++) {
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
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const frame = JSON.parse(ev.data);
  if (frame.method === 'Runtime.exceptionThrown') {
    const desc = frame.params?.exceptionDetails?.exception?.description ?? 'Runtime exception';
    consoleErrors.push(desc);
  }
  if (frame.method === 'Runtime.consoleAPICalled' && frame.params?.type === 'error') {
    const msg = (frame.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (!msg.includes('favicon.ico')) consoleErrors.push(msg);
  }
  const entry = pending.get(frame.id);
  if (!entry) return;
  pending.delete(frame.id);
  frame.error ? entry.reject(new Error(JSON.stringify(frame.error))) : entry.resolve(frame.result);
});

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    seq++;
    pending.set(seq, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  return result?.value;
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await sleep(350);
}

/** Simulates realistic single-keystroke typing into #chat-composer so live mention detection triggers. */
async function typeLiveIntoComposer(text, append = false) {
  return evaluate(`
    const box = document.querySelector('#chat-composer');
    if (!box) return 'MISSING #chat-composer';
    box.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    let cur = ${append ? 'box.value' : "''"};
    if (!${append}) {
      setter.call(box, '');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (const ch of ${JSON.stringify(text)}) {
      cur += ch;
      setter.call(box, cur);
      box.setSelectionRange(cur.length, cur.length);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 50));
    return box.value;
  `);
}

async function pressComposerKey(key) {
  return evaluate(`
    const box = document.querySelector('#chat-composer');
    if (!box) return 'MISSING';
    const ev = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true });
    const notCancelled = box.dispatchEvent(ev);
    await new Promise((r) => setTimeout(r, 60));
    return { value: box.value, prevented: !notCancelled };
  `);
}

async function openGroupRoom(customTitle = '') {
  const clicked = await evaluate(`
    const direct = document.querySelector('#sidebar-new-group-btn');
    if (direct && direct.getBoundingClientRect().width > 0) {
      direct.click();
      return 'clicked-sidebar';
    }
    const btn = [...document.querySelectorAll('button')].find((b) => {
      const r = b.getBoundingClientRect();
      const txt = b.textContent.replace(/\\s+/g, ' ').trim().toLowerCase();
      return r.width > 0 && r.height > 0 && (
        txt.includes('new group') ||
        txt.includes('open room') ||
        txt.includes('nhóm chat') ||
        txt.includes('tạo nhóm') ||
        txt.includes('mở phòng')
      );
    });
    if (!btn) return 'MISSING';
    btn.click();
    return 'clicked-btn';
  `);
  await sleep(900);
  const started = await evaluate(`
    const d = document.querySelector('dialog[open]');
    if (!d) return document.querySelector('#chat-composer') ? 'already-open' : 'NO-DIALOG';
    const titleInput = d.querySelector('input[type="text"]');
    if (titleInput && ${JSON.stringify(customTitle)}) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(titleInput, ${JSON.stringify(customTitle)});
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));
    }
    const btn = [...d.querySelectorAll('footer button, button')].find((b) =>
      !b.disabled && /open room|start council|create|mở phòng|bắt đầu|tạo/i.test(b.textContent)
    );
    if (!btn) {
      const allBtns = [...d.querySelectorAll('button')].map((b) => b.textContent.trim() + (b.disabled ? '[disabled]' : ''));
      return 'MISSING-CONFIRM:' + allBtns.join('|');
    }
    btn.click();
    return 'confirmed';
  `);
  await sleep(1500);
  return `${clicked} -> ${started}`;
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await setViewport(1440, 900);

  // 1. Enter workspace in English
  await send('Page.navigate', { url: BASE + '/dashboard' });
  await sleep(2800);
  await evaluate(`
    await fetch('/api/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en' }),
    });
  `);
  await send('Page.reload');
  await sleep(2500);

  const groupOpened = await openGroupRoom('EN Strategy Council');
  note('open-group-room', groupOpened);
  const hasComposer = await evaluate(`return !!document.querySelector('#chat-composer');`);
  check('Group Chat composer mounted (1440x900 EN)', hasComposer === true, groupOpened);

  // 2. Honest No-Key Preview Banner + CTA navigation
  const bannerEn = await evaluate(`
    const b = document.querySelector('#chat-no-key-banner');
    const cta = document.querySelector('#chat-connect-key-cta');
    return b && cta ? { text: b.innerText.replace(/\\s+/g, ' ').trim(), cta: cta.innerText.trim() } : null;
  `);
  check(
    'No-Key Preview Banner & Connect API Key CTA visible in EN',
    !!bannerEn && /API key|Preview/i.test(bannerEn.text) && /Connect API Key/i.test(bannerEn.cta),
    JSON.stringify(bannerEn)
  );

  // Click CTA -> verify navigation to API keys, then re-open group room
  await evaluate(`document.querySelector('#chat-connect-key-cta')?.click();`);
  await sleep(900);
  const reachedIntegrations = await evaluate(`
    return !!document.querySelector('#provider-connect-openai, #provider-connect-anthropic') ||
      /API Keys|Integrations/i.test(document.body.innerText);
  `);
  check('#chat-connect-key-cta navigates to Integrations/API Keys', reachedIntegrations === true, String(reachedIntegrations));

  // Return to Group Chat room
  await evaluate(`
    const roomBtn = [...document.querySelectorAll('aside button, nav button')].find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && /EN Strategy Council|pragmatist|group/i.test(b.textContent);
    });
    if (roomBtn) roomBtn.click();
  `);
  await sleep(800);
  if (!(await evaluate(`return !!document.querySelector('#chat-composer');`))) {
    await openGroupRoom('EN Strategy Council');
  }

  // 3. Interactive @-Mention Autocomplete on Desktop (keyboard navigation + no premature submit)
  await typeLiveIntoComposer('@', false);
  await sleep(250);
  const popInitial = await evaluate(`
    const p = document.querySelector('#chat-mention-popover');
    if (!p) return null;
    const opts = [...p.querySelectorAll('[role="option"]')].map((o) => o.innerText.replace(/\\s+/g, ' ').trim());
    return { count: opts.length, opts };
  `);
  check(
    'Typing "@" opens #chat-mention-popover with @all, active room bots, and @user',
    !!popInitial && popInitial.count >= 4 && popInitial.opts.some((o) => o.includes('@all')) && popInitial.opts.some((o) => o.includes('@user')),
    JSON.stringify(popInitial)
  );

  // Filter live by typing "duc" (Vietnamese accent-insensitive match for "Đức Kỹ Sư")
  await typeLiveIntoComposer('duc', true);
  await sleep(200);
  const popFilteredVi = await evaluate(`
    const p = document.querySelector('#chat-mention-popover');
    if (!p) return null;
    return [...p.querySelectorAll('[role="option"]')].map((o) => o.innerText.replace(/\\s+/g, ' ').trim());
  `);
  check(
    'Accent-insensitive live filtering "@duc" matches "@Đức Kỹ Sư"',
    Array.isArray(popFilteredVi) && popFilteredVi.length === 1 && /Đức Kỹ Sư/i.test(popFilteredVi[0]),
    JSON.stringify(popFilteredVi)
  );

  // Escape closes popover without submitting
  const escRes = await pressComposerKey('Escape');
  await sleep(150);
  const popAfterEsc = await evaluate(`return !!document.querySelector('#chat-mention-popover');`);
  check('Escape dismisses #chat-mention-popover cleanly', popAfterEsc === false && escRes.prevented === true, JSON.stringify(escRes));

  // Re-trigger with @, ArrowDown to first bot, Enter to insert (MUST NOT submit message!)
  const logCountBefore = await evaluate(`return document.querySelectorAll('[role="log"] article, [role="log"] > div > div').length;`);
  await typeLiveIntoComposer('@', false);
  await sleep(200);
  await pressComposerKey('ArrowDown');
  await sleep(100);
  const enterInsert = await pressComposerKey('Enter');
  await sleep(200);
  const logCountAfterInsert = await evaluate(`return document.querySelectorAll('[role="log"] article, [role="log"] > div > div').length;`);
  check(
    'ArrowDown + Enter inserts @BotName with trailing space and does NOT submit prematurely',
    enterInsert.prevented === true && /^@.+\s$/.test(enterInsert.value) && logCountAfterInsert === logCountBefore,
    JSON.stringify({ enterInsert, logCountBefore, logCountAfterInsert })
  );

  // Append @all and @user and submit for real
  await typeLiveIntoComposer('and @all cc @user Should we ship PR 4 today?', true);
  await sleep(150);
  if (await evaluate(`return !!document.querySelector('#chat-mention-popover');`)) {
    await pressComposerKey('Escape');
    await sleep(100);
  }
  await pressComposerKey('Enter');
  await sleep(3200);

  // 4. Verify inline [data-mention-pill] rendering + multi-bot @all response + WCAG >= 4.5:1 contrast (Light & Dark)
  const pillAudit = async (modeLabel) =>
    evaluate(`
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      function parseCssColor(str) {
        if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return [0, 0, 0, 0];
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = str;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      }
      function blend(fg, bg) {
        const a = fg[3];
        if (a >= 0.999) return [fg[0], fg[1], fg[2], 1];
        return [
          fg[0] * a + bg[0] * (1 - a),
          fg[1] * a + bg[1] * (1 - a),
          fg[2] * a + bg[2] * (1 - a),
          1,
        ];
      }
      function effectiveBg(el) {
        const chain = [];
        let cur = el;
        while (cur && cur.nodeType === 1) {
          chain.unshift(parseCssColor(getComputedStyle(cur).backgroundColor));
          cur = cur.parentElement;
        }
        let acc = document.documentElement.dataset.theme === 'dark' ? [12, 12, 18, 1] : [255, 255, 255, 1];
        for (const layer of chain) {
          if (layer[3] > 0) acc = blend(layer, acc);
        }
        return acc;
      }
      function relLum([r, g, b]) {
        const f = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      function ratio(c1, c2) {
        const l1 = relLum(c1);
        const l2 = relLum(c2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      const pills = [...document.querySelectorAll('[data-mention-pill]')];
      const results = pills.map((p) => {
        const bg = effectiveBg(p);
        const fgRaw = parseCssColor(getComputedStyle(p).color);
        const fg = blend(fgRaw, bg);
        return {
          text: p.textContent.trim(),
          kind: p.getAttribute('data-mention-pill'),
          contrast: Number(ratio(fg, bg).toFixed(2)),
        };
      });
      return {
        mode: ${JSON.stringify(modeLabel)},
        count: results.length,
        minContrast: results.length ? Math.min(...results.map((r) => r.contrast)) : 0,
        results,
      };
    `);

  const lightPills = await pillAudit('light');
  check(
    'Inline [data-mention-pill] rendered & Light mode WCAG contrast >= 4.5:1',
    lightPills.count >= 3 && lightPills.minContrast >= 4.5,
    JSON.stringify(lightPills)
  );

  // Switch to Dark mode via data-theme="dark" and audit contrast again
  await evaluate(`
    document.documentElement.setAttribute('data-theme', 'dark');
  `);
  await sleep(300);
  const darkPills = await pillAudit('dark');
  check(
    'Dark mode [data-mention-pill] WCAG contrast >= 4.5:1',
    darkPills.count >= 3 && darkPills.minContrast >= 4.5,
    JSON.stringify(darkPills)
  );

  // Restore Light mode
  await evaluate(`
    document.documentElement.setAttribute('data-theme', 'light');
  `);
  await sleep(200);

  // Verify @all scheduled BOTH active bots in Group Chat
  const multiBotCheck = await evaluate(`
    const log = document.querySelector('[role="log"]');
    const txt = log ? log.innerText : '';
    return {
      hasPragmatist: /The Pragmatist/i.test(txt),
      hasDuc: /Đức Kỹ Sư/i.test(txt),
      length: txt.length,
    };
  `);
  check(
    '@all scheduled all active bots in Group Chat deliberation',
    multiBotCheck.hasPragmatist && multiBotCheck.hasDuc,
    JSON.stringify(multiBotCheck)
  );

  // 5. Vietnamese ('vi') Localization & Zero Fake-English Verification
  await evaluate(`
    await fetch('/api/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'vi' }),
    });
  `);
  await send('Page.reload');
  await sleep(2800);

  // Open a brand-new Vietnamese Group Chat room so transcript is purely Vietnamese
  const viRoomOpened = await openGroupRoom('Hội đồng Chiến lược VI');
  note('open-vi-room', viRoomOpened);

  const bannerVi = await evaluate(`
    const b = document.querySelector('#chat-no-key-banner');
    const cta = document.querySelector('#chat-connect-key-cta');
    return b && cta ? { text: b.innerText.replace(/\\s+/g, ' ').trim(), cta: cta.innerText.trim() } : null;
  `);
  check(
    'No-Key Preview Banner & CTA localized cleanly in Vietnamese',
    !!bannerVi && /Chế độ xem trước|API key/i.test(bannerVi.text) && /Kết nối API Key/i.test(bannerVi.cta),
    JSON.stringify(bannerVi)
  );

  await typeLiveIntoComposer('@all Chúng ta nên ra mắt bản beta vào tuần này hay tuần sau?', false);
  await sleep(200);
  if (await evaluate(`return !!document.querySelector('#chat-mention-popover');`)) {
    await pressComposerKey('Escape');
    await sleep(100);
  }
  await pressComposerKey('Enter');
  await sleep(3200);

  // Trigger Wrap-up / Conclusion in Vietnamese
  await evaluate(`
    const wrapBtn = [...document.querySelectorAll('header button')].find((b) =>
      /wrap up|tổng kết|kết luận/i.test(b.getAttribute('aria-label') || b.textContent || '')
    );
    wrapBtn?.click();
  `);
  await sleep(1200);

  const viTranscriptAudit = await evaluate(`
    const log = document.querySelector('[role="log"]');
    const txt = log ? log.innerText : '';
    const englishLeaks = [
      'From the angle of',
      'From my lens',
      'Pressure-testing that',
      'What nobody in this thread has asked yet',
      'picking up your point',
      'this is your side of the table',
      'AI Analyst',
    ].filter((phrase) => txt.includes(phrase));
    const hasViContent = /Từ góc nhìn|Về chủ đề|Phản biện|Chuyên viên phân tích|Tổng kết|Hội đồng/i.test(txt);
    return { englishLeaks, hasViContent, sample: txt.replace(/\\s+/g, ' ').slice(0, 320) };
  `);
  check(
    'Vietnamese room scripted replies & conclusion have ZERO fake English leaks',
    viTranscriptAudit.englishLeaks.length === 0 && viTranscriptAudit.hasViContent === true,
    JSON.stringify(viTranscriptAudit)
  );

  // 6. Responsive 0-overflow + Mobile @ Toolbar Button (#chat-mention-btn) at 375x812 & 320x640
  for (const [w, h] of [
    [1440, 900],
    [375, 812],
    [320, 640],
  ]) {
    await setViewport(w, h);
    const overflow = await evaluate(`
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    `);
    check(
      `Zero horizontal overflow at ${w}x${h}`,
      overflow.scrollWidth <= overflow.innerWidth,
      JSON.stringify(overflow)
    );
  }

  // At 320x640 mobile, tap #chat-mention-btn and pick @all via tap/click
  const mobileMentionTap = await evaluate(`
    const btn = document.querySelector('#chat-mention-btn');
    if (!btn) return { error: 'MISSING #chat-mention-btn' };
    btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const pop = document.querySelector('#chat-mention-popover');
    if (!pop) return { error: 'POPOVER DID NOT OPEN' };
    const rect = pop.getBoundingClientRect();
    const firstOpt = pop.querySelector('[role="option"]');
    firstOpt?.click();
    await new Promise((r) => setTimeout(r, 150));
    const box = document.querySelector('#chat-composer');
    return {
      withinViewport: rect.left >= 0 && rect.right <= window.innerWidth + 1,
      composerValue: box ? box.value : '',
    };
  `);
  check(
    'Mobile 320x640 #chat-mention-btn opens viewport-safe popover & inserts @all',
    mobileMentionTap.withinViewport === true && mobileMentionTap.composerValue.startsWith('@all '),
    JSON.stringify(mobileMentionTap)
  );

  // Reset language back to EN for clean state
  await evaluate(`
    await fetch('/api/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en' }),
    });
  `);

  if (OUT) {
    await setViewport(1440, 900);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  }

  check('Zero browser console/runtime errors', consoleErrors.length === 0, JSON.stringify(consoleErrors));
} finally {
  ws.close();
  cleanup();
}

if (failures.length > 0) {
  console.error('E2E FAILURES:', failures);
  process.exit(1);
}
console.log('ALL PR 4 GROUP MENTIONS & UX E2E CHECKS PASSED!');
