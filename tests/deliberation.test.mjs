import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampScale,
  HAT_ORDER,
  MATRIX_CRITERION_IDS,
  MATRIX_OPTION_IDS,
  MAX_SCORE,
  MAX_WEIGHT,
  planContributions,
  requestProblems,
  scoreMatrix,
} from '../web/src/lib/deliberation/plan.ts';
import {
  createDeliberationEngine,
  DeliberationCancelled,
  DeliberationError,
  pacedProducer,
} from '../web/src/lib/deliberation/engine.ts';
import { copy, missingCopyKeys } from '../web/src/prototype/i18n.ts';

const ADVISORS = ['pragmatist', 'dreamer', 'skeptic'];

const VALID_REQUEST = {
  mode: 'debate',
  framework: 'matrix',
  prompt: 'Ship the rewrite everywhere, or pilot with one team?',
  language: 'en',
  advisorIds: ADVISORS,
  roundIndex: 1,
};

test('independent mode: nobody references anyone', () => {
  const shapes = planContributions('independent', ADVISORS);
  assert.equal(shapes.length, 3);
  for (const shape of shapes) {
    assert.equal(shape.rebuts, null);
    assert.equal(shape.buildsOn, null);
  }
  assert.deepEqual(
    shapes.map((shape) => shape.advisorId),
    ADVISORS
  );
});

test('debate mode: each advisor answers the one before, first answers nobody', () => {
  const shapes = planContributions('debate', ADVISORS);
  assert.equal(shapes[0].rebuts, null, 'the first advisor has nobody to answer');
  assert.deepEqual(
    shapes.map((shape) => shape.rebuts),
    [null, 'pragmatist', 'dreamer']
  );
  for (const shape of shapes) assert.equal(shape.buildsOn, null, 'debate never builds on');
});

test('chain mode: each advisor builds on the one before, first builds on nobody', () => {
  const shapes = planContributions('chain', ADVISORS);
  assert.equal(shapes[0].buildsOn, null);
  assert.deepEqual(
    shapes.map((shape) => shape.buildsOn),
    [null, 'pragmatist', 'dreamer']
  );
  for (const shape of shapes) assert.equal(shape.rebuts, null, 'chain never rebuts');
});

test('the three modes are distinguishable from the data alone', () => {
  // If these ever collapse to the same shape the mode control would be cosmetic.
  const shape = (mode) => JSON.stringify(planContributions(mode, ADVISORS));
  const distinct = new Set(['independent', 'debate', 'chain'].map(shape));
  assert.equal(distinct.size, 3);
});

test('a single advisor gets one contribution and no cross reference', () => {
  for (const mode of ['independent', 'debate', 'chain']) {
    const shapes = planContributions(mode, ['solo']);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].rebuts, null);
    assert.equal(shapes[0].buildsOn, null);
  }
});

test('no advisors yields no contributions', () => {
  assert.deepEqual(planContributions('debate', []), []);
});

test('scoreMatrix: total is the weighted sum, weight 0 contributes nothing', () => {
  const criteria = [
    { id: 'cost', weight: 0 },
    { id: 'speed', weight: 3 },
  ];
  const options = [
    { id: 'optionA', scores: { cost: 5, speed: 2 } },
    { id: 'optionB', scores: { cost: 1, speed: 4 } },
  ];
  const { rows, winnerId } = scoreMatrix(criteria, options);
  assert.equal(rows[0].total, 6, 'cost is ignored, 3 * 2');
  assert.equal(rows[1].total, 12, '3 * 4');
  assert.equal(winnerId, 'optionB');
});

test('scoreMatrix: moving one weight never rescales the others', () => {
  // The regression this guards: recomputing with normalised weights would make
  // raising one weight silently shrink every other criterion's contribution.
  const before = scoreMatrix(
    [
      { id: 'cost', weight: 2 },
      { id: 'risk', weight: 1 },
    ],
    [{ id: 'optionA', scores: { cost: 3, risk: 5 } }]
  );
  const after = scoreMatrix(
    [
      { id: 'cost', weight: 5 },
      { id: 'risk', weight: 1 },
    ],
    [{ id: 'optionA', scores: { cost: 3, risk: 5 } }]
  );
  const riskBefore = before.rows[0].total - 2 * 3;
  const riskAfter = after.rows[0].total - 5 * 3;
  assert.equal(riskBefore, 5);
  assert.equal(riskAfter, 5, 'the risk term is unchanged by the cost weight');
  assert.equal(after.rows[0].total, 20);
});

test('scoreMatrix: maxTotal is the ceiling and winnerId is null when every total is zero', () => {
  const { maxTotal, winnerId, rows } = scoreMatrix(
    [
      { id: 'cost', weight: 2 },
      { id: 'speed', weight: 3 },
    ],
    [
      { id: 'optionA', scores: { cost: 0, speed: 0 } },
      { id: 'optionB', scores: { cost: 0, speed: 0 } },
    ]
  );
  assert.equal(maxTotal, (2 + 3) * MAX_SCORE);
  assert.deepEqual(rows.map((row) => row.total), [0, 0]);
  assert.equal(winnerId, null, 'no winner is a real answer, not a tie to pick arbitrarily');
});

test('scoreMatrix: a missing score reads as zero rather than NaN', () => {
  const { rows } = scoreMatrix(
    [{ id: 'cost', weight: 2 }],
    [{ id: 'optionA', scores: {} }]
  );
  assert.equal(rows[0].total, 0);
});

test('scoreMatrix: a tie resolves to the first option, deterministically', () => {
  const { winnerId } = scoreMatrix(
    [{ id: 'cost', weight: 1 }],
    [
      { id: 'optionA', scores: { cost: 3 } },
      { id: 'optionB', scores: { cost: 3 } },
    ]
  );
  assert.equal(winnerId, 'optionA');
});

test('clampScale rounds, clamps, and survives non-finite input', () => {
  assert.equal(clampScale(3.4), 3);
  assert.equal(clampScale(3.6), 4);
  assert.equal(clampScale(0), 1, 'never zero: a weight of zero hides the criterion');
  assert.equal(clampScale(99), MAX_SCORE);
  assert.equal(clampScale(Number.NaN), 1, 'NaN must not become NaN');
  assert.equal(clampScale(Number.POSITIVE_INFINITY), 1);
  assert.equal(clampScale(4, 3), 3, 'honours a caller-supplied maximum');
});

test('hat order covers all six hats exactly once', () => {
  assert.equal(HAT_ORDER.length, 6);
  assert.equal(new Set(HAT_ORDER).size, 6);
});

test('the matrix shape is fixed: four criteria, three options', () => {
  assert.equal(MATRIX_CRITERION_IDS.length, 4);
  assert.equal(MATRIX_OPTION_IDS.length, 3);
  assert.equal(new Set(MATRIX_CRITERION_IDS).size, 4);
  assert.equal(new Set(MATRIX_OPTION_IDS).size, 3);
});

test('both languages carry every string, in both directions', () => {
  assert.deepEqual(missingCopyKeys('en'), []);
  assert.deepEqual(missingCopyKeys('vi'), []);
  // A key present only in one table still renders as undefined at runtime, which
  // is what tsc cannot see and this guard exists for.
  const en = Object.keys(copy.en);
  const vi = Object.keys(copy.vi);
  assert.deepEqual(vi.filter((key) => !en.includes(key)), []);
  assert.ok(en.length > 100, 'the copy tables are the whole UI, not a handful of strings');
});

test('every placeholder used by a value exists in the copy it is interpolated into', () => {
  const placeholders = (value) => (String(value).match(/\{[a-zA-Z]+\}/g) ?? []).sort();
  const mismatches = [];
  for (const key of new Set([...Object.keys(copy.en), ...Object.keys(copy.vi)])) {
    const enPlaceholders = placeholders(copy.en[key]);
    const viPlaceholders = placeholders(copy.vi[key]);
    if (JSON.stringify(enPlaceholders) !== JSON.stringify(viPlaceholders)) {
      mismatches.push({ key, en: enPlaceholders, vi: viPlaceholders });
    }
  }
  // A missing {name} in one language ships a literal "{name}" to that reader.
  assert.deepEqual(mismatches, []);
});

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
    framework: 'vibes',
    language: 'fr',
  };
  assert.deepEqual(requestProblems(bad), [
    'prompt is empty',
    'no advisors to ask',
    'round index 0 is not a whole round',
    'unknown mode shouting',
    'unknown framework vibes',
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
  framework: 'matrix',
  prompt: 'x',
  language: 'en',
  contributions: [{ advisorId: 'a', text: 'a', rebuts: null, buildsOn: null }],
  chair: { summary: 's', dissent: 'd', recommendation: 'r' },
  frameworkOutput: { kind: 'matrix', matrix: null },
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
    contributions: ['a', 'b', 'c'].map((id) => ({ advisorId: id, text: id, rebuts: null, buildsOn: null })),
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
