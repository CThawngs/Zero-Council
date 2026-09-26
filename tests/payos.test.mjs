import assert from 'node:assert/strict';
import test from 'node:test';
import { toSignaturePayload, signData, verifySignature } from '../web/src/lib/payos/signature.ts';
import { discountFor } from '../web/src/lib/payos/discount.ts';

const KEY = 'checksum-key-for-tests';

test('payload is key-sorted and skips empty values', () => {
  assert.equal(
    toSignaturePayload({ returnUrl: 'https://x/return', amount: 139000, description: 'ZC Pro', orderCode: 7, cancelUrl: 'https://x/cancel' }),
    'amount=139000&cancelUrl=https://x/cancel&description=ZC Pro&orderCode=7&returnUrl=https://x/return'
  );
  assert.equal(toSignaturePayload({ b: 2, a: 1, c: null, d: '' }), 'a=1&b=2');
});

test('signature verifies against the same checksum key only', () => {
  const data = { orderCode: 7, amount: 139000 };
  const signature = signData(data, KEY);
  assert.equal(signature.length, 64);
  assert.ok(verifySignature(data, signature, KEY));
  assert.ok(!verifySignature(data, signature, `${KEY}-wrong`));
  assert.ok(!verifySignature({ orderCode: 7, amount: 1 }, signature, KEY), 'amount change must break the signature');
});

test('a forged or malformed signature is rejected, not thrown on', () => {
  const data = { orderCode: 7, amount: 139000 };
  for (const bad of [undefined, null, '', 'not-hex', signData(data, KEY).slice(0, -1)]) {
    assert.equal(verifySignature(data, bad, KEY), false);
  }
});

test('discount table is opt-in, case-insensitive, and rejects junk entries', () => {
  // Empty string, never `delete`: a deleted env var does not survive reassignment in the test runner.
  process.env.PAYLOS_DISCOUNT_CODES = '';
  assert.equal(discountFor('WELCOME'), null, 'unset table must reject every code');

  process.env.PAYLOS_DISCOUNT_CODES = 'WELCOME=10000, partner=25000 ,BROKEN,NOAMOUNT=abc,NEARLY=1.5';
  assert.equal(discountFor('welcome'), 10000);
  assert.equal(discountFor(' PARTNER '), 25000);
  for (const code of ['BROKEN', 'NOAMOUNT', 'NEARLY', 'MISSING']) {
    assert.equal(discountFor(code), null, `${code} must not resolve`);
  }
  process.env.PAYLOS_DISCOUNT_CODES = '';
});
