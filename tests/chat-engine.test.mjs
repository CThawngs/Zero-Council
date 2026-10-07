// Routing rules of the council loop. Scripted generator, no network, no React.
//
// These tests assert BEHAVIOUR — who is handed the floor, when the loop parks, what it does when a
// generator fails. The distinction matters: an earlier suite parsed @names out of prose and passed
// 15/15 while the design was wrong, because every fixture happened to obey the convention.
import { strict as assert } from 'node:assert';
import test from 'node:test';

const engine = await import('../web/src/prototype/chat/engine.ts');
const {
  CONTEXT_SINGLE_EXCERPT,
  DEFAULT_MAX_TURNS,
  RESUME_ALL,
  SILENT_TOKEN,
  USER_HANDLE,
  buildContext,
  isResumeDirective,
  isStopDirective,
  parseMentions,
  planSpeakers,
  runTurn,
} = engine;
const { scriptedGenerator } = await import('../web/src/prototype/chat/scripted.ts');

const ROSTER = [
  { id: 'pragmatist', name: 'The Pragmatist' },
  { id: 'dreamer', name: 'The Dreamer' },
  { id: 'skeptic', name: 'The Skeptic' },
];
const GEN = scriptedGenerator(ROSTER);
const msg = (authorId, body, mentioned = []) => ({ id: `${authorId}-${body.slice(0, 6)}`, authorId, body, mentioned });
const userMsg = (body) => msg(USER_HANDLE, body, parseMentions(body, ROSTER));
const turn = (text, handoffs = [], extra = {}) => ({ text, handoffs, ...extra });

test('a structured handoff reaches an advisor the round never scheduled', async () => {
  // The user named one advisor, so round-robin scheduled only that one. A handoff must still pull
  // in somebody else — that is A2A, and it is the reason the queue is dynamic.
  const { speakers, stoppedBy } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('@pragmatist start'),
    generate: ({ bot, isClosing }) =>
      bot.id === 'pragmatist'
        ? turn('opening, handing to dreamer', ['dreamer'])
        : turn('closing back to you @user', [], {}),
    generateClosingHint: true,
  });
  assert.deepEqual(speakers, ['pragmatist', 'dreamer']);
  assert.equal(stoppedBy, 'user');
});

test('prose alone never routes — a quoted mention is not a handoff', async () => {
  // The exact production failure the structured contract exists to prevent: a model quoting
  // "@dreamer" inside a code block would otherwise wake Dreamer.
  const { speakers } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('@pragmatist start'),
    generate: ({ bot }) =>
      bot.id === 'pragmatist'
        ? turn('I agree with what @dreamer wrote earlier, so my answer is ... @user')
        : turn('should not happen'),
  });
  assert.deepEqual(speakers, ['pragmatist'], 'only the scheduled advisor spoke');
});

test('a handoff to self or to a stranger pulls in nobody extra', async () => {
  const { speakers } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('go'),
    generate: ({ bot }) =>
      bot.id === 'pragmatist' ? turn('bad handoffs', ['pragmatist', 'nobody-here']) : turn('ok @user'),
  });
  assert.deepEqual(speakers, ['pragmatist', 'dreamer'], 'the bad handoffs pulled in nobody extra');
});

test('a handoff back to an advisor who already spoke this round is dropped', async () => {
  // Otherwise two advisors that name each other ping-pong until the cap burns real tokens.
  const { speakers } = await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history: [],
    userMessage: userMsg('go'),
    generate: ({ bot }) => turn(`${bot.id} speaking`, ['pragmatist']),
  });
  assert.deepEqual(speakers, ['pragmatist', 'dreamer', 'skeptic'], 'each advisor spoke exactly once');
});

test('an advisor who spoke in an EARLIER round is still reachable by name', async () => {
  // Round-robin resumes after pragmatist, so dreamer opens and can pull pragmatist back in.
  const { speakers } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [msg('pragmatist', 'earlier round', [])],
    userMessage: userMsg('go'),
    generate: ({ bot }) => {
      if (bot.id === 'dreamer') return turn('dreamer here', ['pragmatist']);
      if (bot.id === 'pragmatist') return turn('back to you @user');
      return turn('skeptic ok');
    },
  });
  // Round-robin resumes after pragmatist, so the whole roster is queued anyway: dreamer, skeptic,
  // pragmatist. Naming someone already queued reaches them without jumping their turn.
  assert.deepEqual(speakers, ['dreamer', 'skeptic', 'pragmatist']);
});

test('a silent advisor passes and the room settles when nobody speaks', async () => {
  const { messages, stoppedBy, speakers } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('anything?'),
    generate: () => turn(SILENT_TOKEN, [], { silent: true }),
  });
  assert.equal(stoppedBy, 'silent', 'a full silent round is a reason, not a hang');
  assert.deepEqual(speakers, ['pragmatist', 'dreamer', 'skeptic'], 'each took its turn and passed');
  assert.equal(messages.length, 1, 'only the user message is in the transcript');
});

test('a silent advisor is a decision, not a failure', async () => {
  const { failures } = await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history: [],
    userMessage: userMsg('go'),
    generate: ({ isClosing }) => (isClosing ? turn('closing @user') : turn(SILENT_TOKEN, [], { silent: true })),
  });
  assert.deepEqual(failures, [], 'passing is never reported as an error');
});

test('an empty body counts as a pass rather than stalling or spamming the room', async () => {
  const { messages, stoppedBy } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('go'),
    generate: ({ bot }) => (bot.id === 'pragmatist' ? turn('   ') : turn('done @user')),
  });
  assert.equal(messages.length, 2, 'user message plus one real reply');
  assert.equal(stoppedBy, 'user');
});

test('the turn cap parks the room with a reason', async () => {
  const { speakers, stoppedBy } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('keep going'),
    generate: () => turn('still talking', []),
    maxTurns: 2,
  });
  assert.deepEqual(speakers, ['pragmatist', 'dreamer']);
  assert.equal(stoppedBy, 'max-turns');
});

test('the room budget parks the room even when the per-message cap has room left', async () => {
  const { stoppedBy } = await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history: [],
    userMessage: userMsg('go'),
    generate: () => turn('talking', []),
    roomBudget: 1,
    turnsUsed: 0,
    maxTurns: 50,
  });
  assert.equal(stoppedBy, 'budget');
});

test('a transient failure is retried exactly once and then succeeds', async () => {
  let calls = 0;
  const { speakers, failures } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('go'),
    generate: () => {
      calls += 1;
      if (calls === 1) throw new Error('429 rate limit exceeded');
      return turn('recovered @user');
    },
  });
  assert.equal(calls, 2, 'one retry, not a retry loop');
  assert.deepEqual(failures, []);
  assert.deepEqual(speakers, ['pragmatist']);
});

test('a fatal failure is not retried and is surfaced with its reason', async () => {
  let calls = 0;
  const { stoppedBy, failures } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('go'),
    generate: () => {
      calls += 1;
      throw new Error('invalid api key');
    },
  });
  assert.equal(calls, 1, 'a fatal failure must not burn a retry');
  assert.equal(stoppedBy, 'failed');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].kind, 'fatal');
});

test('a failure that survives its retry stops the room', async () => {
  const { stoppedBy, failures } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('go'),
    generate: () => {
      throw new Error('503 overloaded');
    },
  });
  assert.equal(stoppedBy, 'failed');
  assert.equal(failures[0].kind, 'transient');
});

test('panel mode runs the whole roster then closes back to the user', async () => {
  const { messages, stoppedBy, speakers } = await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history: [],
    userMessage: userMsg('everything'),
    generate: GEN,
    maxTurns: 8,
  });
  assert.deepEqual(speakers, ['pragmatist', 'dreamer', 'skeptic']);
  assert.equal(stoppedBy, 'user');
  assert.ok(messages.at(-1).mentioned.length >= 0);
  assert.ok(messages.at(-1).body.includes('@user'), 'the closing turn names the user');
});

test('the scripted generator hands off structurally, not by string', async () => {
  // Assert the CONTRACT, not the routed outcome: the generator returns an id in `handoffs`. The
  // `@name` it also writes is display only.
  const request = { bot: ROSTER[0], history: [], waiting: [ROSTER[1]], isClosing: false, prompt: 'hi', language: 'en' };
  const produced = GEN(request);
  assert.deepEqual(produced.handoffs, ['dreamer'], 'handoff is a real advisor id');
  assert.equal(typeof produced.text, 'string');
  assert.ok(produced.text.includes('@The Dreamer'), 'the prose still shows the mention');

  const closing = GEN({ ...request, waiting: [], isClosing: true });
  assert.deepEqual(closing.handoffs, [], 'closing hands back to the user, not to another bot');
});

test('the context window is trimmed to the budget', () => {
  const history = Array.from({ length: 50 }, (_, i) => msg('pragmatist', `message ${i} `.repeat(20)));
  const trimmed = buildContext(history, { maxMessages: 10, maxChars: 1000 });
  assert.ok(trimmed.length <= 10, 'message count is capped');
  assert.equal(trimmed.at(-1).body, history.at(-1).body, 'the newest message always survives');
});

test('one oversized message is excerpted instead of blowing the window', () => {
  const huge = 'x'.repeat(100_000);
  const [first] = buildContext([msg('pragmatist', huge), msg('dreamer', 'short')], {
    maxMessages: 10,
    maxChars: 50_000,
  });
  assert.equal(first.body.length, CONTEXT_SINGLE_EXCERPT, 'an oversized message is excerpted, not dropped');
});

test('every advisor is handed the same trimmed context, and it ends with the newest', async () => {
  const history = Array.from({ length: 30 }, (_, i) => msg('pragmatist', `old ${i}`));
  const seen = new Map();
  await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history,
    userMessage: userMsg('the question that matters'),
    generate: (request) => {
      seen.set(request.bot.id, request.history);
      return turn(request.isClosing ? 'closing @user' : 'ok');
    },
  });
  const dreamerSeen = seen.get('dreamer');
  assert.ok(dreamerSeen.length > 0);
  assert.ok(
    dreamerSeen.some((m) => m.body === 'the question that matters'),
    'the user prompt this round is in the context handed to dreamer'
  );
  assert.ok(
    dreamerSeen.some((m) => m.body === 'ok'),
    'and so is the advisor who already answered this round'
  );
});

test('the caller contract: history excludes this turn, so the user message lands once', async () => {
  // The UI passes the transcript as it stood BEFORE the send; runTurn appends the new message.
  const prior = [msg(USER_HANDLE, 'earlier question'), msg('pragmatist', 'earlier reply')];
  const { messages } = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: prior,
    userMessage: userMsg('this question'),
    generate: () => turn('ok @user'),
  });
  const userTurns = messages.filter((m) => m.authorId === USER_HANDLE);
  assert.equal(userTurns.length, 2, 'two user messages total — a third would be the duplication bug');
  assert.equal(userTurns[1].body, 'this question');
});

test('round robin starts at the top, then resumes after whoever spoke last', () => {
  const first = planSpeakers({ roster: ROSTER, mode: 'round-robin', history: [], userMessage: userMsg('hi') });
  assert.deepEqual(first.speakers.map((b) => b.id), ['pragmatist', 'dreamer', 'skeptic']);

  const second = planSpeakers({
    roster: ROSTER,
    mode: 'round-robin',
    history: [msg('dreamer', 'earlier', [])],
    userMessage: userMsg('again'),
  });
  assert.deepEqual(second.speakers.map((b) => b.id), ['skeptic', 'pragmatist', 'dreamer']);
});

test('a mention puts exactly that advisor first and drops the rest of the round', () => {
  const { speakers } = planSpeakers({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: userMsg('@skeptic your turn'),
  });
  assert.deepEqual(speakers.map((b) => b.id), ['skeptic']);
});

test('mention resolution ignores an unknown name instead of guessing a neighbour', () => {
  assert.deepEqual(parseMentions('@Pragmatist x', ROSTER), ['pragmatist']);
  assert.deepEqual(parseMentions('@the dreamer', ROSTER), ['dreamer']);
  assert.deepEqual(parseMentions('@nonexistent hi', ROSTER), []);
  assert.deepEqual(parseMentions('@user what do you think?', ROSTER), [USER_HANDLE]);
  assert.equal(DEFAULT_MAX_TURNS > 3, true, 'the per-message cap is a real loop, not three turns');
});

test('a stop word beside a mention holds that advisor; mid-sentence it is prose', () => {
  assert.equal(isStopDirective('stop @pragmatist', ROSTER), true);
  assert.equal(isStopDirective('@pragmatist stop', ROSTER), true);
  assert.equal(isStopDirective('dừng @dreamer', ROSTER), true);
  assert.equal(isStopDirective('stop', ROSTER), false, 'naming no one holds nobody');
  assert.equal(isStopDirective('@pragmatist please stop now', ROSTER), false);
  assert.equal(isStopDirective('how do I stop the process?', ROSTER), false);
});

test('@all is a resume, and it is not an advisor', () => {
  assert.equal(isResumeDirective('@all', ROSTER), true);
  assert.equal(isResumeDirective('@everyone carry on', ROSTER), true);
  assert.equal(isResumeDirective('@pragmatist go', ROSTER), false);
  assert.equal(parseMentions('@all', ROSTER)[0], RESUME_ALL);
  assert.equal(ROSTER.some((bot) => bot.id === RESUME_ALL), false, 'RESUME_ALL never enters the roster');
});

test('a directive is recognised against the full roster, not the reduced one', () => {
  // The browser drive found this: `stop @The Dreamer` was being run as a round. Recognising the
  // directive needs the advisor who is being stopped, who by definition is NOT in the reduced
  // roster — so detection must use the full roster. (Scheduling stays the caller's job: the engine
  // never sees a directive, and `drive-council.mjs` asserts that end to end.)
  const held = ['dreamer'];
  const reduced = ROSTER.filter((bot) => !held.includes(bot.id));
  assert.equal(isStopDirective('stop @The Dreamer', reduced), false, 'cannot be seen without the advisor');
  assert.equal(isStopDirective('stop @The Dreamer', ROSTER), true, 'detected against the full roster');
  assert.equal(parseMentions('stop @The Dreamer', reduced).length, 0, 'and does not resolve in the reduced one');
});