import assert from 'node:assert/strict';
import test from 'node:test';
import { toSignaturePayload, signData, verifySignature } from '../web/src/lib/payos/signature.ts';
import { amountAfterCoupon } from '../web/src/lib/coupons.ts';

const KEY = 'checksum-key-for-tests';

test('payload is key-sorted and keeps empty values as key=', () => {
  assert.equal(
    toSignaturePayload({ returnUrl: 'https://x/return', amount: 139000, description: 'ZC Pro', orderCode: 7, cancelUrl: 'https://x/cancel' }),
    'amount=139000&cancelUrl=https://x/cancel&description=ZC Pro&orderCode=7&returnUrl=https://x/return'
  );
  assert.equal(toSignaturePayload({ b: 2, a: 1, c: null, d: '' }), 'a=1&b=2&c=&d=');
});

test('stripping a null field breaks the signature (live v2 finding)', () => {
  // The live API returned `expiredAt: null`. If empty fields were skipped when signing,
  // `expiredAt` could be removed from the payload without the signature breaking.
  const withEmpty = { orderCode: 7, amount: 139000, expiredAt: null };
  const signature = signData(withEmpty, KEY);
  assert.ok(verifySignature(withEmpty, signature, KEY));
  assert.equal(
    verifySignature({ orderCode: 7, amount: 139000 }, signature, KEY),
    false,
    'a payload missing the empty field must not verify'
  );
  assert.equal(verifySignature({ ...withEmpty, expiredAt: '2026-10-01' }, signature, KEY), false);
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

test('a percentage coupon discounts to whole dong and never goes negative', () => {
  assert.equal(amountAfterCoupon(139000, 20), 111200);
  assert.equal(amountAfterCoupon(379000, 100), 0, 'a 100% coupon is the skip-payOS case');
  assert.equal(amountAfterCoupon(1000, 100), 0);
  assert.equal(amountAfterCoupon(1000, 0), 1000);
  assert.equal(amountAfterCoupon(139000, 100), 0);
  // Rounds, never truncates toward the customer in a way that loses a dong twice.
  assert.equal(amountAfterCoupon(139, 50), 70);
});
