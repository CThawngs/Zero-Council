// Sidebar session CRUD: happy path plus the two silent-failure shapes (blank
// rename, unknown id) that would otherwise leave the list looking untouched.
import assert from 'node:assert/strict';
import test from 'node:test';

const { renameSessionInList, deleteSessionFromList } = await import(
  '../web/src/prototype/sessions-crud.ts'
);

const session = (id, title) => ({ id, title });

test('rename updates only the target session', () => {
  const next = renameSessionInList([session('a', 'Old'), session('b', 'Keep')], 'a', 'New');
  assert.equal(next[0].title, 'New');
  assert.equal(next[1].title, 'Keep');
});

test('rename pins the title so the localizer cannot revert it', () => {
  const next = renameSessionInList([session('project-proposal', 'Seed')], 'project-proposal', 'Mine');
  assert.equal(next[0].titlePinned, true);
});

test('blank rename is a no-op, never an empty list title', () => {
  const list = [session('a', 'Old')];
  assert.equal(renameSessionInList(list, 'a', '   '), list);
});

test('rename trims surrounding whitespace', () => {
  const next = renameSessionInList([session('a', 'Old')], 'a', '  New  ');
  assert.equal(next[0].title, 'New');
});

test('delete removes only the target session', () => {
  const next = deleteSessionFromList([session('a', 'A'), session('b', 'B')], 'a');
  assert.deepEqual(next.map((s) => s.id), ['b']);
});

test('delete with unknown id returns the same array', () => {
  const list = [session('a', 'A')];
  assert.equal(deleteSessionFromList(list, 'missing'), list);
});
