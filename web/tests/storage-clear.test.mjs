import assert from "node:assert/strict";
import test from "node:test";

// `storage.ts` guards every access with `typeof window === 'undefined'`, so a real browser
// global has to exist before it is imported for these tests. Node's test runner runs the file
// body synchronously, so installing it here is enough.
const store = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  },
};

const { writeStoredRoom, readStoredRoom, clearStoredRoom } = await import("../src/prototype/chat/storage.ts");

// `storage.ts` does not export its key, so it is restated here. This test is about the clearing
// behaviour, not about the key name; if the key ever changes, `readStoredRoom() === null` below is
// what still fails, which is the assertion that matters.
const KEY = "zero-council:room";

const room = {
  messages: [{ id: "m1", role: "user", text: "probe" }],
  roster: ["claude-sonnet-4-5"],
  pending: [],
  held: [],
};

test("a written room reads back intact", () => {
  writeStoredRoom(room);
  const read = readStoredRoom();
  assert.equal(read?.messages.length, 1);
  assert.equal(read?.roster.length, 1);
});

test("clearStoredRoom removes the transcript from the store", () => {
  // This is the behaviour `purgeSessions` depends on. Before the fix, purging emptied the React
  // list but left this blob behind, so a reload brought the transcript back.
  writeStoredRoom(room);
  assert.ok(store.get(KEY), "precondition: room is in the store");

  clearStoredRoom();

  assert.equal(store.get(KEY), undefined, "key must be gone from sessionStorage");
  assert.equal(readStoredRoom(), null, "reader must not resurrect a cleared room");
});

test("clearing an already-empty store is harmless", () => {
  clearStoredRoom();
  clearStoredRoom();
  assert.equal(readStoredRoom(), null);
});