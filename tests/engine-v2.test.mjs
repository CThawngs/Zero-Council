// The contract a real deliberation engine has to keep — from PR #18, re-pointed at the file that
// actually ships as engine-v2.ts. Engine.ts stayed the framework engine the session UI reads;
// this contract is the one the chat room in prototype/chat/engine.ts now obeys too (deadline,
// cancel, streaming, refuse-before-spend, membership).
import test from 'node:test';
import assert from 'node:assert/strict';

import { requestProblems } from '../web/src/lib/deliberation/plan.ts';
import {
  createDeliberationEngine,
  DeliberationCancelled,
  DeliberationError,
  pacedProducer,
} from '../web/src/lib/deliberation/engine-v2.ts';

const ADVISORS = ['pragmatist', 'dreamer', 'skeptic'];

const VALID_REQUEST = {
  mode: 'debate',
  prompt: 'Ship the rewrite everywhere, or pilot with one team?',
  language: 'en',
  advisorIds: ADVISORS,
  roundIndex: 1,
};

// --- The contract a real engine has to keep when the first API key arrives ---

test('a well formed request has no problems', () => {
  assert.deepEqual(requestProblems(VALID_REQUEST), []);
});

test('a request the engine cannot honour is refused before any work', () => {
  // Every one of these would otherwise reach a paid provider: an empty advisor
  // list renders an empty council, a NaN round index renders a "Round NaN" rail.
  const bad = {
    prompt: '   ',
    advisorIds: [],
    roundIndex: 0,
    mode: 'shouting',
    language: 'fr',
  };
  assert.deepEqual(requestProblems(bad), [
    'prompt is empty',
    'no advisors to ask',
    'round index 0 is not a whole round',
    'unknown mode shouting',
    'unknown language fr',
  ]);
});

test('a repeated advisor is caught — it would answer as the same voice twice', () => {
  assert.deepEqual(requestProblems({ ...VALID_REQUEST, advisorIds: ['a', 'a'] }), ['advisor ids repeat']);
  assert.deepEqual(requestProblems({ ...VALID_REQUEST, advisorIds: ['a', ' '] }), ['advisor id is empty']);
});

test('a round index that is not a whole round is refused', () => {
  for (const roundIndex of [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(requestProblems({ ...VALID_REQUEST, roundIndex }).length, 1, String(roundIndex));
  }
  assert.deepEqual(requestProblems({ ...VALID_REQUEST, roundIndex: 7 }), []);
});

// --- The contract itself. A fake producer stands in for a flaky provider. ---

const FAKE_ROUND = {
  index: 1,
  mode: 'debate',
  prompt: 'x',
  language: 'en',
  // A real member, not 'a'. The engine refuses contributions from anyone outside
  // the chat, and these fakes are members — a placeholder id made every contract
  // test describe a producer answering strangers.
  contributions: [{ advisorId: 'pragmatist', text: 'a', rebuts: null, buildsOn: null }],
  chair: { summary: 's', dissent: 'd', recommendation: 'r' },
};

const REQUEST = { ...VALID_REQUEST, advisorStances: {} };

test('a malformed request never reaches the producer', async () => {
  let called = false;
  const run = createDeliberationEngine(async () => {
    called = true;
    return FAKE_ROUND;
  });
  await assert.rejects(
    () => run({ ...REQUEST, advisorIds: [] }),
    (error) => error instanceof DeliberationError && error.problems.includes('no advisors to ask')
  );
  // The point is what never happened.
  assert.equal(called, false);
});

test('a producer that stops answering fails instead of spinning forever', async () => {
  // This is the network-hang case a fixture can never produce on its own: the
  // producer waits for a signal that only the deadline will ever fire.
  const run = createDeliberationEngine(
    (_, context) =>
      new Promise((_, reject) => context.signal.addEventListener('abort', () => reject(context.signal.reason))),
    20
  );
  await assert.rejects(
    () => run(REQUEST),
    (error) => error instanceof DeliberationError && error.problems[0].includes('no answer within')
  );
});

test('an answer that arrives after a cancel is discarded, not committed', async () => {
  // A provider that ignores the abort signal and answers anyway. The round must
  // still be refused, or the user backs out and the round appears anyway.
  const run = createDeliberationEngine(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return FAKE_ROUND;
  });
  const controller = new AbortController();
  const pending = run({ ...REQUEST, signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, (error) => error instanceof DeliberationCancelled);
});

test('a result that is already in hand still loses to a cancel that landed first', async () => {
  const controller = new AbortController();
  const run = createDeliberationEngine(async () => FAKE_ROUND);
  controller.abort();
  await assert.rejects(
    () => run({ ...REQUEST, signal: controller.signal }),
    (error) => error instanceof DeliberationCancelled
  );
});

test('onContribution reaches the caller in speaking order, chair last', async () => {
  const three = {
    ...FAKE_ROUND,
    contributions: ADVISORS.map((id) => ({ advisorId: id, text: id, rebuts: null, buildsOn: null })),
  };
  const seen = [];
  const run = createDeliberationEngine(
    pacedProducer(() => three, 1)
  );
  await run({ ...REQUEST, onContribution: (progress) => seen.push(progress) });
  assert.deepEqual(
    seen.map((progress) => progress.landed.length),
    [1, 2, 3, 3]
  );
  assert.equal(seen.at(-1).chair !== null, true);
  assert.equal(
    seen.slice(0, 3).every((progress) => progress.chair === null),
    true
  );
});

test('an already-aborted signal discards the result', async () => {
  // The listener that forwards the cancel is attached to a signal that already
  // fired, so it never runs again — the deadline check is the only thing left.
  const controller = new AbortController();
  controller.abort();
  let reached = false;
  const run = createDeliberationEngine(async () => {
    reached = true;
    return FAKE_ROUND;
  });
  await assert.rejects(
    () => run({ ...REQUEST, signal: controller.signal }),
    (error) => error instanceof DeliberationCancelled
  );
  assert.equal(reached, true, 'the producer may start, but its answer must be thrown away');
});

// --- Attachment transport ---
//
// Attachments are half the point of this prototype, and they had no test at all:
// a request could lose them on the way to the engine and every other test would
// still pass. These pin the two halves of the claim — the request carries them,
// and a malformed one is refused before anything costs money.

const ATTACH = (over = {}) => ({
  id: 'a1',
  kind: 'image',
  name: 'chart.png',
  href: 'blob:abc',
  ...over,
});

test('attachments are optional, and an empty list is fine', () => {
  assert.deepEqual(requestProblems(VALID_REQUEST), []);
  assert.deepEqual(requestProblems({ ...VALID_REQUEST, attachments: [] }), []);
});

test('attachments reach the producer untouched', async () => {
  const attachments = [
    ATTACH({ id: 'a1', kind: 'image', name: 'chart.png', href: 'blob:one' }),
    ATTACH({ id: 'a2', kind: 'link', name: 'https://example.com/spec', href: 'https://example.com/spec' }),
    ATTACH({ id: 'a3', kind: 'file', name: 'notes.md', href: 'blob:two' }),
  ];
  const seen = [];
  const engine = createDeliberationEngine(async (request) => {
    seen.push(request.attachments);
    return FAKE_ROUND;
  });
  await engine({ ...REQUEST, attachments });
  assert.deepEqual(seen[0], attachments, 'không được bỏ, sắp xếp lại hay rút gọn attachment');
});

test('an attachment that cannot be opened is refused before it costs money', () => {
  const problems = requestProblems({
    ...VALID_REQUEST,
    attachments: [ATTACH({ href: '' })],
  });
  assert.deepEqual(problems, ['attachment 1 has nothing to open']);
});

test('a nameless attachment is refused too', () => {
  const problems = requestProblems({ ...VALID_REQUEST, attachments: [ATTACH({ name: '   ' })] });
  assert.deepEqual(problems, ['attachment 1 has no name']);
});

test('a broken attachment names which one it is', () => {
  // Với 3 file, phải biết file nào hỏng — "có file hỏng" thì không sửa được.
  const problems = requestProblems({
    ...VALID_REQUEST,
    attachments: [ATTACH({ id: 'ok' }), ATTACH({ id: 'bad2', href: '' }), ATTACH({ id: 'ok3' })],
  });
  assert.deepEqual(problems, ['attachment 2 has nothing to open']);
});

test('every broken field is reported at once, not one per round trip', () => {
  const problems = requestProblems({
    ...VALID_REQUEST,
    attachments: [{ id: '', name: '', href: '' }],
  });
  assert.deepEqual(problems, [
    'attachment 1 has no id',
    'attachment 1 has no name',
    'attachment 1 has nothing to open',
  ]);
});

test('a hole in the attachment list does not throw', () => {
  // Fixture không bao giờ gặp, nhưng producer thật sẽ gặp khi ai đó lọc danh sách.
  assert.doesNotThrow(() => requestProblems({ ...VALID_REQUEST, attachments: [null] }));
  const problems = requestProblems({ ...VALID_REQUEST, attachments: [null] });
  assert.equal(problems.length, 3, 'một mục hỏng phải ra đủ 3 lỗi, không phải im lặng');
});

test('attachments that are not a list are refused', () => {
  assert.deepEqual(requestProblems({ ...VALID_REQUEST, attachments: 'chart.png' }), [
    'attachments is not a list',
  ]);
});

// --- Membership: nobody outside this chat may speak in it ---

// This is the premise of the app. Only the fixture builds rounds today and it
// builds them from advisorIds, so nothing could violate it — which is exactly
// why an untested check is worthless here: it would look green right up until
// the first real producer crosses the seam.

const roundFrom = (advisorIds) => ({
  ...FAKE_ROUND,
  contributions: advisorIds.map((advisorId) => ({
    advisorId,
    rebuts: null,
    buildsOn: null,
    text: `${advisorId} speaks`,
  })),
});

test('every member of the chat may speak', async () => {
  const engine = createDeliberationEngine(async () => roundFrom(ADVISORS));
  const round = await engine({ ...REQUEST });
  assert.deepEqual(round.contributions.map((c) => c.advisorId), ADVISORS);
});

test('an advisor nobody added to this chat is refused', async () => {
  // "Ghost" is not in REQUEST.advisorIds, so it must not appear in the thread.
  const engine = createDeliberationEngine(async () => roundFrom([...ADVISORS, 'ghost']));
  await assert.rejects(
    () => engine({ ...REQUEST }),
    (error) =>
      error instanceof DeliberationError &&
      error.problems.includes('advisor ghost answered but is not in this chat')
  );
});

test('the refusal names the stray advisor, not just that something was wrong', async () => {
  const engine = createDeliberationEngine(async () => roundFrom(['pragmatist', 'stranger-1', 'stranger-2']));
  const error = await engine({ ...REQUEST }).then(
    () => null,
    (e) => e
  );
  assert.deepEqual(error?.problems, [
    'advisor stranger-1 answered but is not in this chat',
    'advisor stranger-2 answered but is not in this chat',
  ]);
});

test('the same stray advisor twice is named once', async () => {
  const engine = createDeliberationEngine(async () => roundFrom(['pragmatist', 'ghost', 'ghost']));
  const error = await engine({ ...REQUEST }).then(
    () => null,
    (e) => e
  );
  assert.deepEqual(error?.problems, ['advisor ghost answered but is not in this chat']);
});

test('a cancel still wins over a stray answer', async () => {
  // Otherwise a broken producer would keep the user stuck in a round they left.
  const controller = new AbortController();
  const engine = createDeliberationEngine(async () => {
    controller.abort();
    return roundFrom([...ADVISORS, 'ghost']);
  });
  await assert.rejects(
    () => engine({ ...REQUEST, signal: controller.signal }),
    (error) => error instanceof DeliberationCancelled
  );
});
