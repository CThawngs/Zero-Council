// Founder role matrix + payOS stale-order purge rule. Pure helpers, no server.
import assert from 'node:assert/strict';
import test from 'node:test';

const { FOUNDER_EMAIL, isFounder, canSetRole, canResetPassword } = await import(
  '../web/src/lib/founder.ts?founder=1'
);
const { ORDER_TTL_MS, isStaleOrder } = await import('../web/src/lib/payos/stale.ts?stale=1');

const FOUNDER = FOUNDER_EMAIL;
const ADMIN = 'admin@example.com';
const USER = 'user@example.com';

test('isFounder matches case-insensitively with trim, rejects others', () => {
  assert.equal(isFounder(FOUNDER), true);
  assert.equal(isFounder(` ${FOUNDER.toUpperCase()} `), true);
  assert.equal(isFounder(ADMIN), false);
  assert.equal(isFounder(null), false);
  assert.equal(isFounder(undefined), false);
});

test('founder may demote another admin', () => {
  assert.equal(canSetRole(FOUNDER, ADMIN, 'admin', 'user'), true);
});

test('non-founder admin may not demote another admin', () => {
  assert.equal(canSetRole(ADMIN, USER, 'admin', 'user'), false);
});

test('any admin may promote a user to admin', () => {
  assert.equal(canSetRole(ADMIN, USER, 'user', 'admin'), true);
  assert.equal(canSetRole(FOUNDER, USER, 'user', 'admin'), true);
});

test('founder row can never be demoted, even by the founder', () => {
  assert.equal(canSetRole(FOUNDER, FOUNDER, 'admin', 'user'), false);
  assert.equal(canSetRole(ADMIN, FOUNDER, 'admin', 'user'), false);
});

test('missing target email is rejected', () => {
  assert.equal(canSetRole(FOUNDER, null, 'user', 'admin'), false);
  assert.equal(canSetRole(FOUNDER, '', 'user', 'admin'), false);
});

test('only the founder may reset passwords', () => {
  assert.equal(canResetPassword(FOUNDER), true);
  assert.equal(canResetPassword(ADMIN), false);
  assert.equal(canResetPassword(null), false);
});

test('TTL is exactly five minutes', () => {
  assert.equal(ORDER_TTL_MS, 5 * 60 * 1000);
});

const NOW = Date.parse('2026-11-05T00:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

test('PAID orders are never stale', () => {
  assert.equal(isStaleOrder('PAID', iso(NOW - 60 * 60 * 1000), NOW), false);
});

test('FAILED and EXPIRED orders are always stale', () => {
  assert.equal(isStaleOrder('FAILED', iso(NOW), NOW), true);
  assert.equal(isStaleOrder('EXPIRED', iso(NOW), NOW), true);
});

test('PENDING within TTL is kept, past TTL is stale', () => {
  assert.equal(isStaleOrder('PENDING', iso(NOW - ORDER_TTL_MS + 1), NOW), false);
  assert.equal(isStaleOrder('PENDING', iso(NOW - ORDER_TTL_MS), NOW), false);
  assert.equal(isStaleOrder('PENDING', iso(NOW - ORDER_TTL_MS - 1), NOW), true);
});

test('unparseable createdAt is treated as stale', () => {
  assert.equal(isStaleOrder('PENDING', 'not-a-date', NOW), true);
});
