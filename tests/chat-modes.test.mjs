import test from 'node:test';
import assert from 'node:assert/strict';

import { runTurn, USER_HANDLE } from '../web/src/prototype/chat/engine.ts';
import { scriptedGenerator } from './helpers/scripted.ts';
import { byokGenerator } from '../web/src/prototype/chat/byok.ts';

const ROSTER = [
  { id: 'adv-1', name: 'Strategist' },
  { id: 'adv-2', name: 'Skeptic' },
  { id: 'adv-3', name: 'Builder' },
];

const USER_MSG = {
  id: '0',
  authorId: USER_HANDLE,
  body: 'Should we launch this feature this week?',
  mentioned: [],
};

test('panel (independent) mode isolates peer replies in the same round', async () => {
  const seenHistories = [];
  const seenModes = [];

  const result = await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history: [],
    userMessage: USER_MSG,
    language: 'en',
    generate: (request) => {
      seenHistories.push({
        botId: request.bot.id,
        authorIds: request.history.map((m) => m.authorId),
        handoffTargets: request.handoffTargets?.length ?? 0,
      });
      seenModes.push(request.mode);
      return scriptedGenerator(ROSTER)(request);
    },
  });

  assert.deepEqual(seenModes, ['panel', 'panel', 'panel']);
  assert.deepEqual(seenHistories, [
    { botId: 'adv-1', authorIds: [USER_HANDLE], handoffTargets: 0 },
    { botId: 'adv-2', authorIds: [USER_HANDLE], handoffTargets: 0 },
    { botId: 'adv-3', authorIds: [USER_HANDLE], handoffTargets: 0 },
  ]);
  assert.equal(result.speakers.length, 3);
  const botReplies = result.messages.filter((m) => m.authorId !== USER_HANDLE);
  assert.equal(botReplies.length, 3);
  for (const reply of botReplies) {
    assert.ok(!reply.body.includes('Countering'), 'independent reply must not counter');
  }
});

test('round-robin (debate) mode exposes prior turns and triggers critique framing', async () => {
  const seenModes = [];
  const result = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: USER_MSG,
    language: 'en',
    rounds: 1,
    generate: (request) => {
      seenModes.push(request.mode);
      return scriptedGenerator(ROSTER)(request);
    },
  });

  assert.deepEqual(seenModes, ['round-robin', 'round-robin', 'round-robin']);
  const botReplies = result.messages.filter((m) => m.authorId !== USER_HANDLE);
  assert.equal(botReplies.length, 3);
  assert.ok(botReplies[1].body.includes("Countering Strategist's angle"));
  assert.ok(botReplies[2].body.includes("Countering Skeptic's angle"));
});

test('byokGenerator injects distinct system prompts for panel (independent) vs round-robin (debate)', async () => {
  const capturedSystems = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init.body));
    capturedSystems.push(body.messages[0].content);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: 'Test reply' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  try {
    const gen = byokGenerator({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
    });

    for (const mode of ['panel', 'round-robin']) {
      await gen({
        bot: ROSTER[1],
        roster: ROSTER,
        history: [USER_MSG],
        waiting: [ROSTER[2]],
        handoffTargets: mode === 'panel' ? [] : [ROSTER[2]],
        isClosing: false,
        prompt: USER_MSG.body,
        language: 'en',
        attachments: [],
        mode,
      });
    }

    assert.match(capturedSystems[0], /Conversation mode: INDEPENDENT/);
    assert.match(capturedSystems[1], /Conversation mode: DEBATE/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('panel mode does not stop early when a bot tags @user or hands off to user', async () => {
  const result = await runTurn({
    roster: ROSTER,
    mode: 'panel',
    history: [],
    userMessage: USER_MSG,
    language: 'en',
    generate: ({ bot }) => ({
      text: `${bot.name} answer @user`,
      handoffs: [USER_HANDLE],
    }),
  });

  assert.deepEqual(result.speakers, ['adv-1', 'adv-2', 'adv-3']);
  assert.equal(result.stoppedBy, 'user');
});

test('round-robin continues consecutive bot turns when structured peer handoff coexists with @user prose', async () => {
  const result = await runTurn({
    roster: ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: USER_MSG,
    language: 'en',
    rounds: 1,
    generate: ({ bot, waiting }) => {
      const next = waiting[0];
      return next
        ? { text: `${bot.name} to @user and @${next.name}`, handoffs: [next.id] }
        : { text: `${bot.name} final @user`, handoffs: [USER_HANDLE] };
    },
  });

  assert.deepEqual(result.speakers, ['adv-1', 'adv-2', 'adv-3']);
  assert.equal(result.stoppedBy, 'user');
});

test('byokGenerator preserves peer handoff when model returns tool call with empty content', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: '',
              tool_calls: [{ function: { name: 'message_agent', arguments: '{"target":"Skeptic"}' } }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  try {
    const gen = byokGenerator({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
    });

    const turn = await gen({
      bot: ROSTER[0],
      roster: ROSTER,
      history: [USER_MSG],
      waiting: [ROSTER[1], ROSTER[2]],
      handoffTargets: [ROSTER[1], ROSTER[2]],
      isClosing: false,
      prompt: USER_MSG.body,
      language: 'en',
      attachments: [],
      mode: 'round-robin',
    });

    assert.equal(turn.silent, true);
    assert.deepEqual(turn.handoffs, ['adv-2']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
