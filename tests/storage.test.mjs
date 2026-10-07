/**
 * Room persistence is the kind of code that fails silently: a corrupt blob that half-loads leaves
 * the user looking at a deliberation with holes in it and no way to tell. So these assert the
 * unhappy paths as loudly as the happy one.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

const { clearStoredRoom, readStoredRoom, writeStoredRoom } = await import('../web/src/prototype/chat/storage.ts');

/** Minimal sessionStorage stand-in: same surface, no browser. */
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
};

const original = globalThis.window;
globalThis.window = { sessionStorage: makeStorage() };
test.after(() => {
  globalThis.window = original;
});

const ROOM = {
  title: 'Should we ship?',
  mode: 'round-robin',
  roster: ['pragmatist', 'dreamer'],
  messages: [
    { id: '0', authorId: 'user', body: 'What first?', mentioned: [] },
    { id: '1', authorId: 'pragmatist', body: 'Feasibility.', mentioned: ['dreamer'] },
  ],
  turns: 1,
  stoppedBy: 'user',
  failures: [],
  held: ['skeptic'],
};

test('a room survives a write and a read', () => {
  clearStoredRoom();
  writeStoredRoom(ROOM);
  const back = readStoredRoom();
  assert.equal(back?.title, ROOM.title);
  assert.equal(back?.messages.length, 2, 'the whole transcript, not just the last turn');
  assert.deepEqual(back?.held, ['skeptic'], 'held advisors must survive too, or @all comes back wrong');
  assert.equal(back?.turns, 1, 'the turn budget is cumulative; resetting it would refund free rounds');
});

test('clearing the room really clears it', () => {
  writeStoredRoom(ROOM);
  clearStoredRoom();
  assert.equal(readStoredRoom(), null, 'a deleted room must not come back on reload');
});

test('nothing written reads as no room', () => {
  clearStoredRoom();
  assert.equal(readStoredRoom(), null);
});

test('a blob from an older build is rejected rather than half-loaded', () => {
  globalThis.window.sessionStorage.setItem('zero-council:room', JSON.stringify({ ...ROOM, schema: 0 }));
  assert.equal(readStoredRoom(), null, 'a stale shape must not produce a room with missing fields');
});

test('corrupt JSON reads as no room instead of throwing', () => {
  globalThis.window.sessionStorage.setItem('zero-council:room', '{not json');
  assert.equal(readStoredRoom(), null);
});

test('a structurally wrong blob reads as no room', () => {
  globalThis.window.sessionStorage.setItem('zero-council:room', JSON.stringify({ schema: 1, roster: ['a'] }));
  assert.equal(readStoredRoom(), null, 'missing messages');
});

test('a room with no advisors reads as no room', () => {
  writeStoredRoom({ ...ROOM, roster: [] });
  assert.equal(readStoredRoom(), null, 'an empty roster cannot run a round; that is a broken state');
});

test('a store that refuses to write does not take the room down with it', () => {
  globalThis.window.sessionStorage = {
    getItem: () => null,
    // Private mode and quota-exceeded both land here.
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => writeStoredRoom(ROOM), 'a full store must not break the live room');
  assert.doesNotThrow(() => readStoredRoom());
  globalThis.window.sessionStorage = makeStorage();
});