// BYOK verification accuracy in BOTH directions:
//   - no false negatives: a correct key must connect even when one model is forbidden, rate limited,
//     slow, or the provider default is gone;
//   - no false positives: a wrong key / wrong Base URL must never connect.
// fetch is stubbed — no network, no real key.
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  classifyHttpFailure,
  normalizeProviderBaseUrl,
  probeCandidates,
  verifyProviderKey,
  PROBE_MAX_TOKENS,
} = await import('../web/src/lib/byok/verify.ts');
const { PROVIDERS, verifyTargetFor, normalizeBaseUrl } = await import(
  '../web/src/prototype/chat/byok.ts?classification=1'
);

const VALID_LOOKING_KEY = 'sk-validlooking-key-1234567890';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const html = (status) =>
  new Response('<!DOCTYPE html><html><body>Landing page</body></html>', {
    status,
    headers: { 'content-type': 'text/html' },
  });
const chatOk = (protocol) =>
  protocol === 'anthropic'
    ? json(200, { type: 'message', content: [{ type: 'text', text: 'p' }] })
    : protocol === 'google'
      ? json(200, { candidates: [{ content: { parts: [{ text: 'p' }] } }] })
      : json(200, { choices: [{ message: { content: 'p' } }] });

/** Records every call; `respond(url, method, body)` returns a Response or throws. */
const stub = (respond) => {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url, method, body, headers: init.headers ?? {} });
    return respond(url, method, body);
  };
  return { impl, calls };
};
const isList = (url, method) => method === 'GET' && url.split('?')[0].endsWith('/models');
const posts = (calls) => calls.filter((call) => call.method === 'POST');

// ── Pure classification matrix ───────────────────────────────────────────────────────────────

test('classifyHttpFailure: 401 is a definitive INVALID_KEY whatever happened before', () => {
  for (const authProven of [false, true]) {
    assert.deepEqual(classifyHttpFailure(401, '{}', 'json', { authProven, apiReachable: true }), {
      error: 'INVALID_KEY',
      definitive: true,
    });
  }
});

test('classifyHttpFailure: 403 depends on whether the key was already authenticated', () => {
  assert.deepEqual(classifyHttpFailure(403, '{"error":"forbidden"}', 'json', { authProven: false, apiReachable: true }), {
    error: 'INVALID_KEY',
    definitive: false,
  });
  assert.deepEqual(classifyHttpFailure(403, '{"error":"forbidden"}', 'json', { authProven: true, apiReachable: true }), {
    error: 'MODEL_ACCESS_DENIED',
    definitive: false,
  });
  // Explicit "wrong key" wording before authentication is final…
  assert.deepEqual(
    classifyHttpFailure(403, '{"detail":"Authentication failed"}', 'json', { authProven: false, apiReachable: true }),
    { error: 'INVALID_KEY', definitive: true }
  );
  // …but once /models or /auth/key accepted the key, the same wording on a 403 is an access issue.
  assert.equal(
    classifyHttpFailure(403, '{"detail":"Unauthorized for this model"}', 'json', { authProven: true, apiReachable: true }).error,
    'MODEL_ACCESS_DENIED'
  );
});

test('classifyHttpFailure: generic permission words never mean "invalid key" on their own', () => {
  for (const text of ['{"error":{"status":"PERMISSION_DENIED"}}', '{"message":"Forbidden"}', '{"param":"api_key"}']) {
    const verdict = classifyHttpFailure(400, text, 'json', { authProven: false, apiReachable: true });
    assert.notEqual(verdict.error, 'INVALID_KEY', text);
  }
});

test('classifyHttpFailure: quota, rate limit, missing model and wrong Base URL', () => {
  const context = { authProven: false, apiReachable: true };
  assert.deepEqual(classifyHttpFailure(429, '{}', 'json', context), { error: 'RATE_LIMITED', definitive: false });
  assert.deepEqual(classifyHttpFailure(429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}', 'json', context), {
    error: 'INSUFFICIENT_CREDITS',
    definitive: false,
  });
  assert.deepEqual(classifyHttpFailure(402, '{}', 'json', context), { error: 'INSUFFICIENT_CREDITS', definitive: false });
  assert.deepEqual(classifyHttpFailure(404, '{"error":"model_not_found"}', 'json', context), {
    error: 'MODEL_NOT_FOUND',
    definitive: false,
  });
  assert.deepEqual(classifyHttpFailure(404, '<html></html>', 'html', { authProven: false, apiReachable: false }), {
    error: 'INVALID_BASE_URL',
    definitive: true,
  });
  assert.deepEqual(classifyHttpFailure(500, 'oops', 'text', context), { error: 'PROVIDER_ERROR', definitive: false });
});

// ── No false negatives: correct keys connect ─────────────────────────────────────────────────

test('every built-in provider connects with a correct key (happy path)', async () => {
  assert.equal(PROVIDERS.length, 8);
  for (const provider of PROVIDERS) {
    const { impl, calls } = stub((url, method) => {
      if (isList(url, method)) {
        return provider.protocol === 'google'
          ? json(200, { models: [{ name: `models/${provider.models[0].id}`, supportedGenerationMethods: ['generateContent'] }] })
          : json(200, { data: provider.models.map((model) => ({ id: model.id })) });
      }
      if (url.endsWith('/auth/key')) return json(200, { data: { label: 'sk-or-v1-x', usage: 0 } });
      return chatOk(provider.protocol);
    });
    const result = await verifyProviderKey(verifyTargetFor(provider.id), VALID_LOOKING_KEY, { fetchImpl: impl });
    assert.equal(result.ok, true, `${provider.id}: ${JSON.stringify(result)}`);
    assert.equal(result.verifiedModel, provider.models[0].id, provider.id);
    assert.equal(result.warning, undefined, provider.id);
    assert.ok(calls.every((call) => call.url.startsWith(provider.baseUrl)), `${provider.id} stays on its locked URL`);
  }
});

test('authenticated key + 403 on the default model -> next model is tried and connects', async () => {
  const { impl, calls } = stub((url, method, body) => {
    if (isList(url, method)) return json(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] });
    return body.model === 'gpt-4o'
      ? json(403, { error: { message: 'Project does not have access to model gpt-4o', code: 'model_not_found' } })
      : chatOk('openai');
  });
  const result = await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'gpt-4o-mini');
  assert.deepEqual(posts(calls).map((call) => call.body.model), ['gpt-4o', 'gpt-4o-mini']);
});

test('authenticated key + 429 -> CONNECTED with a RATE_LIMITED warning, without hammering other models', async () => {
  const { impl, calls } = stub((url, method) =>
    isList(url, method)
      ? json(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] })
      : json(429, { error: { message: 'Rate limit reached for requests' } })
  );
  const result = await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: impl });
  assert.deepEqual(result, {
    ok: true,
    models: ['gpt-4o', 'gpt-4o-mini'],
    verifiedModel: 'gpt-4o',
    warning: 'RATE_LIMITED',
  });
  assert.equal(posts(calls).length, 1, 'a rate-limited key is not probed again on every model');
});

test('authenticated key with no balance (DeepSeek 402, xAI 403 "no credits") -> CONNECTED with a credits warning', async () => {
  const cases = [
    ['deepseek', 'deepseek-chat', json(402, { error: { message: 'Insufficient Balance' } })],
    ['xai', 'grok-3-mini', json(403, { code: 'forbidden', error: "Your newly created team doesn't have any credits yet." })],
  ];
  for (const [providerId, modelId, failure] of cases) {
    const { impl } = stub((url, method) => (isList(url, method) ? json(200, { data: [{ id: modelId }] }) : failure.clone()));
    const result = await verifyProviderKey(verifyTargetFor(providerId), VALID_LOOKING_KEY, { fetchImpl: impl });
    assert.equal(result.ok, true, providerId);
    assert.equal(result.warning, 'INSUFFICIENT_CREDITS', providerId);
    assert.equal(result.verifiedModel, modelId, providerId);
  }
});

test('Google: authenticated key + 429 RESOURCE_EXHAUSTED -> CONNECTED with a warning', async () => {
  const { impl } = stub((url, method) =>
    isList(url, method)
      ? json(200, { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] })
      : json(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } })
  );
  const result = await verifyProviderKey(verifyTargetFor('google'), 'AIzaSyValidLookingKey000', { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.warning, 'RATE_LIMITED');
});

test('NVIDIA (public /models): a model-specific 403 does not condemn the key — the next model connects', async () => {
  const { impl, calls } = stub((url, method, body) => {
    if (isList(url, method)) {
      return json(200, { data: [{ id: 'nvidia/nemotron-3.5-super-vl-120b-a12b' }, { id: 'meta/llama-3.1-8b-instruct' }] });
    }
    return body.model === 'nvidia/nemotron-3.5-super-vl-120b-a12b'
      ? json(403, { status: 403, title: 'Forbidden' })
      : chatOk('openai');
  });
  const result = await verifyProviderKey(verifyTargetFor('nvidia'), 'nvapi-validlooking-key-123', { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'meta/llama-3.1-8b-instruct');
  assert.equal(posts(calls).length, 2);
});

test('OpenRouter: /auth/key proves the key, a forbidden paid model falls back to a free one', async () => {
  const { impl } = stub((url, method, body) => {
    if (isList(url, method)) return json(200, { data: [{ id: 'openai/gpt-4o-mini' }, { id: 'meta-llama/llama-3.3-8b-instruct:free' }] });
    if (url.endsWith('/auth/key')) return json(200, { data: { label: 'sk-or-v1-x', limit: 0 } });
    return body.model === 'openai/gpt-4o-mini'
      ? json(403, { error: { message: 'This model is not available in your region' } })
      : chatOk('openai');
  });
  const result = await verifyProviderKey(verifyTargetFor('openrouter'), 'sk-or-v1-validlooking', { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'meta-llama/llama-3.3-8b-instruct:free');
});

test('a restricted key without the "list models" scope still connects through the live probe', async () => {
  const { impl } = stub((url, method) =>
    isList(url, method)
      ? json(401, { error: { message: 'You have insufficient permissions for this operation. Missing scopes: api.model.read.' } })
      : chatOk('openai')
  );
  const result = await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'gpt-4o');
});

test('a timeout on the first model does not abort: the next model connects', async () => {
  const { impl } = stub((url, method, body) => {
    if (isList(url, method)) return json(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] });
    if (body.model === 'gpt-4o') throw new DOMException('The operation timed out.', 'TimeoutError');
    return chatOk('openai');
  });
  const result = await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.verifiedModel, 'gpt-4o-mini');
});

test('probe uses a 16-token budget and the server sends a User-Agent', async () => {
  const { impl, calls } = stub((url, method) =>
    isList(url, method) ? json(200, { data: [{ id: 'claude-sonnet-4-5' }] }) : chatOk('anthropic')
  );
  await verifyProviderKey(verifyTargetFor('anthropic'), 'sk-ant-api03-validlooking', { fetchImpl: impl });
  assert.equal(PROBE_MAX_TOKENS, 16);
  assert.equal(posts(calls)[0].body.max_tokens, PROBE_MAX_TOKENS);
  assert.match(calls[0].headers['User-Agent'], /^ZeroCouncil\//);
});

test('candidate order prefers light chat models over alphabetical giants', () => {
  const target = { providerId: 'custom:openai:gw', protocol: 'openai', baseUrl: 'https://gw.example.com/v1' };
  const candidates = probeCandidates(target, [
    'aaa/giant-405b-instruct',
    'acme/vision-pro',
    'acme/chat-small',
    'text-embedding-3-large',
    'zzz/model-8b-instant',
  ]);
  assert.deepEqual(candidates.slice(0, 2), ['acme/chat-small', 'zzz/model-8b-instant']);
  assert.ok(!candidates.includes('text-embedding-3-large'));
  assert.deepEqual(candidates.slice(2).sort(), ['aaa/giant-405b-instruct', 'acme/vision-pro']);
});

// ── No false positives: wrong keys / wrong Base URLs never connect ───────────────────────────

test('unauthenticated provider + 429 everywhere -> RATE_LIMITED failure (never connected)', async () => {
  const { impl } = stub((url, method) =>
    isList(url, method) ? json(200, { data: [{ id: 'meta/llama-3.1-8b-instruct' }] }) : json(429, { detail: 'Too many requests' })
  );
  assert.deepEqual(await verifyProviderKey(verifyTargetFor('nvidia'), 'nvapi-garbage-key-12345', { fetchImpl: impl }), {
    ok: false,
    error: 'RATE_LIMITED',
  });
});

test('unauthenticated provider + 403 on every model -> INVALID_KEY', async () => {
  const { impl, calls } = stub((url, method) =>
    isList(url, method)
      ? json(200, { data: [{ id: 'meta/llama-3.1-8b-instruct' }, { id: 'google/gemma-3-4b-it' }] })
      : json(403, { status: 403, title: 'Forbidden' })
  );
  assert.deepEqual(await verifyProviderKey(verifyTargetFor('nvidia'), 'nvapi-garbage-key-12345', { fetchImpl: impl }), {
    ok: false,
    error: 'INVALID_KEY',
  });
  assert.ok(posts(calls).length >= 2, 'every candidate was given a chance');
});

test('an explicit model the key cannot use -> MODEL_ACCESS_DENIED (no silent substitution)', async () => {
  const { impl, calls } = stub((url, method) =>
    isList(url, method) ? json(200, { data: [{ id: 'gpt-4o' }] }) : json(403, { error: { message: 'no access' } })
  );
  assert.deepEqual(
    await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: impl, model: 'o1-pro' }),
    { ok: false, error: 'MODEL_ACCESS_DENIED' }
  );
  assert.deepEqual(posts(calls).map((call) => call.body.model), ['o1-pro']);
});

test('401 on the probe stops immediately even after an authenticated /models', async () => {
  const { impl, calls } = stub((url, method) =>
    isList(url, method) ? json(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }) : json(401, { error: { message: 'Incorrect API key provided' } })
  );
  assert.deepEqual(await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: impl }), {
    ok: false,
    error: 'INVALID_KEY',
  });
  assert.equal(posts(calls).length, 1);
});

test('custom Base URL whose host does not resolve -> INVALID_BASE_URL; built-in network blip -> NETWORK_FAILED', async () => {
  const dnsFailure = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  };
  const custom = verifyTargetFor({ provider: 'custom:openai:typo', protocol: 'openai', baseUrl: 'https://api.typo-gateway.example/v1' });
  assert.deepEqual(await verifyProviderKey(custom, VALID_LOOKING_KEY, { fetchImpl: dnsFailure }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
  assert.deepEqual(await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, { fetchImpl: dnsFailure }), {
    ok: false,
    error: 'NETWORK_FAILED',
  });
});

test('custom bare-origin gateway: 404 on the bare URL, /v1 works -> connected with resolvedBaseUrl', async () => {
  const { impl, calls } = stub((url, method) => {
    if (!url.includes('/v1/')) return html(404);
    return isList(url, method) ? json(200, { data: [{ id: 'llama-3-8b' }] }) : chatOk('openai');
  });
  const target = verifyTargetFor({ provider: 'custom:openai:gw', protocol: 'openai', baseUrl: 'https://gw.example.com/' });
  const result = await verifyProviderKey(target, VALID_LOOKING_KEY, { fetchImpl: impl });
  assert.deepEqual(result, {
    ok: true,
    models: ['llama-3-8b'],
    verifiedModel: 'llama-3-8b',
    resolvedBaseUrl: 'https://gw.example.com/v1',
  });
  assert.ok(calls.some((call) => call.url === 'https://gw.example.com/models'));
});

test('custom bare origin that is just a website stays INVALID_BASE_URL after the /v1 retry', async () => {
  const { impl, calls } = stub(() => html(404));
  const target = verifyTargetFor({ provider: 'custom:openai:site', protocol: 'openai', baseUrl: 'https://example.com' });
  assert.deepEqual(await verifyProviderKey(target, VALID_LOOKING_KEY, { fetchImpl: impl }), {
    ok: false,
    error: 'INVALID_BASE_URL',
  });
  assert.equal(posts(calls).length, 0, 'no inference call is sent to a website');
});

test('a pasted endpoint path is normalized and reported as the Base URL to save', async () => {
  const { impl, calls } = stub((url, method) =>
    isList(url, method) ? json(200, { data: [{ id: 'm-small' }] }) : chatOk('openai')
  );
  const result = await verifyProviderKey(
    { providerId: 'custom:openai:gw', protocol: 'openai', baseUrl: 'https://gw.example.com/v1/chat/completions/' },
    VALID_LOOKING_KEY,
    { fetchImpl: impl }
  );
  assert.equal(result.ok, true);
  assert.equal(result.resolvedBaseUrl, 'https://gw.example.com/v1');
  assert.equal(calls[0].url, 'https://gw.example.com/v1/models');
});

test('the whole verification respects its time budget', async () => {
  const slow = () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(json(200, { data: [{ id: 'gpt-4o' }] })), 80);
    });
  const started = Date.now();
  const result = await verifyProviderKey(verifyTargetFor('openai'), VALID_LOOKING_KEY, {
    fetchImpl: slow,
    totalBudgetMs: 50,
  });
  assert.equal(result.ok, false);
  assert.ok(Date.now() - started < 2_000, 'returns promptly once the budget is spent');
});

// ── Base URL normalization ───────────────────────────────────────────────────────────────────

test('normalizeProviderBaseUrl strips slashes, quotes and pasted endpoint paths', () => {
  const cases = [
    ['https://api.example.com/v1/', 'https://api.example.com/v1'],
    ['https://api.example.com/v1///', 'https://api.example.com/v1'],
    ['  "https://api.example.com/v1"  ', 'https://api.example.com/v1'],
    ['https://api.example.com/v1/chat/completions', 'https://api.example.com/v1'],
    ['https://api.example.com/v1/chat/completions/', 'https://api.example.com/v1'],
    ['https://api.example.com/anthropic/v1/messages', 'https://api.example.com/anthropic/v1'],
    ['https://api.example.com/v1/models', 'https://api.example.com/v1'],
    ['https://api.example.com/v1/models/gpt-4o', 'https://api.example.com/v1'],
    ['https://gen.example.com/v1beta/models/gemini-2.5-flash:generateContent', 'https://gen.example.com/v1beta'],
    ['https://api.example.com/v1/responses', 'https://api.example.com/v1'],
    ['https://gw.example.com', 'https://gw.example.com'],
    ['\u200Bhttps://api.example.com/v1\uFEFF', 'https://api.example.com/v1'],
    ['', ''],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeProviderBaseUrl(input), expected, JSON.stringify(input));
    assert.equal(normalizeBaseUrl(input), expected, `byok.normalizeBaseUrl ${JSON.stringify(input)}`);
  }
  assert.equal(normalizeProviderBaseUrl(undefined), '');
});

test('built-in Base URLs stay locked no matter what the client sends', () => {
  for (const provider of PROVIDERS) {
    const target = verifyTargetFor({ provider: provider.id, protocol: 'openai', baseUrl: 'https://evil.example.com/v1/chat/completions' });
    assert.equal(target.baseUrl, provider.baseUrl, provider.id);
  }
});
