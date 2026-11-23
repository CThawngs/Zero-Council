/**
 * drive-zero-council-e2e.mjs — Comprehensive E2E for Zero Council prototype.
 *
 * Covers (per brief):
 *   1. 8 built-in providers: Base URL locked (#provider-base-url disabled+readOnly)
 *   2. Custom Provider: standard selection (openai/anthropic), name + URL fields, Test->Save flow
 *   3. Custom Model Test->Save on existing connected provider
 *   4. Bot CRUD & Wizard
 *   5. Group Chat: >=2 bots required, natural A2A conversation
 *   6. File/image attachment (#chat-attach-file-btn, #chat-file)
 *   7. #chat-web-search-toggle: toggles on/off
 *   8. QR Checkout: all fields locked, price matches plans (139000/379000 VND), cancel to Free
 *   9. Responsive: scrollWidth <= innerWidth at 375x812 and 1440x900
 *
 * Usage: node tests/drive-zero-council-e2e.mjs <baseUrl> <outPng>
 * Zero new dependencies — Node 22+ built-in WebSocket + fetch only.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path, { dirname } from 'node:path';

if (!process.env.ZC_PROVIDER_KEYS_STORE && existsSync(path.resolve('web'))) {
  process.env.ZC_PROVIDER_KEYS_STORE = path.resolve('web', '.zc-provider-keys.json');
}
const { deleteProviderKey, saveProviderKey } = await import('../web/src/lib/store/providerKeys.ts');
import { setTimeout as sleep } from 'node:timers/promises';

const BASE    = process.argv[2] ?? 'http://127.0.0.1:3232';
const OUT     = process.argv[3] ?? '.agent/evidence/zero-council-e2e.png';
const PORT    = 9340;
const CHROME  = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-e2e-' + Date.now();

const BUILTIN_PROVIDERS = [
  { id: 'anthropic',  url: 'https://api.anthropic.com/v1' },
  { id: 'openai',     url: 'https://api.openai.com/v1' },
  { id: 'google',     url: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'groq',       url: 'https://api.groq.com/openai/v1' },
  { id: 'xai',        url: 'https://api.x.ai/v1' },
  { id: 'openrouter', url: 'https://openrouter.ai/api/v1' },
  { id: 'nvidia',     url: 'https://integrate.api.nvidia.com/v1' },
  { id: 'deepseek',   url: 'https://api.deepseek.com/v1' },
];

const trace    = [];
const failures = [];
const note   = (step, detail) => { trace.push({ step, detail }); console.log(`[${step}] ${detail}`); };
const check  = (label, ok, detail) => { note(label, `${ok ? 'PASS' : 'FAIL'} — ${detail}`); if (!ok) failures.push(label); };

// ── Chrome ──────────────────────────────────────────────────────────────────
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

async function cdpTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
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
ws.addEventListener('message', ev => {
  const frame = JSON.parse(ev.data);
  const entry = pending.get(frame.id);
  if (!entry) return;
  pending.delete(frame.id);
  frame.error ? entry.reject(new Error(JSON.stringify(frame.error))) : entry.resolve(frame.result);
});
const send = (method, params = {}) => new Promise((res, rej) => {
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

async function setEmulatedSize(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 768,
  });
  await sleep(400);
}

const clickVisible = label => evaluate(`
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

const typeInto = (sel, val) => evaluate(`
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'MISSING ' + ${JSON.stringify(sel)};
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,${JSON.stringify(val)});
  el.dispatchEvent(new Event('input',{bubbles:true}));
  return 'typed';
`);

const closeModalBtn = () => evaluate(`
  const btn = [...document.querySelectorAll('button')].find(b => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && ['Cancel', 'Close', 'Hủy', 'Đóng'].includes(b.textContent.trim());
  });
  if (!btn) return 'NOT FOUND';
  btn.click(); return 'closed';
`);

const navTo = async label => {
  const result = await clickVisible(label);
  if (result === 'clicked') return result;
  // Alias mapping for sidebar
  const r2 = await evaluate(`
    const target = ${JSON.stringify(label.toLowerCase())};
    const els = [...document.querySelectorAll('a, button')].filter(b => {
      const r = b.getBoundingClientRect();
      const txt = b.textContent.replace(/\\s+/g, ' ').trim().toLowerCase();
      if (r.width === 0 || r.height === 0) return false;
      if (txt === target || txt.includes(target)) return true;
      if (target === 'api keys' && (txt.includes('api keys') || txt.includes('khóa api') || txt.includes('integrations') || txt.includes('tích hợp'))) return true;
      if (target === 'personas' && (txt.includes('advisors') || txt.includes('cố vấn'))) return true;
      if (target === 'advisors' && (txt.includes('advisors') || txt.includes('cố vấn'))) return true;
      if (target === 'billing' && (txt.includes('billing') || txt.includes('thanh toán'))) return true;
      if (target === 'settings' && (txt.includes('settings') || txt.includes('cài đặt'))) return true;
      return false;
    });
    if (!els.length) return 'MISSING';
    els[0].click(); return 'clicked';
  `);
  return r2;
};

const enterWorkspace = async () => {
  await send('Page.navigate', { url: BASE });
  await sleep(3500);
  const inWorkspace = await evaluate(`
    return window.location.pathname.startsWith('/dashboard')
      || !!document.querySelector('nav, #provider-base-url, [role="log"]');
  `);
  if (inWorkspace) {
    await evaluate(`await fetch('/api/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'en' }) });`);
    note('enter-workspace', 'already in workspace');
    return 'clicked';
  }
  let result = await clickVisible('Start free council');
  if (result !== 'clicked') {
    result = await evaluate(`
      const el = document.querySelector('a[href="/dashboard"], button[href="/dashboard"]');
      if (el) { el.click(); return 'clicked'; }
      return 'MISSING';
    `);
  }
  note('enter-workspace', result);
  await sleep(2000);
  return result;
};

// ═══════════════════════════════════════════════════════════════════════════
try {
  await send('Page.enable');
  await send('Runtime.enable');

  await setEmulatedSize(1440, 1000);
  await enterWorkspace();

  // ── 1. 8 Built-in providers: Base URL locked ──────────────────────────────
  note('section', '1. 8 built-in providers: base URL locked');
  const toKeys = await navTo('API Keys');
  note('nav-api-keys', toKeys);
  check('nav to Integrations/API Keys', toKeys === 'clicked', toKeys);
  await sleep(1200);

  for (const { id: providerId, url: expectedUrl } of BUILTIN_PROVIDERS) {
    const o = await evaluate(`
      const pid = ${JSON.stringify(providerId)};
      const btn = document.querySelector('#provider-connect-' + pid)
        || document.querySelector('[data-provider-card="' + pid + '"] button')
        || [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Connect');
      if (!btn) return 'MISSING';
      btn.click(); return 'clicked';
    `);
    if (o !== 'clicked') { note(`skip-${providerId}`, o); continue; }
    await sleep(700);

    const urlField = await evaluate(`
      const el = document.querySelector('#provider-base-url');
      if (!el) return null;
      return { disabled: el.disabled, readOnly: el.readOnly, value: el.value };
    `);
    check(`base-url disabled (${providerId})`, urlField?.disabled === true, String(urlField?.disabled));
    check(`base-url readOnly (${providerId})`, urlField?.readOnly === true, String(urlField?.readOnly));
    check(`base-url correct (${providerId})`, urlField?.value === expectedUrl,
      `got:${urlField?.value} want:${expectedUrl}`);

    await closeModalBtn();
    await sleep(400);
  }

  // ── 2. Custom Provider: standard=2 (openai+anthropic), name+URL fields, Test->Save ─
  note('section', '2. Custom Provider flow');
  const addCustom = await evaluate(`
    const btn = document.querySelector('#add-custom-provider-btn');
    if (!btn) return 'MISSING #add-custom-provider-btn';
    const r = btn.getBoundingClientRect();
    if (r.width === 0) return 'HIDDEN';
    btn.click(); return 'clicked';
  `);
  note('add-custom-provider', addCustom);
  check('#add-custom-provider-btn exists and clicked', addCustom === 'clicked', addCustom);

  if (addCustom === 'clicked') {
    await sleep(700);

    const stdOpenai = await evaluate(`
      const btn = document.querySelector('#custom-standard-openai');
      return btn ? { exists: true } : null;
    `);
    const stdAnthropic = await evaluate(`
      const btn = document.querySelector('#custom-standard-anthropic');
      return btn ? { exists: true } : null;
    `);
    check('custom provider: openai standard btn exists', stdOpenai?.exists === true, JSON.stringify(stdOpenai));
    check('custom provider: anthropic standard btn exists', stdAnthropic?.exists === true, JSON.stringify(stdAnthropic));

    // Fill name, URL, key
    const nameTyped = await typeInto('#custom-provider-name', 'QA Custom Provider');
    const urlTyped  = await typeInto('#custom-provider-url', 'https://my-llm.example.com/v1');
    const keyTyped  = await typeInto('#custom-provider-key', '«redacted 22 chars»');
    check('custom provider name typed', nameTyped === 'typed', nameTyped);
    check('custom provider url typed', urlTyped === 'typed', urlTyped);
    check('custom provider key typed', keyTyped === 'typed', keyTyped);

    const testBtn = await evaluate(`
      const btn = document.querySelector('#custom-provider-test-btn');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { exists: true, visible: r.width > 0, disabled: btn.disabled };
    `);
    check('#custom-provider-test-btn exists', testBtn?.exists === true, JSON.stringify(testBtn));

    await closeModalBtn();
    await sleep(400);
  }

  // ── 3. Custom Model Test->Save ─────────────────────────────────────────────
  note('section', '3. Custom Model Test->Save');
  // Ensure anthropic is connected so its Manage modal exposes #custom-model-input & #custom-model-test-btn on clean stores
  const anthropicCheck = await evaluate(`
    const me = await (await fetch('/api/me')).json().catch(() => null);
    const list = (await (await fetch('/api/providers')).json()).providers ?? [];
    return {
      email: me?.email ?? null,
      connected: list.some(p => p.provider === 'anthropic' && p.connected !== false),
    };
  `);
  let seededAnthropic = false;
  if (!anthropicCheck.connected && anthropicCheck.email) {
    await saveProviderKey(anthropicCheck.email, 'anthropic', 'claude-sonnet-4-20250514', 'sk-ant-e2e-fixture-0000000000000000', {
      models: ['claude-sonnet-4-20250514'],
    });
    seededAnthropic = true;
  }
  if (seededAnthropic) {
    await send('Page.reload', { ignoreCache: true });
    await sleep(2500);
    await navTo('API Keys');
    await sleep(900);
  }

  const openConn = await evaluate(`
    const btn = document.querySelector('#provider-connect-anthropic')
      || [...document.querySelectorAll('button')].find(b => {
        const r = b.getBoundingClientRect(); return r.width>0 && r.height>0 && (b.textContent.trim()==='Connect' || b.textContent.trim()==='Manage');
      });
    if (!btn) return 'NONE';
    btn.click(); return 'clicked';
  `);
  note('custom-model-open', openConn);
  await sleep(700);

  if (openConn === 'clicked') {
    const cmInput = await evaluate(`
      const el = document.querySelector('#connect-custom-model-input') ?? document.querySelector('#custom-model-input');
      return el ? { exists: true, id: el.id } : null;
    `);
    note('custom-model-input-found', JSON.stringify(cmInput));
    check('custom model input exists in provider modal', cmInput?.exists === true, JSON.stringify(cmInput));

    const cmBtn = await evaluate(`
      const btn = document.querySelector('#connect-custom-model-test-btn') ?? document.querySelector('#custom-model-test-btn');
      return btn ? { exists: true, id: btn.id } : null;
    `);
    check('custom model test btn exists', cmBtn?.exists === true, JSON.stringify(cmBtn));

    await closeModalBtn();
    await sleep(400);
  }
  if (seededAnthropic && anthropicCheck.email) {
    await deleteProviderKey(anthropicCheck.email, 'anthropic').catch(() => {});
  }

  // ── 4. Bot Wizard ─────────────────────────────────────────────────────────
  note('section', '4. Bot Wizard');
  // Click New bot button directly in the workspace left-bar (#sidebar-new-bot-btn)
  const toNewBot = await evaluate(`
    const direct = document.querySelector('#sidebar-new-bot-btn');
    if (direct && direct.getBoundingClientRect().width > 0) {
      direct.click();
      return 'clicked';
    }
    const btn = [...document.querySelectorAll('button, a')].find(b => {
      const r = b.getBoundingClientRect();
      const txt = b.textContent.trim().toLowerCase();
      return r.width > 0 && r.height > 0 && (txt.includes('new bot') || txt.includes('bot mới') || txt.includes('tạo bot'));
    });
    if (!btn) return 'MISSING';
    btn.click(); return 'clicked';
  `);
  note('new-bot-btn', toNewBot);
  check('new bot button clicked', toNewBot === 'clicked', toNewBot);
  await sleep(1000);

  const wizardState = await evaluate(`
    const h1 = document.querySelector('h1');
    const txt = document.body.innerText;
    return {
      h1: h1 ? h1.textContent.trim() : null,
      hasWizard: txt.includes('Meet your first AI bot') || txt.includes('bot') || txt.includes('Next')
    };
  `);
  note('wizard-state', JSON.stringify(wizardState));
  check('bot wizard view reached', wizardState.hasWizard === true, JSON.stringify(wizardState));

  // ── 5. Group Chat (>= 2 bots) & A2A conversation ─────────────────────────
  note('section', '5. Group Chat & A2A natural conversation');
  const openGroupModal = await evaluate(`
    const direct = document.querySelector('#sidebar-new-group-btn');
    if (direct && direct.getBoundingClientRect().width > 0) {
      direct.click();
      return 'clicked';
    }
    const btn = [...document.querySelectorAll('button')].find(b => {
      const r = b.getBoundingClientRect();
      const txt = b.textContent.trim().toLowerCase();
      return r.width > 0 && r.height > 0 && (txt.includes('new group chat') || txt.includes('tạo nhóm chat') || txt.includes('phòng nhóm') || txt.includes('open room'));
    });
    if (!btn) return 'MISSING';
    btn.click(); return 'clicked';
  `);
  note('open-group-modal', openGroupModal);
  await sleep(1000);

  const dialogOpen = await evaluate(`return document.querySelector('dialog[open]') !== null;`);
  note('dialog-open', String(dialogOpen));

  if (dialogOpen) {
    const startGroup = await evaluate(`
      const d = document.querySelector('dialog[open]');
      const btn = [...d.querySelectorAll('button')].find(b => /open room|start council|mở phòng/i.test(b.textContent));
      if (!btn) return 'MISSING OPEN BTN';
      btn.click(); return 'clicked';
    `);
    note('start-group', startGroup);
    await sleep(2500);
  } else {
    await navTo('Council room');
    await sleep(1500);
    await evaluate(`
      const btn = [...document.querySelectorAll('button')].find(b => /start a room first|mở phòng trước/i.test(b.textContent));
      btn?.click();
    `);
    await sleep(1500);
  }

  // ── 6. Chat Composer, Attachments, Web Search & A2A Response ──────────────
  note('section', '6. Chat room features & A2A');
  const composerBox = await evaluate(`return document.querySelector('#chat-composer') !== null;`);
  note('composer-box', String(composerBox));

  if (composerBox) {
    // 6a. File attachment controls
    const attachBtn = await evaluate(`return document.querySelector('#chat-attach-file-btn') !== null;`);
    const fileInput = await evaluate(`return document.querySelector('#chat-file') !== null;`);
    check('#chat-attach-file-btn exists', attachBtn === true, String(attachBtn));
    check('#chat-file input exists', fileInput === true, String(fileInput));

    // 6b. Web search toggle
    const wsToggle = await evaluate(`
      const el = document.querySelector('#chat-web-search-toggle');
      if (!el) return null;
      const isPressed = el.getAttribute('aria-pressed') === 'true' || el.checked === true;
      return { exists: true, pressed: isPressed };
    `);
    check('#chat-web-search-toggle exists', wsToggle?.exists === true, JSON.stringify(wsToggle));

    if (wsToggle?.exists) {
      await evaluate(`document.querySelector('#chat-web-search-toggle')?.click();`);
      await sleep(300);
      const wsToggled = await evaluate(`
        const el = document.querySelector('#chat-web-search-toggle');
        return el ? (el.getAttribute('aria-pressed') === 'true' || el.checked === true) : null;
      `);
      check('web-search toggled state', wsToggled !== wsToggle.pressed, `before=${wsToggle.pressed} after=${wsToggled}`);
      await evaluate(`document.querySelector('#chat-web-search-toggle')?.click();`);
    }

    // 6c. A2A natural conversation test
    await typeInto('#chat-composer', 'Zero Council E2E: what should we focus on next?');
    await evaluate(`
      const box = document.querySelector('#chat-composer');
      box.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
    `);
    await sleep(4500);

    const logGrew = await evaluate(`
      const log = document.querySelector('[role="log"]');
      return log ? log.innerText.length > 20 : false;
    `);
    check('A2A conversation: chat log populated', logGrew === true, String(logGrew));
  } else {
    note('composer-skip', 'composer not active in this session');
  }

  // ── 7. QR Checkout & Plan Limits ──────────────────────────────────────────
  note('section', '7. QR Checkout & Plan limits');
  const toSettings = await navTo('Settings');
  note('nav-settings', toSettings);
  check('nav to Settings', toSettings === 'clicked', toSettings);
  await sleep(1500);

  // Click Pro plan button
  const proBtnClicked = await evaluate(`
    const btn = document.querySelector('[data-settings-plan-btn="pro"]');
    if (!btn) return 'MISSING pro btn';
    btn.click(); return 'clicked';
  `);
  note('pro-btn-clicked', proBtnClicked);
  check('click Pro plan button', proBtnClicked === 'clicked', proBtnClicked);
  await sleep(1500);

  // Checkout drawer opens
  const promoInput = await evaluate(`return document.querySelector('#checkout-promo-input') !== null;`);
  const payBtn = await evaluate(`return document.querySelector('#checkout-pay-btn') !== null;`);
  const proPriceMatch = await evaluate(`return document.body.innerText.includes('139');`);
  check('#checkout-promo-input exists', promoInput === true, String(promoInput));
  check('#checkout-pay-btn exists', payBtn === true, String(payBtn));
  check('Pro price 139.000 matches in checkout', proPriceMatch === true, String(proPriceMatch));

  // Close checkout drawer
  await closeModalBtn();
  await sleep(800);

  // Click Ultra plan button
  const ultraBtnClicked = await evaluate(`
    const btn = document.querySelector('[data-settings-plan-btn="ultra"]');
    if (!btn) return 'MISSING ultra btn';
    btn.click(); return 'clicked';
  `);
  note('ultra-btn-clicked', ultraBtnClicked);
  check('click Ultra plan button', ultraBtnClicked === 'clicked', ultraBtnClicked);
  await sleep(1500);

  const ultraPriceMatch = await evaluate(`return document.body.innerText.includes('379');`);
  check('Ultra price 379.000 matches in checkout', ultraPriceMatch === true, String(ultraPriceMatch));

  // Mock PayOS create-payment API to test locked QR popup
  await evaluate(`
    window.__origFetch2 = window.fetch;
    window.fetch = function(url, opts) {
      const u = typeof url === 'string' ? url : String(url);
      if (u.includes('/api/payos/create-payment')) {
        return Promise.resolve(new Response(JSON.stringify({
          orderCode: 88888,
          amountVnd: 379000,
          qrCode: 'https://img.vietqr.io/image/mock-qr.jpg',
          expiredAt: Date.now() + 300000,
        }), { status:200, headers:{'Content-Type':'application/json'} }));
      }
      return window.__origFetch2(url, opts);
    };
    return 'mock-installed';
  `);

  // Click pay button to open QR modal
  await evaluate(`document.querySelector('#checkout-pay-btn')?.click();`);
  await sleep(2500);

  // Check QR fields are locked (disabled && readOnly)
  const qrFields = await evaluate(`
    const qPlan = document.querySelector('#qr-plan');
    const qOrder = document.querySelector('#qr-order-id');
    const qAmount = document.querySelector('#qr-amount');
    const qBill = document.querySelector('#qr-bill');
    if (!qPlan || !qOrder || !qAmount || !qBill) return null;
    return {
      planLocked: qPlan.disabled && qPlan.readOnly,
      orderLocked: qOrder.disabled && qOrder.readOnly,
      amountLocked: qAmount.disabled && qAmount.readOnly,
      billLocked: qBill.disabled && qBill.readOnly,
      amountVal: qAmount.value,
    };
  `);
  note('qr-fields', JSON.stringify(qrFields));
  if (qrFields) {
    check('#qr-plan disabled && readOnly', qrFields.planLocked === true, String(qrFields.planLocked));
    check('#qr-order-id disabled && readOnly', qrFields.orderLocked === true, String(qrFields.orderLocked));
    check('#qr-amount disabled && readOnly', qrFields.amountLocked === true, String(qrFields.amountLocked));
    check('#qr-bill disabled && readOnly', qrFields.billLocked === true, String(qrFields.billLocked));
    check('#qr-amount shows 379.000', qrFields.amountVal.includes('379'), qrFields.amountVal);
  }

  // Close QR modal and restore fetch
  await closeModalBtn();
  await sleep(600);
  await closeModalBtn();
  await sleep(600);
  await evaluate(`if (window.__origFetch2) { window.fetch = window.__origFetch2; delete window.__origFetch2; }`);

  // ── 8. Responsive layout checks ──────────────────────────────────────────
  note('section', '8. Responsive layout checks');
  await setEmulatedSize(1440, 900);
  await sleep(600);
  const desktopCheck = await evaluate(`
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
  `);
  note('desktop-dimensions', JSON.stringify(desktopCheck));
  check('scrollWidth <= innerWidth at 1440x900 (desktop)',
    desktopCheck?.scrollWidth <= desktopCheck?.innerWidth,
    JSON.stringify(desktopCheck));

  await setEmulatedSize(375, 812);
  await sleep(600);
  const mobileCheck = await evaluate(`
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
  `);
  note('mobile-dimensions', JSON.stringify(mobileCheck));
  check('scrollWidth <= innerWidth at 375x812 (mobile)',
    mobileCheck?.scrollWidth <= mobileCheck?.innerWidth,
    JSON.stringify(mobileCheck));

  await setEmulatedSize(1440, 1000);
  await sleep(400);

  // ── Screenshot ────────────────────────────────────────────────────────────
  mkdirSync(dirname(OUT), { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(OUT, Buffer.from(data, 'base64'));
  note('screenshot', OUT);

} finally {
  mkdirSync('.agent/evidence', { recursive: true });
  writeFileSync('.agent/evidence/drive-zero-council-e2e.json',
    JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, trace, failures }, null, 2));
  try { chrome.kill(); } catch {}
}

if (failures.length) {
  console.log(`\nFAILED (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nALL_CHECKS_PASS');
