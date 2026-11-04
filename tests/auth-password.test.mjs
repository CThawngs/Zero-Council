import assert from 'node:assert/strict';
import test from 'node:test';
import { needsPasswordSet, hasPasswordClaim } from '../web/src/lib/auth-password.ts';

const googleNew = { app_metadata: { providers: ['google'] }, user_metadata: {} };
const googleMerged = { app_metadata: { providers: ['email', 'google'] }, user_metadata: { has_password: true } };
const emailOnly = { app_metadata: { providers: ['email'] }, user_metadata: { has_password: true } };
const noPasswordAny = { app_metadata: { providers: ['google'] }, user_metadata: { has_password: false } };

test('new Google user without password must set one before dashboard', () => {
  assert.equal(needsPasswordSet(googleNew), true);
});

test('merged Google+email account with password goes straight to dashboard', () => {
  assert.equal(needsPasswordSet(googleMerged), false);
  assert.equal(hasPasswordClaim(googleMerged), true);
});

test('email/password account never forced to set password', () => {
  assert.equal(needsPasswordSet(emailOnly), false);
});

test('explicit has_password false still forces set-password', () => {
  assert.equal(needsPasswordSet(noPasswordAny), true);
  assert.equal(hasPasswordClaim(noPasswordAny), false);
});

test('null user never needs password (not logged in)', () => {
  assert.equal(needsPasswordSet(null), false);
  assert.equal(needsPasswordSet(undefined), false);
  assert.equal(hasPasswordClaim(null), false);
});
