// Tests for the downgrade/cancel rules. Pure, no server.
import assert from 'node:assert/strict';
import test from 'node:test';

const { planChangeAction } = await import('../web/src/lib/store/planChange.ts?plan-change=1');

test('pro -> free is a plain cancel', () => {
  assert.equal(planChangeAction('pro', 'free'), 'cancel');
});

test('ultra -> free is a plain cancel', () => {
  assert.equal(planChangeAction('ultra', 'free'), 'cancel');
});

test('ultra -> pro needs a fresh pro payment', () => {
  assert.equal(planChangeAction('ultra', 'pro'), 'downgrade-pay');
});

test('free has nothing to downgrade from', () => {
  assert.equal(planChangeAction('free', 'free'), 'invalid');
  assert.equal(planChangeAction('free', 'pro'), 'invalid');
});

test('same plan and unknown targets are invalid', () => {
  assert.equal(planChangeAction('pro', 'pro'), 'invalid');
  assert.equal(planChangeAction('ultra', 'ultra'), 'invalid');
  assert.equal(planChangeAction('pro', 'gold'), 'invalid');
  assert.equal(planChangeAction('pro', ''), 'invalid');
});
