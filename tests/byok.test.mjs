/**
 * The BYOK adapter is the only place provider wire formats touch the engine. These tests stub
 * `fetch`, so they prove the mapping — tool call becomes `handoffs`, text becomes `text` — without a
 * key, a network call, or a provider account.
 *
 * They also cover the case that matters most in production: a model that ignores the schema. A
 * dropped name would leave the room stalled with no explanation, so an unresolvable target has to
 * close the round back to the user instead.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

const { byokGenerator, PROVIDERS, providerById, resolveTarget } = await import('../web/src/prototype/chat/byok.ts');
const { USER_HANDLE } = await import('../web/src/prototype/chat/engine.ts');

const ROSTER = [
  { id: 'pragmatist', name: 'The Pragmatist' },
  { id: 'dreamer', name: 'The Dreamer' },
  { id: 'skeptic', name: 'The Skeptic' },
];

const request = (over = {}) => ({
  bot: ROSTER[1],
  history: [{ id: '0', authorId: USER_HANDLE, body: 'Should we ship?', mentioned: [] }],
  waiting: ROSTER,
  isClosing: false,
  prompt: 'Should we ship?',
  language: 'en',
  ...over,
});

/** Replaces global fetch for one call and restores it after. */
const withResponse = async (payload, ok = true, status = 200, run) => {
  const original = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), body: JSON.parse(init.body), headers: init.headers };
    return {
      ok,
      status,
      text: async () => (ok ? '' : JSON.stringify({ error: 'nope' })),
      json: async () => payload,
    };
  };
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  return seen;
};

const anthropicTurn = (content) => ({ choices: [], content });

test('a provider registry exists for both vendors, with no invented entries', () => {
  assert.deepEqual(
    PROVIDERS.map((p) => p.id),
    ['anthropic', 'openai'],
    'exactly the two providers that were asked for'
  );
  assert.equal(providerById('anthropic').models[0].id, 'claude-sonnet-4-5');
  assert.ok(providerById('openai').models.length >= 1);
});

test('an Anthropic tool_use call becomes a structured handoff', async () => {
  let turn;
  await withResponse(
    anthropicTurn([
      { type: 'text', text: 'Reversibility is the risk.' },
      { type: 'tool_use', name: 'message_agent', input: { target: 'The Skeptic' } },
    ]),
    true,
    200,
    async () => {
      turn = await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request());
    }
  );
  assert.equal(turn.text, 'Reversibility is the risk.');
  assert.deepEqual(turn.handoffs, ['skeptic'], 'routed by id, not by parsing the prose');
  assert.equal(turn.silent, undefined);
});

test('the request declares the tool and names the human as a target', async () => {
  const seen = await withResponse(anthropicTurn([{ type: 'text', text: 'ok' }]), true, 200, async () => {
    await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request());
  });
  assert.equal(seen.body.tools[0].name, 'message_agent');
  assert.ok(seen.body.tools[0].input_schema.required.includes('target'));
  assert.match(seen.body.system, /"user"/, 'the advisor is told how to hand back to the human');
});

test('an OpenAI tool_call argument string is parsed into the same shape', async () => {
  let turn;
  await withResponse(
    {
      choices: [
        {
          message: {
            content: 'Purpose outranks speed here.',
            tool_calls: [{ function: { name: 'message_agent', arguments: '{"target":"dreamer"}' } }],
          },
        },
      ],
    },
    true,
    200,
    async () => {
      turn = await byokGenerator({ provider: 'openai', model: 'gpt-4o', apiKey: 'k' })(request());
    }
  );
  assert.equal(turn.text, 'Purpose outranks speed here.');
  assert.deepEqual(turn.handoffs, ['dreamer']);
});

test('malformed tool arguments lose the handoff but keep the reply', async () => {
  let turn;
  await withResponse(
    { choices: [{ message: { content: 'Still my position.', tool_calls: [{ function: { name: 'message_agent', arguments: '{not json' } }] } }] },
    true,
    200,
    async () => {
      turn = await byokGenerator({ provider: 'openai', model: 'gpt-4o', apiKey: 'k' })(request());
    }
  );
  assert.equal(turn.text, 'Still my position.', 'the answer survives even when routing cannot be read');
  assert.deepEqual(turn.handoffs, [USER_HANDLE], 'and the room closes cleanly instead of stalling');
});

test('a reply of nothing, or the silent token, is a pass and not a failure', async () => {
  for (const content of [[], [{ type: 'text', text: '[SILENT]' }]]) {
    let turn;
    await withResponse(anthropicTurn(content), true, 200, async () => {
      turn = await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request());
    });
    assert.equal(turn.silent, true);
    assert.deepEqual(turn.handoffs, []);
    assert.equal(turn.text, '', 'a silent turn shows nothing in the room');
  }
});

test('prose alone never routes, even when it names someone', async () => {
  let turn;
  await withResponse(
    anthropicTurn([{ type: 'text', text: 'I agree with @The Skeptic about rollback.' }]),
    true,
    200,
    async () => {
      turn = await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request());
    }
  );
  assert.deepEqual(turn.handoffs, [], 'a quoted mention is not a handoff');
});

test('an unusable provider response raises, so the engine can say what happened', async () => {
  await assert.rejects(
    () =>
      withResponse(null, false, 429, () =>
        byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request())
      ),
    /429/,
    'the status must survive, because that is what makes a failure retryable'
  );
});

test('target resolution accepts the shapes models actually return', () => {
  assert.deepEqual(resolveTarget('The Skeptic', ROSTER), ['skeptic']);
  assert.deepEqual(resolveTarget('@The Skeptic', ROSTER), ['skeptic']);
  assert.deepEqual(resolveTarget('skeptic', ROSTER), ['skeptic'], 'bare id');
  assert.deepEqual(resolveTarget('user', ROSTER), [USER_HANDLE]);
  assert.deepEqual(resolveTarget('', ROSTER), []);
  assert.deepEqual(resolveTarget('whoever is listening', ROSTER), [], 'nonsense resolves to nobody');
});