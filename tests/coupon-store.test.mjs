// Env phải set TRƯỚC khi import store: STORE_PATH được đọc lúc module load.
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = mkdtempSync(path.join(tmpdir(), 'zc-coupon-'));
process.env.ZC_ACCOUNT_STORE = path.join(dir, 'account.json');
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  addGrant,
  addMonth,
  createCoupon,
  effectivePlan,
  ensureUser,
  getCoupon,
  redeemCoupon,
  setUserRole,
  listRedemptions,
} = await import('../web/src/lib/store/account.ts');
const { checkCoupon, amountAfterCoupon } = await import('../web/src/lib/coupons.ts');
const { parseCouponInput } = await import('../web/src/lib/api/couponInput.ts');

process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const ADMIN = 'admin@test.local';
const USER = 'user@test.local';

test('ensureUser can never mint an admin, whatever it is handed', async () => {
  const created = await ensureUser(USER);
  assert.equal(created.role, 'user');
  // Calling it again with an email already promoted must not downgrade or re-create it.
  await setUserRole(USER, 'admin');
  assert.equal((await ensureUser(USER)).role, 'admin', 'an existing role must survive ensureUser');
  assert.equal((await ensureUser('Fresh@TEST.local')).role, 'user', 'a new account is always user');
});

test('one code is redeemable once per account, enforced by the store', async () => {
  await createCoupon({
    code: 'ONCE',
    percent: 50,
    expiresAt: null,
    maxTotalRedemptions: null,
    active: true,
    note: null,
    createdBy: ADMIN,
    createdAt: new Date().toISOString(),
  });

  assert.ok(await redeemCoupon('ONCE', USER, 50, 1), 'the first use is accepted');
  assert.equal(await redeemCoupon('ONCE', USER, 50, 2), null, 'the same account must be refused');
  assert.ok(await redeemCoupon('ONCE', 'someone.else@test.local', 50, 3), 'a different account may use it');

  const rows = await listRedemptions();
  assert.equal(rows.filter((r) => r.couponCode === 'ONCE').length, 2);
});

test('a percent coupon applies to exactly one purchase, not a plan grant', async () => {
  assert.equal(amountAfterCoupon(139000, 0), 139000);
  assert.equal(amountAfterCoupon(139000, 20), 111200);
  assert.equal(amountAfterCoupon(139000, 100), 0, 'a full discount is the skip-payOS case');
  assert.equal(amountAfterCoupon(1, 100), 0, 'never rounds up to 1 dong on a full discount');
});

test('adding a month clamps to the end of a short month instead of overflowing', () => {
  assert.equal(addMonth(new Date('2026-01-31T00:00:00.000Z')).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(addMonth(new Date('2024-01-31T00:00:00.000Z')).toISOString().slice(0, 10), '2024-02-29');
  assert.equal(addMonth(new Date('2026-03-15T00:00:00.000Z')).toISOString().slice(0, 10), '2026-04-15');
  assert.equal(addMonth(new Date('2026-12-10T00:00:00.000Z')).toISOString().slice(0, 10), '2027-01-10');
});

test('the effective plan is read from unexpired grants and falls back to free', async () => {
  const buyer = 'plan@test.local';
  assert.equal(await effectivePlan(buyer), null, 'no grant means the free plan');

  const first = await addGrant({ userEmail: buyer, planId: 'pro', source: 'PAYOS', orderCode: 10, percent: null });
  const held = await effectivePlan(buyer);
  assert.equal(held.planId, 'pro');
  assert.equal(held.expiresAt, first.expiresAt);

  // A second purchase stacks onto the first instead of overwriting it, so paying early keeps days.
  const second = await addGrant({ userEmail: buyer, planId: 'ultra', source: 'PAYOS', orderCode: 11, percent: null });
  assert.equal(second.startsAt, first.expiresAt, 'a new grant starts where the old one ends');
  const stacked = await effectivePlan(buyer);
  assert.equal(stacked.planId, 'ultra', 'the latest expiry wins');
  assert.equal(stacked.expiresAt, second.expiresAt);
  assert.notEqual(stacked.expiresAt, first.expiresAt, 'the earlier month must not be lost');
});

// Expiry is computed from the wall clock inside the store, with no `now` parameter to inject —
// deliberately, because there is exactly one caller and it is the real clock. So the test freezes
// the global instead. `new Date()` reads the system clock directly and does NOT go through
// `Date.now`, so patching only `Date.now` silently tests nothing.
const RealDate = Date;
const freezeAt = (iso) => {
  const frozen = new RealDate(iso).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [frozen] : args));
    }
    static now() {
      return frozen;
    }
  };
};
const thaw = () => {
  globalThis.Date = RealDate;
};

test('an expired grant stops being the effective plan with no job to run', async () => {
  const lapsed = 'lapsed@test.local';
  const granted = await addGrant({ userEmail: lapsed, planId: 'pro', source: 'COUPON', orderCode: 20, percent: 100 });
  assert.equal((await effectivePlan(lapsed))?.planId, 'pro');

  // One second past the end, not a month later: the boundary is the thing worth pinning.
  freezeAt(new RealDate(granted.expiresAt).getTime() + 1000);
  try {
    assert.equal(await effectivePlan(lapsed), null, 'past expires_at the account is back on free');
  } finally {
    thaw();
  }

  // And it must come back the moment the clock returns, because nothing was ever deleted.
  assert.equal((await effectivePlan(lapsed))?.planId, 'pro', 'an expired grant is hidden, not removed');
});

test('checkCoupon reports the reason in the order a user would want to hear it', async () => {
  const now = new Date().toISOString();
  await createCoupon({
    code: 'USEDUP', percent: 10, expiresAt: null, maxTotalRedemptions: null, active: true,
    note: null, createdBy: ADMIN, createdAt: now,
  });
  await redeemCoupon('USEDUP', USER, 10, 30);

  assert.deepEqual(await checkCoupon('NOPE', USER), { ok: false, reason: 'UNKNOWN_CODE' });

  // Already used beats every other reason, even on a code that is also spent out.
  const used = await checkCoupon('USEDUP', USER);
  assert.equal(used.ok, false);
  assert.equal(used.reason, 'ALREADY_USED');

  await createCoupon({
    code: 'OFF', percent: 10, expiresAt: null, maxTotalRedemptions: null, active: false,
    note: null, createdBy: ADMIN, createdAt: now,
  });
  assert.equal((await checkCoupon('OFF', USER)).reason, 'INACTIVE');

  await createCoupon({
    code: 'OLD', percent: 10, expiresAt: '2020-01-01T00:00:00.000Z', maxTotalRedemptions: null,
    active: true, note: null, createdBy: ADMIN, createdAt: now,
  });
  assert.equal((await checkCoupon('OLD', USER)).reason, 'EXPIRED');

  await createCoupon({
    code: 'CAPPED', percent: 10, expiresAt: null, maxTotalRedemptions: 1, active: true,
    note: null, createdBy: ADMIN, createdAt: now,
  });
  await redeemCoupon('CAPPED', 'one@test.local', 10, 31);
  assert.equal((await checkCoupon('CAPPED', 'two@test.local')).reason, 'LIMIT_REACHED');

  // A code the account has not touched still works, cap or not.
  await createCoupon({
    code: 'OK', percent: 30, expiresAt: null, maxTotalRedemptions: 5, active: true,
    note: null, createdBy: ADMIN, createdAt: now,
  });
  const ok = await checkCoupon('ok', USER);
  assert.equal(ok.ok, true, 'codes are case-insensitive on the way in');
  assert.equal(ok.percent, 30);
});

test('a coupon code cannot be created twice', async () => {
  const base = {
    percent: 10, expiresAt: null, maxTotalRedemptions: null, active: true,
    note: null, createdBy: ADMIN, createdAt: new Date().toISOString(),
  };
  await createCoupon({ ...base, code: 'TWICE' });
  await assert.rejects(() => createCoupon({ ...base, code: 'TWICE' }), /COUPON_EXISTS/);
  assert.equal((await getCoupon('twice')).code, 'TWICE', 'storage is normalised to upper case');
});

test('the admin form refuses what the database would refuse', () => {
  assert.equal(parseCouponInput({ code: 'ABC', percent: 0 }).error, 'BAD_PERCENT');
  assert.equal(parseCouponInput({ code: 'ABC', percent: 101 }).error, 'BAD_PERCENT');
  assert.equal(parseCouponInput({ code: 'ABC', percent: 20.5 }).error, 'BAD_PERCENT');
  assert.equal(parseCouponInput({ code: 'has space', percent: 20 }).error, 'BAD_CODE');
  assert.equal(parseCouponInput({ code: '', percent: 20 }).error, 'BAD_CODE');
  assert.equal(parseCouponInput({ code: 'A'.repeat(33), percent: 20 }).error, 'BAD_CODE');
  assert.equal(parseCouponInput({ code: 'ABC', percent: 20, expiresAt: 'nope' }).error, 'BAD_EXPIRY');
  assert.equal(parseCouponInput({ code: 'ABC', percent: 20, maxTotalRedemptions: 0 }).error, 'BAD_LIMIT');
  assert.equal(parseCouponInput({ code: 'ABC', percent: 20, maxTotalRedemptions: 1.5 }).error, 'BAD_LIMIT');

  // Blank means "unlimited" / "never", not zero — the two fields on the coupon form.
  const open = parseCouponInput({ code: 'ok', percent: 20, expiresAt: '', maxTotalRedemptions: '' });
  assert.equal(open.ok, true);
  assert.equal(open.value.expiresAt, null);
  assert.equal(open.value.maxTotalRedemptions, null);
  assert.equal(open.value.code, 'OK');
  assert.equal(open.value.active, true, 'a new coupon is active by default');
});
