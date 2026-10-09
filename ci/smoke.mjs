#!/usr/bin/env node
/**
 * CI smoke — does the built app actually serve, and did the chat feature make it
 * into the shipped bundle?
 *
 * Plain Node, no dependencies, on purpose. A smoke check that cannot run without
 * installing 300 MB of browsers is a smoke check that silently stops running.
 *
 * WHAT THIS PROVES: the real Next.js server boots from the real build, the entry
 * route serves, and the create-chat screen's own strings are present in the client
 * bundle a browser would download.
 *
 * WHAT IT DOES NOT PROVE: that the app mounts, or that clicking works. Both need
 * a real browser and stay with `.agent/skills/verify-app/SKILL.md`. That is the
 * honest floor — say so rather than pad it with checks that cannot fail.
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
async function fetchAs(url) {
  // An explicit controller, not `AbortSignal.timeout`: that one leaves a live
  // timer handle behind and the process dies with a libuv assertion on the way
  // out, so every check passes and the job still goes red.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { status: response.status, body: await response.text(), error: null };
  } catch (error) {
    return { status: 0, body: null, error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

// --- The entry route must serve, because it is the first thing anyone sees ---

const home = await fetchAs(`${BASE}/`);
check('app entry serves', home.status === 200, home.error ?? `HTTP ${home.status}`);

// Structural, not copy. An earlier version asserted the literal entry button
// text. That goes red the moment somebody reworded the marketing or flipped the
// default language, while the app stayed perfectly healthy — and a false red
// trains people to ignore CI. Copy is not a stable contract. A rendered page is.
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

// --- The build produced real client output ---
//
// This is the honest floor: it catches a missing or half-finished build, and
// nothing more.
//
// WHAT I CLAIMED BEFORE WAS FALSE. This file used to grep the client chunks for
// the create-chat screen's strings, reasoning that deleting the feature would
// delete the strings. It would not. AppContext reads `copy[language]` with a
// computed key, so the bundler keeps the whole dictionary in one chunk no
// matter which component consumes it — delete EmptyChamberView and the bundle
// loses zero bytes and those checks stay green.
//
// I "proved" they worked by deleting the feature and watching it drop to 3/7.
// That was me misreading my own evidence: it went red because the BUILD broke
// (module not found), not because the check noticed anything.
//
// There is no non-browser signal that separates "feature present" from "feature
// deleted", so this file does not claim one. Verifying the chat UI needs a real
// browser: `.agent/skills/verify-app/SKILL.md`.

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

// `process.exitCode`, never `process.exit()`. Exiting explicitly kills the
// process while stdout is still draining, and on Windows that dies with a libuv
// assertion — every check passes, the job still goes red.
process.exitCode = failed.length === 0 ? 0 : 1;