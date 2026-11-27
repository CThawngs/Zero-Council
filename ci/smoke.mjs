#!/usr/bin/env node
/**
 * CI smoke — does the built app actually serve, expose health readiness + security
 * headers, and ship real client chunks?
 *
 * Plain Node, no dependencies, on purpose. A smoke check that cannot run without
 * installing 300 MB of browsers is a smoke check that silently stops running.
 *
 * Usage: node ci/smoke.mjs <base-url> <out-dir> <build-dir>
 */

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8803';
const OUT = process.argv[3] ?? 'evidence';
const BUILD = process.argv[4] ?? join('web', '.next');

const checks = [];

const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  return ok;
};

/** One fetch that never throws: a failing route is a failing check, not a crash. */
async function fetchAs(url, init = {}) {
  // An explicit controller, not `AbortSignal.timeout`: that one leaves a live
  // timer handle behind and the process dies with a libuv assertion on the way
  // out, so every check passes and the job still goes red.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const headers = Object.fromEntries(response.headers.entries());
    return { status: response.status, headers, body: await response.text(), url: response.url, error: null };
  } catch (error) {
    return { status: 0, headers: {}, body: null, error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

// --- The entry route must serve, because it is the first thing anyone sees ---

const home = await fetchAs(`${BASE}/`);
check('app entry serves', home.status === 200, home.error ?? `HTTP ${home.status}`);

const body = typeof home.body === 'string' ? home.body : '';
check(
  'entry renders a whole document',
  body.includes('</html>') && body.length > 2000,
  `${body.length} bytes, has </html>: ${body.includes('</html>')}`
);
check(
  'entry is not an error page',
  !body.includes('Application error') && !body.includes('Internal Server Error'),
  'a crash must not be served as a healthy 200'
);

const xcto = home.headers['x-content-type-options'] ?? '';
const xfo = home.headers['x-frame-options'] ?? '';
check(
  'entry includes security headers',
  xcto === 'nosniff' && xfo === 'DENY',
  `x-content-type-options=${xcto || 'missing'}, x-frame-options=${xfo || 'missing'}`
);

// --- Health readiness endpoint ---

const health = await fetchAs(`${BASE}/api/health`);
let healthPayload = null;
try {
  healthPayload = health.body ? JSON.parse(health.body) : null;
} catch {
  healthPayload = null;
}
check(
  'health endpoint reports ok',
  health.status === 200 && healthPayload?.status === 'ok',
  health.error ?? `HTTP ${health.status}, status=${healthPayload?.status ?? 'invalid-json'}`
);

// --- Publicly missing fixture routes must not be redirected to authentication ---

for (const pathname of ['/fixture', '/council-fixture', '/api/council']) {
  const response = await fetchAs(`${BASE}${pathname}`, { redirect: 'manual' });
  check(
    `${pathname} stays not found`,
    response.status === 404,
    response.error ?? `HTTP ${response.status}${response.headers.location ? ` -> ${response.headers.location}` : ''}`
  );
}

const unknownPage = await fetchAs(`${BASE}/__qa-route-that-does-not-exist`, { redirect: 'manual' });
check(
  'unknown page stays not found',
  unknownPage.status === 404,
  unknownPage.error ?? `HTTP ${unknownPage.status}${unknownPage.headers.location ? ` -> ${unknownPage.headers.location}` : ''}`
);

for (const pathname of ['/dashboard', '/admin']) {
  const response = await fetchAs(`${BASE}${pathname}`, { redirect: 'manual' });
  check(
    `${pathname} stays behind authentication`,
    response.status === 307 && response.headers.location?.includes('/auth'),
    response.error ?? `HTTP ${response.status}${response.headers.location ? ` -> ${response.headers.location}` : ''}`
  );
}

// --- Same-origin language preference can be changed and remains client-readable ---

const languageOrigin = new URL(BASE).origin;
const language = await fetchAs(`${BASE}/api/language`, {
  method: 'POST',
  headers: { Origin: languageOrigin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ language: 'vi' }),
});
const languageCookie = language.headers['set-cookie'] ?? '';
check(
  'same-origin language preference can be saved',
  language.status === 200 && /(?:^|,\s*)zc-lang=vi(?:;|,|$)/i.test(languageCookie) && !/HttpOnly/i.test(languageCookie),
  language.error ?? `HTTP ${language.status}, readable cookie=${Boolean(languageCookie) && !/HttpOnly/i.test(languageCookie)}`
);

const crossSiteLanguage = await fetchAs(`${BASE}/api/language`, {
  method: 'POST',
  headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ language: 'en' }),
});
check(
  'cross-site language preference is rejected',
  crossSiteLanguage.status === 403,
  crossSiteLanguage.error ?? `HTTP ${crossSiteLanguage.status}`
);

// --- The build produced real client output ---

async function collectChunks(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collectChunks(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const chunks = await collectChunks(join(BUILD, 'static', 'chunks'));
check(
  'build produced client chunks',
  chunks.length > 0,
  `${chunks.length} chunks under ${BUILD}/static/chunks`
);

// --- Write the evidence, because a green tick is not something you can re-read ---

const failed = checks.filter((c) => !c.ok);
const stamp = new Date().toISOString();

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, 'ci-smoke.json'),
  `${JSON.stringify({ baseUrl: BASE, buildDir: BUILD, at: stamp, total: checks.length, failed: failed.length, checks }, null, 2)}\n`,
  'utf8'
);

await writeFile(
  join(OUT, 'ci-smoke.md'),
  [
    '# CI smoke evidence',
    '',
    `- base URL: \`${BASE}\``,
    `- build dir: \`${BUILD}\``,
    `- at: ${stamp}`,
    `- checks: ${checks.length - failed.length} passed, ${failed.length} failed`,
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
    ...checks.map((c) => `| ${c.name} | ${c.ok ? 'PASS' : '**FAIL**'} | ${c.detail ?? ''} |`),
    '',
    'Not covered here: that the app mounts, and that clicking works.',
    'Those need a real browser — see `.agent/skills/verify-app/SKILL.md`.',
    '',
  ].join('\n'),
  'utf8'
);

for (const c of checks) {
  process.stdout.write(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.detail ?? ''}`}\n`);
}
process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed. Evidence: ${OUT}/ci-smoke.md\n`);

process.exitCode = failed.length === 0 ? 0 : 1;
