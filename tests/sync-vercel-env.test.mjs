import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Chạy ĐÚNG file .github/scripts/sync-vercel-env.sh, không phải bản sao trong test.
 * Nhờ vậy logic dừng-sớm, dựng payload, URL và header đều có bằng chứng chạy thật.
 * Chưa kiểm chứng: Vercel thật trả gì. Cần chạy một lần sau khi có token.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, '.github', 'scripts', 'sync-vercel-env.sh').replace(/\\/g, '/');
const bash = 'C:/Program Files/Git/bin/bash.exe';

const SECRETS = {
  VERCEL_TOKEN: 'tok-secret',
  VERCEL_PROJECT: 'zero-council',
  PAYLOS_CLIENT_ID: 'cid',
  PAYLOS_API_KEY: 'key',
  PAYLOS_CHECKSUM_KEY: 'checksum',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb-secret',
};

/** Chạy script với env cho sẵn, trả { code, stdout, stderr }. */
const runScript = (env) =>
  new Promise((resolve) => {
    const child = spawn(bash, [script], {
      env: { ...process.env, ...env, VERCEL_API_BASE: env.VERCEL_API_BASE },
      cwd: root,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

/** HTTP server stub đóng vai Vercel, trả về request đã nhận. */
const stub = (status = 200) => {
  const seen = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? { created: true } : { error: { code: 'forbidden' } }));
    });
  });
  return { seen, server, listen: () => new Promise((r) => server.listen(0, '127.0.0.1', r)), close: () => new Promise((r) => server.close(r)) };
};

test('đẩy đúng 5 biến, dạng encrypted, chỉ target production', async () => {
  const s = stub(200);
  await s.listen();
  const { port } = s.server.address();
  const result = await runScript({ ...SECRETS, VERCEL_API_BASE: `http://127.0.0.1:${port}` });
  await s.close();

  assert.equal(result.code, 0, result.stderr);
  const [call] = s.seen;
  assert.equal(call.method, 'POST');
  assert.equal(call.url, '/v10/projects/zero-council/env?upsert=true');
  assert.equal(call.headers.authorization, 'Bearer tok-secret');

  const sent = JSON.parse(call.body);
  assert.ok(Array.isArray(sent), 'gửi một mảng trong một request, không phải 5 request');
  assert.deepEqual(sent.map((v) => v.key), [
    'PAYLOS_CLIENT_ID', 'PAYLOS_API_KEY', 'PAYLOS_CHECKSUM_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  ]);
  for (const v of sent) {
    assert.equal(v.type, 'encrypted', `${v.key} phải là encrypted, không phải readable trong UI Vercel`);
    assert.deepEqual(v.target, ['production'], `${v.key} không được lọt sang preview/dev`);
  }
  assert.equal(sent.find((v) => v.key === 'SUPABASE_SERVICE_ROLE_KEY').value, 'sb-secret');
  assert.ok(!result.stdout.includes('sb-secret'), 'không được in giá trị secret ra log');
  assert.ok(!result.stdout.includes('checksum'), 'không được in giá trị secret ra log');
});

test('project thuộc team thì gửi kèm teamId', async () => {
  const s = stub(200);
  await s.listen();
  const { port } = s.server.address();
  await runScript({ ...SECRETS, VERCEL_TEAM: 'team_abc', VERCEL_API_BASE: `http://127.0.0.1:${port}` });
  await s.close();
  assert.match(s.seen[0].url, /teamId=team_abc/);
});

test('thiếu một biến thì dừng, không gửi gì cả', async () => {
  const s = stub(200);
  await s.listen();
  const { port } = s.server.address();
  const env = { ...SECRETS, VERCEL_API_BASE: `http://127.0.0.1:${port}` };
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const result = await runScript(env);
  await s.close();

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.equal(s.seen.length, 0, 'không được đẩy nửa vời — 4 biến còn lại sẽ vào Vercel thiếu 1');
});

test('Vercel từ chối thì exit khác 0 và in lý do', async () => {
  const s = stub(403);
  await s.listen();
  const { port } = s.server.address();
  const result = await runScript({ ...SECRETS, VERCEL_API_BASE: `http://127.0.0.1:${port}` });
  await s.close();

  assert.notEqual(result.code, 0, 'phải fail chứ không phải báo thành công');
  assert.match(result.stderr, /403/);
  assert.match(result.stderr, /forbidden/, 'phải in body lỗi để biết vì sao, không đoán');
  assert.ok(!result.stderr.includes('sb-secret'), 'body lỗi không được chứa giá trị đã đẩy');
});

test('thư mục tạm chứa token phải được dọn sau khi chạy', async () => {
  const s = stub(200);
  await s.listen();
  const { port } = s.server.address();
  // Trỏ TMPDIR vào chỗ kiểm soát được để xem script có dọn hay không. Nếu còn sót,
  // thư mục này sẽ chứa file curl config với VERCEL_TOKEN nằm trong đó.
  const tmp = mkdtempSync(path.join(tmpdir(), 'zc-work-'));
  const before = readdirSync(tmp);
  const result = await runScript({ ...SECRETS, VERCEL_API_BASE: `http://127.0.0.1:${port}`, TMPDIR: tmp });
  await s.close();
  const left = readdirSync(tmp);
  rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(before, [], 'sanity: thư mục tạm phải rỗng ngay từ đầu');
  assert.deepEqual(left, [], 'script phải dọn hết file tạm chứa secret');
  assert.ok(!result.stdout.includes('tok-secret'), 'token không được in ra log');
});
