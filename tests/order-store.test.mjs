import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The Postgres path is exercised against a stub that speaks the same PostgREST contract
 * Supabase exposes (REST at /rest/v1/<table>, service-role key in apikey/Authorization,
 * Prefer: return=representation). This does not prove Supabase is configured — it proves
 * this file sends the right requests, maps rows both ways, and cannot demote a paid order.
 * Run against the real project before taking money.
 */

const row = (over = {}) => ({
  order_code: 100,
  plan_id: 'pro',
  amount_vnd: 139000,
  amount_usd: '5.99',
  status: 'PENDING',
  created_at: '2026-09-26T10:00:00.000Z',
  paid_at: null,
  reference: null,
  bank_account: null,
  ...over,
});

/** Stub PostgREST. `handler` sees every request and returns the body to answer with. */
const withStore = async (handler, run) => {
  const seen = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const call = { method: req.method, url: req.url, headers: req.headers, body };
      seen.push(call);
      const { status = 200, payload = [] } = handler(call) ?? {};
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests';
  try {
    return { seen, result: await run() };
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await new Promise((resolve) => server.close(resolve));
  }
};

/** Fresh module instance per test so the store never caches across env changes. */
const loadStore = async () => import(`../web/src/lib/payos/orders.ts?bust=${Math.random()}`);

test('putOrder posts a row to the table with the service role key', async () => {
  const { putOrder } = await loadStore();
  const { seen } = await withStore(() => ({ payload: [row()] }), () =>
    putOrder({ orderCode: 100, planId: 'pro', amountVnd: 139000, amountUsd: '5.99', status: 'PENDING', createdAt: '2026-09-26T10:00:00.000Z' })
  );
  const [call] = seen;
  assert.equal(call.method, 'POST');
  assert.match(call.url, /^\/rest\/v1\/zc_orders\?on_conflict=order_code$/);
  assert.equal(call.headers.apikey, 'service-role-key-for-tests');
  assert.equal(call.headers.authorization, 'Bearer service-role-key-for-tests');
  const sent = JSON.parse(call.body);
  assert.equal(sent.order_code, 100);
  assert.equal(sent.amount_vnd, 139000, 'amount is the integer VND figure, not a formatted string');
  assert.equal(sent.paid_at, null);
});

test('getOrder maps a row and returns null when the table is empty', async () => {
  const { getOrder } = await loadStore();
  const { result: found } = await withStore(() => ({ payload: [row({ status: 'PAID', paid_at: '2026-09-26T10:05:00.000Z', reference: 'FT123', bank_account: '9704' })] }), () => getOrder(100));
  assert.equal(found.planId, 'pro');
  assert.equal(found.status, 'PAID');
  assert.equal(found.paidAt, '2026-09-26T10:05:00.000Z');
  assert.equal(found.bankAccount, '9704');
  // Absent columns must not become `undefined` keys on the object the API returns.
  assert.equal('paidAt' in found, true);

  const { seen, result: missing } = await withStore(() => ({ payload: [] }), () => getOrder(404));
  assert.equal(missing, null);
  assert.match(seen[0].url, /order_code=eq\.404/);
});

test('markOrder never demotes a paid order, whatever arrives late', async () => {
  const { markOrder } = await loadStore();

  // A real transition: PENDING -> PAID sets paid_at.
  const paid = await withStore(() => ({ payload: [row({ status: 'PAID', paid_at: '2026-09-26T10:05:00.000Z' })] }), () => markOrder(100, 'PAID', { reference: 'FT123' }));
  const [write] = paid.seen;
  assert.equal(write.method, 'PATCH');
  assert.match(write.url, /status\.neq\.PAID$/, 'the terminal guard must be in the write, not only in the caller');
  const patch = JSON.parse(write.body);
  assert.equal(patch.status, 'PAID');
  assert.ok(patch.paid_at, 'a paid write must stamp paid_at');

  // A late FAILED webhook: the PATCH matches nothing, the existing row comes back untouched.
  const late = await withStore(
    (call) => (call.method === 'PATCH' ? { payload: [] } : { payload: [row({ status: 'PAID', paid_at: '2026-09-26T10:05:00.000Z' })] }),
    () => markOrder(100, 'FAILED')
  );
  assert.equal(late.result.status, 'PAID', 'a late failure must not revoke a real payment');
  assert.equal(late.seen.length, 2, 'no row updated, so the stored row is read back');

  // A late PENDING webhook used to be the dangerous one: the filter must refuse it too.
  const latePending = await withStore(
    (call) => (call.method === 'PATCH' ? { payload: [] } : { payload: [row({ status: 'PAID', paid_at: '2026-09-26T10:05:00.000Z' })] }),
    () => markOrder(100, 'PENDING')
  );
  assert.equal(latePending.result.status, 'PAID');
});

test('a schema mismatch reports the failing status and body instead of a bare error', async () => {
  const { getOrder } = await loadStore();
  await assert.rejects(
    () => withStore(() => ({ status: 400, payload: { message: 'column zc_orders.plan_id does not exist' } }), () => getOrder(100)),
    (error) => {
      assert.match(error.message, /SUPABASE_400/);
      assert.match(error.message, /plan_id does not exist/, 'the body is the only clue when the migration and this file drift apart');
      return true;
    }
  );
});

test('an ephemeral host without a database refuses the file store instead of losing orders', async () => {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.ZC_ORDER_STORE = path.join(tmpdir(), 'zc-orders-prod-guard.json');
  // VERCEL, not NODE_ENV: `next start` is a production build too and is how the app is
  // verified locally, so NODE_ENV would refuse the file in the one place it is needed.
  process.env.VERCEL = '1';
  try {
    const { putOrder } = await loadStore();
    await assert.rejects(
      () => putOrder({ orderCode: 1, planId: 'pro', amountVnd: 139000, amountUsd: '5.99', status: 'PENDING', createdAt: 'now' }),
      /SUPABASE_NOT_CONFIGURED/
    );
  } finally {
    process.env.VERCEL = '';
    process.env.ZC_ORDER_STORE = '';
  }
});

test('a local production build still uses the json file', async () => {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  const store = path.join(tmpdir(), `zc-orders-nextstart-${process.pid}.json`);
  process.env.ZC_ORDER_STORE = store;
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { putOrder, getOrder } = await loadStore();
    await putOrder({ orderCode: 8, planId: 'pro', amountVnd: 139000, amountUsd: '5.99', status: 'PENDING', createdAt: '2026-09-26T11:00:00.000Z' });
    assert.equal((await getOrder(8)).orderCode, 8, 'next start must keep working before Supabase exists');
  } finally {
    process.env.NODE_ENV = previous;
    process.env.ZC_ORDER_STORE = '';
    await import('node:fs/promises').then((fs) => fs.rm(store, { force: true }));
  }
});

test('local development without a database falls back to the json file', async () => {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  const store = path.join(tmpdir(), `zc-orders-dev-${process.pid}.json`);
  process.env.ZC_ORDER_STORE = store;
  try {
    const { putOrder, getOrder, markOrder } = await loadStore();
    const seed = { orderCode: 7, planId: 'ultra', amountVnd: 379000, amountUsd: '16.99', status: 'PENDING', createdAt: '2026-09-26T11:00:00.000Z' };
    await putOrder(seed);
    assert.equal((await getOrder(7)).amountVnd, 379000);
    assert.equal((await markOrder(7, 'PAID', { reference: 'FT9' })).status, 'PAID');
    assert.equal((await markOrder(7, 'FAILED')).status, 'PAID', 'terminal rule holds on the file path too');
  } finally {
    process.env.ZC_ORDER_STORE = '';
    await import('node:fs/promises').then((fs) => fs.rm(store, { force: true }));
  }
});
