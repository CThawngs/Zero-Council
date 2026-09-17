import assert from 'node:assert/strict';
import test from 'node:test';
import { assertZeroCost } from '../src/lib/budget.mjs';

const free = { inputPrice: 0, outputPrice: 0, requiredFees: 0 };

test('accepts an explicitly zero-cost quote', () => {
  assert.doesNotThrow(() => assertZeroCost(free));
});

test('rejects paid, unknown, malformed and inherited prices', () => {
  for (const field of Object.keys(free)) {
    for (const value of [1, -1, NaN, Infinity, null, undefined, '0', false]) {
      assert.throws(() => assertZeroCost({ ...free, [field]: value }), /ZERO_BUDGET_EXCEEDED/);
    }
    const missing = { ...free };
    delete missing[field];
    assert.throws(() => assertZeroCost(missing), /ZERO_BUDGET_EXCEEDED/);
  }
  for (const quote of [undefined, null, [], {}, 'free', Object.create(free)]) {
    assert.throws(() => assertZeroCost(quote), /ZERO_BUDGET_EXCEEDED/);
  }
});
