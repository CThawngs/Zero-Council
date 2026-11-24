// Strict BYOK verification: a garbage, expired or unauthorized key must NEVER verify, for any
// built-in provider or custom OpenAI/Anthropic endpoint. fetch is stubbed — no network, no real key.
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  checkKeyShape,
  isAllowedProviderBaseUrl,
  parseModelList,
  probeModel,
  verifyProviderKey,
  httpStatusForVerifyError,
} = await import('../web/src/lib/byok/verify.ts');
const { PROVIDERS, verifyTargetFor, verifyProviderConnection, testProviderModel, fetchProviderModels } =
  await import('../web/src/prototype/chat/byok.ts?strict=1');

// Long enough to pass the shape check, obviously not a real credential.
const GARBAGE_KEY = 'asdf1234567890garbage';

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const html = (status = 200) =>
  new Response('<!DOCTYPE html><html><head><title>Welcome</title></head><body>Gateway</body></html>', {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

/**
 * Builds a fetch stub from ordered [matcher, responder] routes and records every call.
 * A request matching no route fails the test loudly.
 */
const router = (routes) => {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url, method, headers: init.headers ?? {}, body, redirect: init.redirect });
    for (const [match, respond] of routes) {
      if (match(url, method)) return typeof respond === 'function' ? respond(url, body, calls.length) : respond.clone();
    }
    throw new Error(`unexpected request ${method} ${url}`);
  };
  return { impl, calls };
};
const endsWith = (suffix, method) => (url, m) => url.split('?')[0].endsWith(suffix) && (!method || m === method);

const withGlobalFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
};

const publicModelList = json(200, {
  object: 'list',
  data: [{ id: 'nvidia/nemotron-3.5-super-vl-120b-a12b' }, { id: 'openai/gpt-4o-mini' }, { id: 'gpt-4o' }],
});

// ── Key shape: rejected before any network call ──────────────────────────────────────────────

test('empty, whitespace, placeholder and malformed keys are rejected without calling the provider', async () => {
  const cases = [
    ['', 'EMPTY_KEY'],
    ['    ', 'EMPTY_KEY'],
    ['sk-…', 'INVALID_KEY'],
    ['sk-ant-…', 'INVALID_KEY'],
    ['your-api-key', 'INVALID_KEY'],
    ['YOUR_API_KEY_HERE', 'INVALID_KEY'],
    ['sk-xxxxxxxxxxxx', 'INVALID_KEY'],
    ['sk-************', 'INVALID_KEY'],
    ['abc', 'INVALID_KEY'],
    ['sk-has space-inside-key', 'INVALID_KEY'],
    ['sk-tab\tinside-key-123', 'INVALID_KEY'],
    ['x'.repeat(600), 'INVALID_KEY'],
  ];
  const { impl, calls } = router([]);
  for (const [key, expected] of cases) {
    assert.equal(checkKeyShape(key), expected, `shape of ${JSON.stringify(key.slice(0, 20))}`);
    const result = await verifyProviderKey(verifyTargetFor('openai'), key, { fetchImpl: impl });
    assert.deepEqual(result, { ok: false, error: expected });
  }
  assert.equal(calls.length, 0, 'no request may leave for an obviously invalid key');
  assert.equal(checkKeyShape(GARBAGE_KEY), null, 'a plausible-looking garbage key still needs the live check');
});

// ── The original bug: public 200 /models must never be enough ────────────────────────────────

test('OpenRouter garbage key: public 200 /models + 401 /auth/key -> INVALID_KEY', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), publicModelList],
    [endsWith('/auth/key', 'GET'), json(401, { error: { message: 'No auth credentials found', code: 401 } })],
    [endsWith('/chat/completions', 'POST'), json(401, { error: { message: 'No auth credentials found' } })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('openrouter'), GARBAGE_KEY, { fetchImpl: impl });
  assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' });
  assert.ok(calls.some((c) => c.url === 'https://openrouter.ai/api/v1/auth/key'), 'must hit /auth/key');
  assert.equal(calls.find((c) => c.url.endsWith('/auth/key')).headers.Authorization, `Bearer ${GARBAGE_KEY}`);
});

test('OpenRouter garbage key is rejected even if /auth/key were bypassed: the chat probe 401s', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), publicModelList],
    [endsWith('/auth/key', 'GET'), json(200, { data: { label: 'sk-or-v1-...', usage: 0 } })],
    [endsWith('/chat/completions', 'POST'), json(401, { error: { message: 'User not found.', code: 401 } })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('openrouter'), GARBAGE_KEY, { fetchImpl: impl });
  assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' });
});

test('NVIDIA NIM garbage key: public 200 /models + 401/403 on inference -> INVALID_KEY', async () => {
  for (const status of [401, 403]) {
    const { impl, calls } = router([
      [endsWith('/models', 'GET'), publicModelList],
      [endsWith('/chat/completions', 'POST'), json(status, { status, title: 'Unauthorized', detail: 'Authentication failed' })],
    ]);
    const result = await verifyProviderKey(verifyTargetFor('nvidia'), GARBAGE_KEY, { fetchImpl: impl });
    assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' }, `status ${status}`);
    const probe = calls.find((c) => c.method === 'POST');
    assert.equal(probe.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(probe.body.model, 'nvidia/nemotron-3.5-super-vl-120b-a12b');
    assert.equal(probe.body.max_tokens, 1, 'probe must be a minimal 1-token call');
  }
});

test('every built-in provider: a public 200 /models alone NEVER verifies a garbage key', async () => {
  assert.equal(PROVIDERS.length, 8);
  for (const provider of PROVIDERS) {
    const listBody =
      provider.protocol === 'google'
        ? { models: [{ name: `models/${provider.models[0].id}`, supportedGenerationMethods: ['generateContent'] }] }
        : { data: provider.models.map((m) => ({ id: m.id })) };
    const { impl, calls } = router([
      [endsWith('/models', 'GET'), json(200, listBody)],
      [endsWith('/auth/key', 'GET'), json(401, { error: { message: 'No auth credentials found' } })],
      [(url, m) => m === 'POST', json(401, { error: { message: 'invalid credentials' } })],
    ]);
    const result = await verifyProviderKey(verifyTargetFor(provider.id), GARBAGE_KEY, { fetchImpl: impl });
    assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' }, provider.id);
    assert.ok(calls.every((c) => c.url.startsWith(provider.baseUrl)), `${provider.id} stays on its locked base URL`);
  }
});

test('custom OpenAI and Anthropic gateways with public /models still require a passing probe', async () => {
  for (const protocol of ['openai', 'anthropic']) {
    const { impl } = router([
      [endsWith('/models', 'GET'), json(200, { data: [{ id: 'my-model' }] })],
      [(url, m) => m === 'POST', json(401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } })],
    ]);
    const target = verifyTargetFor({
      provider: `custom:${protocol}:gw`,
      protocol,
      baseUrl: 'https://gw.example.com/v1',
    });
    const result = await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl });
    assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' }, protocol);
  }
});

// ── Non-API endpoints ────────────────────────────────────────────────────────────────────────

test('custom URL answering 200 HTML (a website, not an API) -> INVALID_BASE_URL', async () => {
  const { impl } = router([[() => true, () => html(200)]]);
  const target = verifyTargetFor({ provider: 'custom:openai:site', protocol: 'openai', baseUrl: 'https://example.com' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
});

test('custom URL with no /models (404 HTML) whose chat endpoint returns 200 HTML -> INVALID_BASE_URL', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), () => html(404)],
    [endsWith('/chat/completions', 'POST'), () => html(200)],
  ]);
  const target = verifyTargetFor({ provider: 'custom:openai:spa', protocol: 'openai', baseUrl: 'https://spa.example.com/v1' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl, model: 'gpt-x' }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
});

test('200 JSON that is not an inference answer (health check style) -> INVALID_BASE_URL', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'm1' }] })],
    [endsWith('/chat/completions', 'POST'), json(200, { status: 'ok' })],
  ]);
  const target = verifyTargetFor({ provider: 'custom:openai:echo', protocol: 'openai', baseUrl: 'https://echo.example.com/v1' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
});

test('200 with an auth error body (gateway that never sets status codes) -> INVALID_KEY', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), json(404, { error: 'not found' })],
    [endsWith('/chat/completions', 'POST'), json(200, { error: { message: 'Invalid API key', code: 401 } })],
  ]);
  const target = verifyTargetFor({ provider: 'custom:openai:lazy', protocol: 'openai', baseUrl: 'https://lazy.example.com/v1' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl, model: 'm' }), {
    ok: false,
    error: 'INVALID_KEY',
  });
});

test('a redirect away from the API host is refused (no SSRF via 30x) -> INVALID_BASE_URL', async () => {
  const { impl, calls } = router([
    [() => true, () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })],
  ]);
  const target = verifyTargetFor({ provider: 'custom:openai:bounce', protocol: 'openai', baseUrl: 'https://bounce.example.com/v1' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
  assert.ok(calls.every((c) => c.redirect === 'manual'), 'redirects must not be followed automatically');
});

// ── Provider-specific auth failures ──────────────────────────────────────────────────────────

test('Google 400 API_KEY_INVALID on /models -> INVALID_KEY, key sent as header (never in the URL)', async () => {
  const { impl, calls } = router([
    [
      endsWith('/models', 'GET'),
      json(400, {
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT',
          details: [{ reason: 'API_KEY_INVALID' }],
        },
      }),
    ],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('google'), GARBAGE_KEY, { fetchImpl: impl });
  assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' });
  assert.equal(calls[0].headers['x-goog-api-key'], GARBAGE_KEY);
  assert.ok(!calls[0].url.includes(GARBAGE_KEY), 'key must not appear in the URL');
});

test('Google 400 API_KEY_INVALID on generateContent -> INVALID_KEY', async () => {
  const { impl } = router([
    [(url, m) => m === 'POST', json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } })],
  ]);
  const outcome = await probeModel(verifyTargetFor('google'), GARBAGE_KEY, 'gemini-2.5-flash', { fetchImpl: impl });
  assert.deepEqual(outcome, { ok: false, error: 'INVALID_KEY' });
});

test('Anthropic and OpenAI 401/403 -> INVALID_KEY', async () => {
  for (const providerId of ['anthropic', 'openai']) {
    for (const status of [401, 403]) {
      const { impl } = router([[() => true, json(status, { error: { type: 'authentication_error', message: 'invalid' } })]]);
      const result = await verifyProviderKey(verifyTargetFor(providerId), GARBAGE_KEY, { fetchImpl: impl });
      assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' }, `${providerId} ${status}`);
    }
  }
});

test('xAI-style 400 "Incorrect API key provided" -> INVALID_KEY', async () => {
  const { impl } = router([
    [() => true, json(400, { code: 'Client specified an invalid argument', error: 'Incorrect API key provided: as***ge.' })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('xai'), GARBAGE_KEY, { fetchImpl: impl });
  assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' });
});

test('failure results never carry provider text (which may echo part of the key)', async () => {
  const { impl } = router([
    [() => true, json(401, { error: { message: `Incorrect API key provided: ${GARBAGE_KEY}` } })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('openai'), GARBAGE_KEY, { fetchImpl: impl });
  assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' });
  assert.ok(!JSON.stringify(result).includes(GARBAGE_KEY));
});

// ── Valid keys pass both model fetch and live probe ──────────────────────────────────────────

test('valid OpenAI key: /models + 1-token probe (max_completion_tokens) -> verified', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'gpt-4o' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o-mini' }] })],
    [endsWith('/chat/completions', 'POST'), json(200, { choices: [{ message: { content: 'p' }, finish_reason: 'length' }] })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('openai'), 'sk-proj-validlookingkey123', { fetchImpl: impl });
  assert.deepEqual(result, {
    ok: true,
    verifiedModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini'],
  });
  const probe = calls.find((c) => c.method === 'POST');
  assert.equal(probe.body.max_completion_tokens, 1);
  assert.equal(probe.body.max_tokens, undefined);
});

test('valid Anthropic key: x-api-key + anthropic-version, max_tokens 1 -> verified', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'claude-sonnet-4-5', type: 'model' }] })],
    [endsWith('/messages', 'POST'), json(200, { type: 'message', content: [{ type: 'text', text: 'p' }] })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('anthropic'), 'sk-ant-api03-validlooking', { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'claude-sonnet-4-5');
  const probe = calls.find((c) => c.method === 'POST');
  assert.equal(probe.headers['x-api-key'], 'sk-ant-api03-validlooking');
  assert.equal(probe.headers['anthropic-version'], '2023-06-01');
  assert.equal(probe.body.max_tokens, 1);
});

test('valid Google key: generateContent with maxOutputTokens 1 -> verified', async () => {
  const { impl, calls } = router([
    [
      endsWith('/models', 'GET'),
      json(200, {
        models: [
          { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    ],
    [endsWith(':generateContent', 'POST'), json(200, { candidates: [{ finishReason: 'MAX_TOKENS' }], usageMetadata: {} })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('google'), 'AIzaSyValidLookingKey000', { fetchImpl: impl });
  assert.deepEqual(result, { ok: true, verifiedModel: 'gemini-3.5-flash-lite', models: ['gemini-3.5-flash-lite'] });
  const probe = calls.find((c) => c.method === 'POST');
  assert.equal(probe.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(probe.body.generationConfig.maxOutputTokens, 1);
});

test('valid OpenRouter key: /auth/key 200 + probe -> verified; free model tried when credits run out', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'openai/gpt-4o-mini' }, { id: 'meta-llama/llama-3.3-8b-instruct:free' }] })],
    [endsWith('/auth/key', 'GET'), json(200, { data: { label: 'sk-or-v1-abc', limit: null, usage: 0 } })],
    [
      endsWith('/chat/completions', 'POST'),
      (_url, body) =>
        body.model === 'openai/gpt-4o-mini'
          ? json(402, { error: { message: 'Insufficient credits', code: 402 } })
          : json(200, { choices: [{ message: { content: 'p' } }] }),
    ],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('openrouter'), 'sk-or-v1-validlooking', { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'meta-llama/llama-3.3-8b-instruct:free');
  assert.equal(calls.filter((c) => c.method === 'POST').length, 2);
});

test('valid custom Anthropic-compatible gateway without /models verifies with an explicit model', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), json(404, { error: { type: 'not_found_error' } })],
    [endsWith('/messages', 'POST'), json(200, { content: [{ type: 'text', text: 'p' }] })],
  ]);
  const target = verifyTargetFor({ provider: 'custom:anthropic:proxy', protocol: 'anthropic', baseUrl: 'https://proxy.example.com/v1/' });
  assert.equal(target.baseUrl, 'https://proxy.example.com/v1');
  const result = await verifyProviderKey(target, 'proxy-key-1234567', { fetchImpl: impl, model: 'claude-proxy' });
  assert.deepEqual(result, { ok: true, verifiedModel: 'claude-proxy', models: ['claude-proxy'] });
});

test('custom gateway without /models and without a model to try -> NO_MODELS (never verified)', async () => {
  const { impl } = router([[endsWith('/models', 'GET'), json(404, { error: 'not found' })]]);
  const target = verifyTargetFor({ provider: 'custom:openai:bare', protocol: 'openai', baseUrl: 'https://bare.example.com/v1' });
  assert.deepEqual(await verifyProviderKey(target, 'bare-key-1234567', { fetchImpl: impl }), { ok: false, error: 'NO_MODELS' });
});

test('custom Base URL that is a website (HTML 404 on /models) and no model -> INVALID_BASE_URL', async () => {
  const { impl, calls } = router([[endsWith('/models', 'GET'), html(404)]]);
  const target = verifyTargetFor({ provider: 'custom:openai:site', protocol: 'openai', baseUrl: 'https://example.com' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl }), { ok: false, error: 'INVALID_BASE_URL' });
  assert.equal(calls.length, 1, 'no inference call is sent to a website');
});

test('NVIDIA quirks: EOL model (410) and non-chat model (plain-text 404) are skipped, garbage key still -> INVALID_KEY', async () => {
  const plainNotFound = () =>
    new Response('404 page not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { impl, calls } = router([
    [
      endsWith('/models', 'GET'),
      json(200, {
        data: [
          { id: 'bigcode/starcoder2-15b' },
          { id: 'meta/llama-3.1-70b-instruct' },
          { id: 'nvidia/nv-embedqa-e5-v5' },
          { id: 'deepseek-ai/deepseek-r1' },
          { id: 'mistralai/mistral-large-4-1t-a52b' },
        ],
      }),
    ],
    [
      endsWith('/chat/completions', 'POST'),
      (_url, body) => {
        if (body.model === 'meta/llama-3.1-70b-instruct') {
          return json(410, { status: 410, title: 'Gone', detail: 'This model has reached its end of life' });
        }
        if (body.model === 'deepseek-ai/deepseek-r1') return plainNotFound();
        return json(401, { status: 401, title: 'Unauthorized', detail: 'Invalid JWT serialization' });
      },
    ],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('nvidia'), GARBAGE_KEY, { fetchImpl: impl });
  assert.deepEqual(result, { ok: false, error: 'INVALID_KEY' });
  const probed = calls.filter((c) => c.method === 'POST').map((c) => c.body.model);
  assert.deepEqual(probed, ['deepseek-ai/deepseek-r1', 'meta/llama-3.1-70b-instruct', 'mistralai/mistral-large-4-1t-a52b']);
  assert.ok(!probed.some((id) => /starcoder|embed/.test(id)), 'non-chat models are never probed');
});

test('NVIDIA quirks never verify on their own: 410 + plain-text 404 only -> MODEL_NOT_FOUND', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'old/model-a' }, { id: 'old/model-b' }] })],
    [
      endsWith('/chat/completions', 'POST'),
      (_url, body) =>
        body.model === 'old/model-a'
          ? json(410, { detail: 'end of life' })
          : new Response('404 page not found', { status: 404, headers: { 'content-type': 'text/plain' } }),
    ],
  ]);
  const target = verifyTargetFor({ provider: 'custom:openai:nim', protocol: 'openai', baseUrl: 'https://nim.example.com/v1' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl }), { ok: false, error: 'MODEL_NOT_FOUND' });
});

test('plain-text 404 on inference when /models was NOT a JSON API -> INVALID_BASE_URL', async () => {
  const { impl } = router([
    [endsWith('/models', 'GET'), new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } })],
    [endsWith('/chat/completions', 'POST'), new Response('404 page not found', { status: 404, headers: { 'content-type': 'text/plain' } })],
  ]);
  const target = verifyTargetFor({ provider: 'custom:openai:wrong', protocol: 'openai', baseUrl: 'https://wrong.example.com' });
  assert.deepEqual(await verifyProviderKey(target, GARBAGE_KEY, { fetchImpl: impl, model: 'gpt-4o' }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
});

// ── Model selection and quirks ───────────────────────────────────────────────────────────────

test('an explicit model that does not exist -> MODEL_NOT_FOUND, with no silent substitution', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'gpt-4o' }] })],
    [endsWith('/chat/completions', 'POST'), json(404, { error: { message: 'The model `nope` does not exist', code: 'model_not_found' } })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('openai'), 'sk-proj-validlookingkey123', { fetchImpl: impl, model: 'nope' });
  assert.deepEqual(result, { ok: false, error: 'MODEL_NOT_FOUND' });
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
});

test('default model missing -> next discovered chat model is probed; embedding models are skipped', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'text-embedding-3-large' }, { id: 'llama-3.1-8b-instant' }] })],
    [endsWith('/chat/completions', 'POST'), json(200, { choices: [{ message: { content: 'p' } }] })],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('groq'), 'gsk_validlookingkey123', { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'llama-3.1-8b-instant');
  assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => c.body.model), ['llama-3.1-8b-instant']);
});

test('token-parameter 400 is retried with the other field and passes on the retry', async () => {
  const { impl, calls } = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'deepseek-chat' }] })],
    [
      endsWith('/chat/completions', 'POST'),
      (_url, body) =>
        'max_tokens' in body
          ? json(400, { error: { message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens'." } })
          : json(200, { choices: [{ message: { content: 'p' } }] }),
    ],
  ]);
  const result = await verifyProviderKey(verifyTargetFor('deepseek'), 'sk-validlookingkey123', { fetchImpl: impl });
  assert.equal(result.ok, true);
  const probes = calls.filter((c) => c.method === 'POST');
  assert.equal(probes.length, 2);
  assert.equal(probes[1].body.max_completion_tokens, 4);
});

test('a persistent token-parameter 400 passes ONLY when auth was proven elsewhere', async () => {
  const quirk = json(400, { error: { message: 'Could not finish the message because max_tokens or model output limit was reached.' } });
  const proven = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'o3-mini' }] })],
    [endsWith('/chat/completions', 'POST'), quirk],
  ]);
  const openai = await verifyProviderKey(verifyTargetFor('openai'), 'sk-proj-validlookingkey123', {
    fetchImpl: proven.impl,
    model: 'o3-mini',
  });
  assert.equal(openai.ok, true, 'OpenAI /models is authenticated, so the key is proven');

  const unproven = router([
    [endsWith('/models', 'GET'), publicModelList],
    [endsWith('/chat/completions', 'POST'), quirk],
  ]);
  const nvidia = await verifyProviderKey(verifyTargetFor('nvidia'), GARBAGE_KEY, { fetchImpl: unproven.impl });
  assert.deepEqual(nvidia, { ok: false, error: 'PROVIDER_ERROR' }, 'public /models proves nothing');
});

test('429 -> RATE_LIMITED, network error -> NETWORK_FAILED, timeout -> TIMEOUT (never verified)', async () => {
  const limited = router([
    [endsWith('/models', 'GET'), json(200, { data: [{ id: 'gpt-4o' }] })],
    [endsWith('/chat/completions', 'POST'), json(429, { error: { message: 'Rate limit reached' } })],
  ]);
  assert.deepEqual(
    await verifyProviderKey(verifyTargetFor('openai'), 'sk-proj-validlookingkey123', { fetchImpl: limited.impl }),
    { ok: false, error: 'RATE_LIMITED' }
  );
  const offline = async () => {
    throw new TypeError('fetch failed');
  };
  assert.deepEqual(await verifyProviderKey(verifyTargetFor('openai'), GARBAGE_KEY, { fetchImpl: offline }), {
    ok: false,
    error: 'NETWORK_FAILED',
  });
  const slow = async () => {
    throw new DOMException('The operation timed out.', 'TimeoutError');
  };
  assert.deepEqual(await verifyProviderKey(verifyTargetFor('openai'), GARBAGE_KEY, { fetchImpl: slow }), {
    ok: false,
    error: 'TIMEOUT',
  });
});

// ── SSRF guard used by the server for custom Base URLs ───────────────────────────────────────

test('custom Base URL SSRF guard refuses private/loopback hosts in production mode', () => {
  const production = { allowPrivateNetwork: false };
  for (const url of [
    'http://localhost:11434/v1',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://10.0.0.5/v1',
    'https://172.20.1.1/v1',
    'https://192.168.1.10/v1',
    'https://169.254.169.254/latest',
    'https://[::1]/v1',
    'https://[fd00::1]/v1',
    'https://printer.local/v1',
    'https://metadata.google.internal/v1',
    'http://api.public-gateway.com/v1',
    'https://user:pass@api.example.com/v1',
    'ftp://api.example.com/v1',
    'not a url',
  ]) {
    assert.equal(isAllowedProviderBaseUrl(url, production), false, url);
  }
  assert.equal(isAllowedProviderBaseUrl('https://api.together.xyz/v1', production), true);
  assert.equal(isAllowedProviderBaseUrl('http://localhost:11434/v1', { allowPrivateNetwork: true }), true);
});

// ── Browser helper: server verdict is final, fallback only when the server cannot judge ──────

test('verifyProviderConnection: a server INVALID_KEY verdict is final (no direct provider calls)', async () => {
  const { impl, calls } = router([
    [endsWith('/api/providers/verify', 'POST'), json(422, { ok: false, error: 'INVALID_KEY' })],
  ]);
  await withGlobalFetch(impl, async () => {
    await assert.rejects(() => verifyProviderConnection('openrouter', GARBAGE_KEY), /^Error: INVALID_KEY$/);
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { provider: 'openrouter', key: GARBAGE_KEY });
});

test('verifyProviderConnection: custom target sends protocol + baseUrl and returns the server result', async () => {
  const { impl, calls } = router([
    [endsWith('/api/providers/verify', 'POST'), json(200, { ok: true, models: ['m1', 'm2'], verifiedModel: 'm2' })],
  ]);
  const result = await withGlobalFetch(impl, () =>
    verifyProviderConnection(
      { provider: 'custom:openai:gw', protocol: 'openai', baseUrl: 'https://gw.example.com/v1/' },
      'gw-key-1234567',
      { model: 'm2' }
    )
  );
  assert.deepEqual(result, { models: ['m1', 'm2'], verifiedModel: 'm2' });
  assert.deepEqual(calls[0].body, {
    provider: 'custom:openai:gw',
    key: 'gw-key-1234567',
    model: 'm2',
    protocol: 'openai',
    baseUrl: 'https://gw.example.com/v1',
  });
});

test('verifyProviderConnection: signed out (NEED_LOGIN) falls back to the strict direct check', async () => {
  const { impl, calls } = router([
    [endsWith('/api/providers/verify', 'POST'), json(401, { error: 'NEED_LOGIN' })],
    [endsWith('/models', 'GET'), publicModelList],
    [endsWith('/chat/completions', 'POST'), json(401, { error: { message: 'Authentication failed' } })],
  ]);
  await withGlobalFetch(impl, async () => {
    await assert.rejects(() => verifyProviderConnection('nvidia', GARBAGE_KEY), /INVALID_KEY/);
  });
  assert.ok(calls.some((c) => c.url.startsWith('https://integrate.api.nvidia.com/v1/chat/completions')));
});

test('verifyProviderConnection rejects placeholder keys locally, before any request', async () => {
  const { impl, calls } = router([]);
  await withGlobalFetch(impl, async () => {
    await assert.rejects(() => verifyProviderConnection('openai', 'sk-…'), /INVALID_KEY/);
    await assert.rejects(() => verifyProviderConnection('openai', '  '), /EMPTY_KEY/);
  });
  assert.equal(calls.length, 0);
});

test('legacy helpers are strict too: fetchProviderModels and testProviderModel reject public/HTML 200s', async () => {
  const publicOnly = router([
    [endsWith('/models', 'GET'), publicModelList],
    [endsWith('/chat/completions', 'POST'), json(401, { error: { message: 'Unauthorized' } })],
  ]);
  await withGlobalFetch(publicOnly.impl, async () => {
    await assert.rejects(() => fetchProviderModels('nvidia', GARBAGE_KEY), /INVALID_KEY/);
  });
  const htmlOnly = router([[() => true, () => html(200)]]);
  await withGlobalFetch(htmlOnly.impl, async () => {
    await assert.rejects(
      () =>
        testProviderModel(
          { provider: 'custom:openai:site', protocol: 'openai', baseUrl: 'https://example.com', apiKey: GARBAGE_KEY },
          'any-model'
        ),
      /INVALID_BASE_URL/
    );
  });
});

test('parseModelList and HTTP status mapping', () => {
  assert.deepEqual(parseModelList('openai', { data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }, { id: 7 }, {}] }), ['a', 'b']);
  assert.deepEqual(parseModelList('openai', [{ id: 'x' }]), ['x']);
  assert.deepEqual(parseModelList('google', { models: [{ name: 'models/g1' }] }), ['g1']);
  assert.equal(httpStatusForVerifyError('INVALID_KEY'), 422);
  assert.equal(httpStatusForVerifyError('RATE_LIMITED'), 429);
  assert.equal(httpStatusForVerifyError('NETWORK_FAILED'), 502);
});
