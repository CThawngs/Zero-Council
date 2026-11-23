/**
 * drive-seo.mjs — Real Headless Chrome + Anonymous HTTP Crawler E2E for Zero Council SEO/GEO.
 *
 * Usage: node tests/drive-seo.mjs [baseUrl] [outPng]
 * Must be executed against a server started WITHOUT ZC_DEV_LOGIN_EMAIL so anonymous
 * crawler / social unfurler behavior (Googlebot, Facebook, Zalo, X, Discord, AI crawlers)
 * is verified end-to-end with zero 307 /auth redirects on public endpoints.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3328';
const OUT = process.argv[3] ?? '';
const CDP_PORT = 9342;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\nguye\\AppData\\Local\\Temp\\zc-chrome-seo-' + Date.now();

const LEGAL_SLUGS = [
  'terms',
  'privacy',
  'refund',
  'cookies',
  'acceptable-use',
  'disclaimer',
  'contact',
];

const failures = [];
function check(label, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(`${label}: ${detail}`);
}

function readPngDimensions(buf) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A, followed by IHDR length(4), 'IHDR'(4), width(4 BE), height(4 BE)
  if (
    buf.length < 24 ||
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

// ── Phase 1: Raw HTTP Crawler & Unfurler Audit (redirect: 'manual') ─────────
console.log('=== Phase 1: Anonymous Crawler & Social Unfurler HTTP Audit ===');

async function rawGet(relPath) {
  return fetch(`${BASE}${relPath}`, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  });
}

// 1.1 Home EN & VI
{
  const resEn = await rawGet('/');
  const htmlEn = await resEn.text();
  check('GET / returns 200 (no 307 /auth)', resEn.status === 200, `status=${resEn.status}`);
  check('GET / has <html lang="en">', /<html[^>]*lang="en"/i.test(htmlEn));
  check('GET / has <title>', /<title>Zero Council[^<]+<\/title>/i.test(htmlEn));
  check('GET / has meta description', /<meta[^>]+name="description"[^>]+content="[^"]{40,}"/i.test(htmlEn));
  check('GET / has canonical link', /<link[^>]+rel="canonical"/i.test(htmlEn));
  check('GET / has hreflang en/vi/x-default',
    htmlEn.includes('hrefLang="en"') || htmlEn.includes('hreflang="en"'),
    'hreflang present'
  );
  check('GET / has og:image & twitter:card',
    htmlEn.includes('property="og:image"') && htmlEn.includes('name="twitter:card"') && htmlEn.includes('summary_large_image'),
    'OG + Twitter summary_large_image present'
  );
  check('GET / has JSON-LD #zc-home-jsonld', htmlEn.includes('id="zc-home-jsonld"') && htmlEn.includes('application/ld+json'));

  const resVi = await rawGet('/?lang=vi');
  const htmlVi = await resVi.text();
  check('GET /?lang=vi returns 200', resVi.status === 200, `status=${resVi.status}`);
  check('GET /?lang=vi renders <html lang="vi">', /<html[^>]*lang="vi"/i.test(htmlVi));
  check('GET /?lang=vi renders Vietnamese <title>', htmlVi.includes('Hội đồng AI đa tác nhân'));
  check('GET /?lang=vi renders og:locale vi_VN', htmlVi.includes('vi_VN'));
}

// 1.2 Guide EN & VI
{
  const resGuide = await rawGet('/guide');
  const htmlGuide = await resGuide.text();
  check('GET /guide returns 200', resGuide.status === 200, `status=${resGuide.status}`);
  check('GET /guide has Guide H1 & Breadcrumb JSON-LD',
    htmlGuide.includes('How to use Zero Council') && htmlGuide.includes('BreadcrumbList'),
    'SSR guide content + BreadcrumbList present'
  );

  const resGuideVi = await rawGet('/guide?lang=vi');
  const htmlGuideVi = await resGuideVi.text();
  check('GET /guide?lang=vi returns 200 in Vietnamese',
    resGuideVi.status === 200 && htmlGuideVi.includes('Cách dùng Zero Council'),
    `status=${resGuideVi.status}`
  );
}

// 1.3 All 7 Legal Routes + Invalid Slug 404
for (const slug of LEGAL_SLUGS) {
  const res = await rawGet(`/legal/${slug}`);
  const html = await res.text();
  check(
    `GET /legal/${slug} returns 200 with canonical & BreadcrumbList`,
    res.status === 200 && html.includes(`/legal/${slug}`) && html.includes('BreadcrumbList'),
    `status=${res.status}`
  );
}
{
  const resLegalVi = await rawGet('/legal/privacy?lang=vi');
  const htmlLegalVi = await resLegalVi.text();
  check(
    'GET /legal/privacy?lang=vi returns 200 with Vietnamese title',
    resLegalVi.status === 200 && htmlLegalVi.includes('Chính sách quyền riêng tư'),
    `status=${resLegalVi.status}`
  );

  const res404 = await rawGet('/legal/definitely-not-a-legal-doc');
  check('GET /legal/definitely-not-a-legal-doc returns 404', res404.status === 404, `status=${res404.status}`);
}

// 1.4 robots.txt, sitemap.xml, manifest.webmanifest, llms.txt
{
  const resRobots = await rawGet('/robots.txt');
  const txtRobots = await resRobots.text();
  check(
    'GET /robots.txt returns 200 text/plain with rules + Sitemap',
    resRobots.status === 200 &&
      (resRobots.headers.get('content-type') ?? '').includes('text/plain') &&
      txtRobots.includes('Disallow: /dashboard') &&
      txtRobots.includes('/sitemap.xml'),
    `status=${resRobots.status}`
  );

  const resSitemap = await rawGet('/sitemap.xml');
  const xmlSitemap = await resSitemap.text();
  const hasAllSlugs = LEGAL_SLUGS.every((s) => xmlSitemap.includes(`/legal/${s}`));
  check(
    'GET /sitemap.xml returns 200 XML with /, /guide, 7 /legal/* and hreflang',
    resSitemap.status === 200 &&
      (resSitemap.headers.get('content-type') ?? '').includes('xml') &&
      xmlSitemap.includes('/guide') &&
      hasAllSlugs &&
      xmlSitemap.includes('hreflang="vi"'),
    `status=${resSitemap.status}`
  );

  const resManifest = await rawGet('/manifest.webmanifest');
  const jsonManifest = await resManifest.json();
  check(
    'GET /manifest.webmanifest returns 200 JSON manifest',
    resManifest.status === 200 &&
      jsonManifest.short_name === 'Zero Council' &&
      Array.isArray(jsonManifest.icons) &&
      jsonManifest.icons.length >= 2,
    `status=${resManifest.status}`
  );

  const resLlms = await rawGet('/llms.txt');
  const txtLlms = await resLlms.text();
  check(
    'GET /llms.txt returns 200 text/plain UTF-8 with providers & pricing',
    resLlms.status === 200 &&
      (resLlms.headers.get('content-type') ?? '').toLowerCase().includes('text/plain') &&
      txtLlms.includes('# Zero Council') &&
      txtLlms.includes('AES-256') &&
      txtLlms.includes('139,000 VND/month'),
    `status=${resLlms.status}, bytes=${txtLlms.length}`
  );
}

// 1.5 Social Unfurling Cards & Brand Icons (icon.svg, apple-icon, opengraph-image, twitter-image)
{
  const resIcon = await rawGet('/icon.svg');
  const svgIcon = await resIcon.text();
  check(
    'GET /icon.svg returns 200 image/svg+xml',
    resIcon.status === 200 &&
      (resIcon.headers.get('content-type') ?? '').includes('image/svg+xml') &&
      svgIcon.includes('<svg'),
    `status=${resIcon.status}`
  );

  const resApple = await rawGet('/apple-icon');
  const bufApple = Buffer.from(await resApple.arrayBuffer());
  const dimApple = readPngDimensions(bufApple);
  check(
    'GET /apple-icon returns valid 180x180 image/png',
    resApple.status === 200 &&
      (resApple.headers.get('content-type') ?? '').includes('image/png') &&
      dimApple?.width === 180 &&
      dimApple?.height === 180,
    `status=${resApple.status}, dim=${JSON.stringify(dimApple)}, bytes=${bufApple.length}`
  );

  for (const cardPath of ['/opengraph-image', '/twitter-image']) {
    const resCard = await rawGet(cardPath);
    const bufCard = Buffer.from(await resCard.arrayBuffer());
    const dimCard = readPngDimensions(bufCard);
    check(
      `GET ${cardPath} returns valid 1200x630 image/png`,
      resCard.status === 200 &&
        (resCard.headers.get('content-type') ?? '').includes('image/png') &&
        dimCard?.width === 1200 &&
        dimCard?.height === 630 &&
        bufCard.length > 5000,
      `status=${resCard.status}, dim=${JSON.stringify(dimCard)}, bytes=${bufCard.length}`
    );
  }
}

// 1.6 Private / Auth / Transactional Routes: noindex + auth redirect
{
  for (const noindexRoute of ['/auth', '/auth/auth-code-error', '/checkout/return']) {
    const res = await rawGet(noindexRoute);
    const html = await res.text();
    const robotsMatch = html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/i);
    const robotsContent = robotsMatch ? robotsMatch[1].toLowerCase() : '';
    check(
      `GET ${noindexRoute} has meta robots noindex, nofollow`,
      res.status === 200 && robotsContent.includes('noindex') && robotsContent.includes('nofollow'),
      `status=${res.status}, robots="${robotsContent}"`
    );
  }

  const resDash = await rawGet('/dashboard');
  check(
    'Anonymous GET /dashboard redirects 307 to /auth',
    resDash.status === 307 && (resDash.headers.get('location') ?? '').includes('/auth'),
    `status=${resDash.status}, location=${resDash.headers.get('location')}`
  );
}

// ── Phase 2: Real Headless Chrome DOM, JSON-LD, Interactive Links & Overflow Audit ──
console.log('\n=== Phase 2: Real Chrome DOM, JSON-LD Parity & Responsive Audit ===');

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${CDP_PORT}`,
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

const cleanupChrome = () => {
  try {
    chrome.kill();
  } catch {}
  setTimeout(() => {
    try {
      rmSync(PROFILE, { recursive: true, force: true });
    } catch {}
  }, 500);
};
process.on('exit', cleanupChrome);

async function cdpTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not start');
}

const ws = new WebSocket(await cdpTarget());
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let seq = 0;
const pending = new Map();
const runtimeErrors = [];

ws.addEventListener('message', (ev) => {
  const frame = JSON.parse(ev.data);
  if (frame.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(frame.params?.exceptionDetails?.text ?? 'exceptionThrown');
  }
  if (frame.method === 'Runtime.consoleAPICalled' && frame.params?.type === 'error') {
    const msg = (frame.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (!msg.includes('favicon.ico')) {
      runtimeErrors.push(msg);
    }
  }
  const entry = pending.get(frame.id);
  if (!entry) return;
  pending.delete(frame.id);
  frame.error ? entry.reject(new Error(JSON.stringify(frame.error))) : entry.resolve(frame.result);
});

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    seq += 1;
    pending.set(seq, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await sleep(180);
}

async function evaluate(expr) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(async () => { ${expr} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(`Eval exception: ${JSON.stringify(exceptionDetails)}`);
  }
  return result?.value;
}

async function goto(urlPath) {
  await send('Page.navigate', { url: `${BASE}${urlPath}` });
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    const ready = await evaluate(`return document.readyState === 'complete' && Boolean(document.querySelector('main'))`);
    if (ready) break;
  }
  await sleep(300);
}

// 2.1 Home Page JSON-LD <-> Visible <details> FAQ 1:1 Parity + Crawlable Footer Links + Overflow
await setViewport(1440, 900);
await goto('/');

const homeDomAudit = await evaluate(`
  const scriptEl = document.getElementById('zc-home-jsonld');
  const parsed = scriptEl ? JSON.parse(scriptEl.textContent) : null;
  const faqEntity = parsed?.['@graph']?.find((n) => n['@type'] === 'FAQPage')?.mainEntity ?? [];
  const detailsEls = Array.from(document.querySelectorAll('#faq details'));
  const visibleFaq = detailsEls.map((el) => ({
    q: el.querySelector('summary span')?.textContent?.trim() ?? '',
    a: el.querySelector('p')?.textContent?.trim() ?? '',
  }));

  // Toggle second details item open and verify interactive state
  const second = detailsEls[1];
  const wasOpen = second ? second.open : null;
  if (second) second.querySelector('summary').click();
  const nowOpen = second ? second.open : null;

  const footerHrefs = Array.from(document.querySelectorAll('footer a[href]')).map((a) =>
    a.getAttribute('href')
  );
  const cookieLinkHref = document.querySelector('[role="region"] a[href]')?.getAttribute('href') ?? null;

  return {
    title: document.title,
    faqJsonCount: faqEntity.length,
    visibleFaqCount: visibleFaq.length,
    faqExactMatch:
      faqEntity.length === visibleFaq.length &&
      faqEntity.every(
        (item, idx) =>
          item.name === visibleFaq[idx].q && item.acceptedAnswer?.text === visibleFaq[idx].a
      ),
    detailsToggleWorked: wasOpen === false && nowOpen === true,
    footerHrefs,
    cookieLinkHref,
  };
`);

check(
  'Home JSON-LD FAQPage matches visible <details> FAQ 1:1 (6 Q&As)',
  homeDomAudit.faqJsonCount === 6 && homeDomAudit.faqExactMatch,
  JSON.stringify({
    faqJsonCount: homeDomAudit.faqJsonCount,
    visibleFaqCount: homeDomAudit.visibleFaqCount,
    faqExactMatch: homeDomAudit.faqExactMatch,
  })
);
check('Home <details> FAQ summary click toggles open state', homeDomAudit.detailsToggleWorked);
check(
  'Footer exposes crawlable <a href="/guide"> and all 7 <a href="/legal/*">',
  homeDomAudit.footerHrefs.includes('/guide') &&
    LEGAL_SLUGS.every((s) => homeDomAudit.footerHrefs.includes(`/legal/${s}`)),
  `hrefs=${homeDomAudit.footerHrefs.join(',')}`
);
check(
  'CookieNotice exposes crawlable <a href="/legal/cookies">',
  homeDomAudit.cookieLinkHref === '/legal/cookies',
  `cookieLinkHref=${homeDomAudit.cookieLinkHref}`
);

// Check responsive overflow at 320x640 and 1440x900 across Light/Dark and EN/VI on /
for (const [w, h] of [
  [320, 640],
  [1440, 900],
]) {
  await setViewport(w, h);
  for (const theme of ['light', 'dark']) {
    const metrics = await evaluate(`
      document.documentElement.setAttribute('data-theme', '${theme}');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    `);
    check(
      `Home / responsive (${w}x${h}, ${theme}) has zero horizontal overflow`,
      metrics.scrollWidth <= metrics.innerWidth,
      `scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth}`
    );
  }
}

// 2.2 Navigate via Footer <a href="/guide"> and verify hydration title preservation + VI toggle + 320px overflow
await setViewport(1440, 900);
await evaluate(`
  document.querySelector('footer a[href="/guide"]').click();
`);
for (let i = 0; i < 30; i++) {
  await sleep(150);
  const pathNow = await evaluate(`return window.location.pathname`);
  if (pathNow === '/guide') break;
}
await sleep(300);

const guideAudit = await evaluate(`
  return {
    pathname: window.location.pathname,
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
  };
`);
check(
  'Client navigation to /guide renders Guide H1 and preserves Guide document.title',
  guideAudit.pathname === '/guide' &&
    guideAudit.title.includes('How to use Zero Council') &&
    guideAudit.h1 === 'How to use Zero Council',
  JSON.stringify(guideAudit)
);

await setViewport(320, 640);
const guideMobile = await evaluate(`
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
`);
check(
  'Guide /guide responsive (320x640) has zero horizontal overflow',
  guideMobile.scrollWidth <= guideMobile.innerWidth,
  `scrollWidth=${guideMobile.scrollWidth}, innerWidth=${guideMobile.innerWidth}`
);

// 2.3 Direct visit to /legal/privacy?lang=vi and cross-link click to /legal/terms
await setViewport(1440, 900);
await goto('/legal/privacy?lang=vi');
const legalViAudit = await evaluate(`
  return {
    pathname: window.location.pathname,
    htmlLang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
  };
`);
check(
  'Direct visit /legal/privacy?lang=vi keeps Vietnamese lang, H1 & document.title after hydration',
  legalViAudit.pathname === '/legal/privacy' &&
    legalViAudit.htmlLang === 'vi' &&
    legalViAudit.title.includes('Chính sách quyền riêng tư') &&
    legalViAudit.h1.includes('Chính sách quyền riêng tư'),
  JSON.stringify(legalViAudit)
);

await setViewport(320, 640);
const legalMobile = await evaluate(`
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
`);
check(
  'Legal /legal/privacy?lang=vi responsive (320x640) has zero horizontal overflow',
  legalMobile.scrollWidth <= legalMobile.innerWidth,
  `scrollWidth=${legalMobile.scrollWidth}, innerWidth=${legalMobile.innerWidth}`
);

if (OUT) {
  await setViewport(1440, 900);
  await goto('/');
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`Saved screenshot to ${OUT}`);
}

check(
  'Zero Chrome runtime / console errors across SEO flow',
  runtimeErrors.length === 0,
  runtimeErrors.join(' | ')
);

ws.close();
cleanupChrome();

if (failures.length > 0) {
  console.error(`\nSEO E2E FAILED (${failures.length} failure(s)):`);
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nALL SEO & DISCOVERABILITY E2E CHECKS PASSED!');
