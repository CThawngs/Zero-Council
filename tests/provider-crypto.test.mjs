// Provider-key encryption: round-trip, wrong-secret/tamper rejection, envelope shape.
import assert from 'node:assert/strict';
import test from 'node:test';

const { encryptProviderKey, decryptProviderKey } = await import(
  '../web/src/lib/crypto/providerKeys.ts'
);

test('encrypt then decrypt returns the original key', () => {
  const secret = 'sk-ant-test-1234567890';
  assert.equal(decryptProviderKey(encryptProviderKey(secret)), secret);
});

test('ciphertext never contains the plaintext and has the v1 envelope shape', () => {
  const envelope = encryptProviderKey('sk-openai-super-secret');
  assert.equal(envelope.includes('sk-openai-super-secret'), false);
  const parts = envelope.split(':');
  assert.equal(parts[0], 'v1');
  assert.equal(parts.length, 4);
});

test('two encryptions of the same key differ (random IV)', () => {
  assert.notEqual(encryptProviderKey('same'), encryptProviderKey('same'));
});

test('tampered ciphertext is rejected, not silently decrypted', () => {
  const parts = encryptProviderKey('untouched').split(':');
  parts[3] = Buffer.from('tampered-bytes-0000').toString('base64');
  assert.throws(() => decryptProviderKey(parts.join(':')));
});

test('malformed envelope is rejected', () => {
  assert.throws(() => decryptProviderKey('not-an-envelope'));
});
