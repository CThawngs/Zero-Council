import assert from 'node:assert/strict';
import test from 'node:test';

const {
  byokGenerator,
  completeByokText,
  PROVIDERS,
  providerById,
  resolveProviderEndpoint,
  testProviderModel,
  resolveTarget,
} = await import('../web/src/prototype/chat/byok.ts');
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

const withResponse = async (payload, ok = true, status = 200, run) => {
  const original = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), body: init?.body ? JSON.parse(init.body) : null, headers: init?.headers };
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

test('provider registry includes all 8 verified built-in BYOK providers with locked base URLs', () => {
  assert.deepEqual(
    PROVIDERS.map((p) => p.id),
    ['anthropic', 'openai', 'google', 'groq', 'xai', 'openrouter', 'nvidia', 'deepseek']
  );
  for (const p of PROVIDERS) {
    assert.equal(p.lockedBaseUrl, true, `${p.id} must lock its Base URL`);
    assert.match(p.baseUrl, /^https:\/\//, `${p.id} must have an https baseUrl`);
    const resolved = resolveProviderEndpoint({
      provider: p.id,
      baseUrl: 'https://evil.example.com/v1',
      protocol: 'openai',
    });
    assert.equal(
      resolved.baseUrl,
      p.baseUrl,
      `${p.id} refuses custom baseUrl tampering and stays locked to canonical endpoint`
    );
  }
  assert.equal(providerById('anthropic').models[0].id, 'claude-sonnet-4-5');
  assert.ok(providerById('openai').models.length >= 1);
  assert.equal(providerById('google').models[0].id, 'gemini-2.5-flash');
});

test('custom OpenAI-compatible and Anthropic-compatible endpoints resolve cleanly', () => {
  const customOai = resolveProviderEndpoint({
    provider: 'custom:openai:together-ai',
    protocol: 'openai',
    baseUrl: 'https://api.together.xyz/v1/',
  });
  assert.equal(customOai.isBuiltin, false);
  assert.equal(customOai.protocol, 'openai');
  assert.equal(customOai.baseUrl, 'https://api.together.xyz/v1');

  const customAnt = resolveProviderEndpoint({
    provider: 'custom:anthropic:my-claude-proxy',
    baseUrl: 'https://proxy.example.com/anthropic/v1/',
  });
  assert.equal(customAnt.isBuiltin, false);
  assert.equal(customAnt.protocol, 'anthropic');
  assert.equal(customAnt.baseUrl, 'https://proxy.example.com/anthropic/v1');
});

test('testProviderModel verifies custom model IDs and throws on 404/400', async () => {
  const seen = await withResponse(
    { choices: [{ message: { content: 'pong' } }] },
    true,
    200,
    async () => {
      const ok = await testProviderModel(
        {
          provider: 'custom:openai:litellm',
          apiKey: 'sk-custom',
          protocol: 'openai',
          baseUrl: 'https://litellm.example.com/v1',
        },
        'deepseek-reasoner'
      );
      assert.equal(ok, true);
    }
  );
  assert.equal(seen.url, 'https://litellm.example.com/v1/chat/completions');
  assert.equal(seen.body.model, 'deepseek-reasoner');

  await assert.rejects(
    () =>
      withResponse({ error: 'model not found' }, false, 404, () =>
        testProviderModel({ provider: 'openai', apiKey: 'sk-test-long-enough-key' }, 'nonexistent-model')
      ),
    /MODEL_NOT_FOUND|404/
  );
});

test('soloMode runs 1-on-1 without message_agent tool or peer handoffs', async () => {
  let turn;
  const seen = await withResponse(
    anthropicTurn([{ type: 'text', text: 'Direct 1-on-1 answer for you.' }]),
    true,
    200,
    async () => {
      turn = await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(
        request({ waiting: [{ id: 'bot:1', name: 'Atlas' }], soloMode: true })
      );
    }
  );
  assert.equal(seen.body.tools, undefined, 'solo 1-on-1 bot never declares message_agent tool');
  assert.equal(turn.text, 'Direct 1-on-1 answer for you.');
  assert.deepEqual(turn.handoffs, [USER_HANDLE]);
});

test('an Anthropic tool_use call becomes a structured handoff in group chat', async () => {
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
  assert.deepEqual(turn.handoffs, ['skeptic']);
  assert.equal(turn.silent, undefined);
});

test('the group request declares the tool and names the human as a target', async () => {
  const seen = await withResponse(anthropicTurn([{ type: 'text', text: 'ok' }]), true, 200, async () => {
    await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request());
  });
  assert.equal(seen.body.tools[0].name, 'message_agent');
  assert.ok(seen.body.tools[0].input_schema.required.includes('target'));
  assert.match(seen.body.system, /"user"/);
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
      turn = await byokGenerator({ provider: 'openai', model: 'gpt-4o', apiKey: 'k' })(
        request({ bot: ROSTER[0] })
      );
    }
  );
  assert.equal(turn.text, 'Purpose outranks speed here.');
  assert.deepEqual(turn.handoffs, ['dreamer']);
});

test('a bot (including the 2nd/closing bot) can never hand off to itself', async () => {
  // Case 1: waiting/handoffTargets contains other bots, but the bot targets itself.
  let selfTurn;
  await withResponse(
    {
      choices: [
        {
          message: {
            content: 'I will answer.',
            tool_calls: [{ function: { name: 'message_agent', arguments: '{"target":"The Dreamer"}' } }],
          },
        },
      ],
    },
    true,
    200,
    async () => {
      selfTurn = await byokGenerator({ provider: 'openai', model: 'gpt-4o', apiKey: 'k' })(
        request({ bot: ROSTER[1], waiting: ROSTER })
      );
    }
  );
  assert.deepEqual(selfTurn.handoffs, [USER_HANDLE]);

  // Case 2: 2nd bot on closing turn (handoffTargets is empty, isClosing is true) targets itself.
  let closingTurn;
  const seen = await withResponse(
    {
      choices: [
        {
          message: {
            content: 'Closing remarks.',
            tool_calls: [{ function: { name: 'message_agent', arguments: '{"target":"The Dreamer"}' } }],
          },
        },
      ],
    },
    true,
    200,
    async () => {
      closingTurn = await byokGenerator({ provider: 'openai', model: 'gpt-4o', apiKey: 'k' })(
        request({ bot: ROSTER[1], waiting: [], handoffTargets: [], isClosing: true })
      );
    }
  );
  assert.deepEqual(closingTurn.handoffs, [USER_HANDLE]);
  assert.match(seen.body.messages[0].content, /Never call message_agent with your own name/);
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
  assert.equal(turn.text, 'Still my position.');
  assert.deepEqual(turn.handoffs, [USER_HANDLE]);
});

test('a reply of nothing, or the silent token, is a pass and not a failure', async () => {
  for (const content of [[], [{ type: 'text', text: '[SILENT]' }]]) {
    let turn;
    await withResponse(anthropicTurn(content), true, 200, async () => {
      turn = await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request());
    });
    assert.equal(turn.silent, true);
    assert.deepEqual(turn.handoffs, []);
    assert.equal(turn.text, '');
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
  assert.deepEqual(turn.handoffs, []);
});

test('an unusable provider response raises, so the engine can say what happened', async () => {
  await assert.rejects(
    () =>
      withResponse(null, false, 429, () =>
        byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' })(request())
      ),
    /429/
  );
});

test('target resolution accepts the shapes models actually return', () => {
  assert.deepEqual(resolveTarget('The Skeptic', ROSTER), ['skeptic']);
  assert.deepEqual(resolveTarget('@The Skeptic', ROSTER), ['skeptic']);
  assert.deepEqual(resolveTarget('skeptic', ROSTER), ['skeptic']);
  assert.deepEqual(resolveTarget('user', ROSTER), [USER_HANDLE]);
  assert.deepEqual(resolveTarget('', ROSTER), []);
  assert.deepEqual(resolveTarget('whoever is listening', ROSTER), []);
});

test('a Google Gemini functionCall part becomes a structured handoff, merges consecutive self model turns, and ends with user', async () => {
  let turn;
  const multiHistory = [
    { id: '0', authorId: USER_HANDLE, body: 'Should we ship?', mentioned: [] },
    { id: '1', authorId: 'dreamer', body: 'First thought.', mentioned: [] },
    { id: '2', authorId: 'dreamer', body: 'Second thought.', mentioned: [] },
    { id: '3', authorId: 'pragmatist', body: 'Ship behind a flag.', mentioned: [] },
  ];
  const seen = await withResponse(
    {
      candidates: [
        {
          content: {
            parts: [
              { text: 'Stage the rollout in two cohorts.' },
              { functionCall: { name: 'message_agent', args: { target: 'The Pragmatist' } } },
            ],
          },
        },
      ],
    },
    true,
    200,
    async () => {
      turn = await byokGenerator({
        provider: 'google',
        model: 'models/gemini-2.5-flash',
        apiKey: 'g-key',
      })(request({ roster: ROSTER, history: multiHistory }));
    }
  );
  assert.match(seen.url, /models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(seen.headers['x-goog-api-key'], 'g-key');
  assert.equal(seen.body.contents.length, 3, 'user -> merged self model -> peer bot as user');
  assert.equal(seen.body.contents[0].role, 'user');
  assert.equal(seen.body.contents[1].role, 'model');
  assert.equal(seen.body.contents[1].parts[0].text, 'First thought.\n\nSecond thought.');
  assert.equal(seen.body.contents[2].role, 'user');
  assert.equal(seen.body.contents[2].parts[0].text, '[The Pragmatist]: Ship behind a flag.');
  assert.equal(turn.text, 'Stage the rollout in two cohorts.');
  assert.deepEqual(turn.handoffs, ['pragmatist']);
});

test('2nd bot turn always ends with user role across Google, Anthropic, and OpenAI', async () => {
  const afterBot1History = [
    { id: '0', authorId: USER_HANDLE, body: 'Should we ship?', mentioned: [] },
    { id: '1', authorId: 'pragmatist', body: 'Ship behind a flag.', mentioned: [] },
  ];

  const googleSeen = await withResponse(
    { candidates: [{ content: { parts: [{ text: 'Add rollback.' }] } }] },
    true,
    200,
    async () => {
      await byokGenerator({ provider: 'google', model: 'gemini-2.5-flash', apiKey: 'g-key' })(
        request({ bot: ROSTER[1], roster: ROSTER, history: afterBot1History })
      );
    }
  );
  assert.equal(googleSeen.body.contents.at(-1).role, 'user');
  assert.match(googleSeen.body.contents[0].parts[0].text, /\[The Pragmatist\]: Ship behind a flag\./);

  const anthropicSeen = await withResponse(
    anthropicTurn([{ type: 'text', text: 'Add rollback.' }]),
    true,
    200,
    async () => {
      await byokGenerator({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'a-key' })(
        request({ bot: ROSTER[1], roster: ROSTER, history: afterBot1History })
      );
    }
  );
  assert.equal(anthropicSeen.body.messages.at(-1).role, 'user');

  const openaiSeen = await withResponse(
    { choices: [{ message: { content: 'Add rollback.' } }] },
    true,
    200,
    async () => {
      await byokGenerator({ provider: 'openai', model: 'gpt-4o', apiKey: 'o-key' })(
        request({ bot: ROSTER[1], roster: ROSTER, history: afterBot1History })
      );
    }
  );
  assert.equal(openaiSeen.body.messages.at(-1).role, 'user');
});

test('completeByokText works across anthropic, openai, and google without tool declarations', async () => {
  await withResponse({ content: [{ type: 'text', text: 'Anthropic synthesis' }] }, true, 200, async () => {
    const res = await completeByokText({ provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'k' }, { system: 'sys', prompt: 'hi' });
    assert.equal(res, 'Anthropic synthesis');
  });
  await withResponse({ choices: [{ message: { content: 'OpenAI synthesis' } }] }, true, 200, async () => {
    const res = await completeByokText({ provider: 'openai', model: 'gpt-4o', apiKey: 'k' }, { system: 'sys', prompt: 'hi' });
    assert.equal(res, 'OpenAI synthesis');
  });
  await withResponse({ candidates: [{ content: { parts: [{ text: 'Google synthesis' }] } }] }, true, 200, async () => {
    const res = await completeByokText({ provider: 'google', model: 'gemini-2.5-flash', apiKey: 'k' }, { system: 'sys', prompt: 'hi' });
    assert.equal(res, 'Google synthesis');
  });
});
