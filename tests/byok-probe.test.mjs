// fetchProviderModels probe: one call validates the key with a LIVE inference probe and returns the
// live model list. A 200 from GET /models alone is never enough. fetch is stubbed — no network.
import assert from 'node:assert/strict';
import test from 'node:test';

const { fetchProviderModels } = await import('../web/src/prototype/chat/byok.ts?probe=1');

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
};

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const isModelList = (url, init) => String(url).endsWith('/models') && (init?.method ?? 'GET') === 'GET';

const OPENAI_KEY = 'sk-proj-fake-but-long-enough';
const ANTHROPIC_KEY = 'sk-ant-api03-fake-long-enough';
const GOOGLE_KEY = 'AIzaSyFakeButLongEnoughKey';

test('empty key throws EMPTY_KEY without calling the provider', async () => {
  await withFetch(async () => {
    throw new Error('must not be called');
  }, async () => {
    await assert.rejects(() => fetchProviderModels('openai', '   '), /EMPTY_KEY/);
  });
});

test('401 from the provider throws INVALID_KEY (openai bearer)', async () => {
  let sawAuth;
  await withFetch(
    async (url, init) => {
      sawAuth = init.headers.Authorization;
      return jsonResponse(401, {});
    },
    async () => {
      await assert.rejects(() => fetchProviderModels('openai', OPENAI_KEY), /INVALID_KEY/);
    }
  );
  assert.equal(sawAuth, `Bearer ${OPENAI_KEY}`);
});

test('401 from anthropic throws INVALID_KEY with browser-access header', async () => {
  let sawHeader;
  await withFetch(
    async (url, init) => {
      sawHeader = init.headers['anthropic-dangerous-direct-browser-access'];
      return jsonResponse(401, {});
    },
    async () => {
      await assert.rejects(() => fetchProviderModels('anthropic', ANTHROPIC_KEY), /INVALID_KEY/);
    }
  );
  assert.equal(sawHeader, 'true');
});

test('network failure throws NETWORK_FAILED', async () => {
  await withFetch(
    async () => {
      throw new TypeError('Failed to fetch');
    },
    async () => {
      await assert.rejects(() => fetchProviderModels('openai', OPENAI_KEY), /NETWORK_FAILED/);
    }
  );
});

test('200 list + passing probe returns sorted deduped model ids', async () => {
  const probed = [];
  await withFetch(
    async (url, init) => {
      if (isModelList(url, init)) {
        return jsonResponse(200, {
          data: [{ id: 'gpt-4o' }, { id: 'claude-x' }, { id: 'gpt-4o' }, { id: 7 }, {}],
        });
      }
      probed.push(JSON.parse(init.body).model);
      return jsonResponse(200, { choices: [{ message: { content: 'o' } }] });
    },
    async () => {
      assert.deepEqual(await fetchProviderModels('openai', OPENAI_KEY), ['claude-x', 'gpt-4o']);
    }
  );
  assert.deepEqual(probed, ['gpt-4o'], 'the default model is probed once');
});

test('200 list but the probe is rejected -> INVALID_KEY (public /models never counts)', async () => {
  await withFetch(
    async (url, init) =>
      isModelList(url, init)
        ? jsonResponse(200, { data: [{ id: 'nvidia/nemotron-3.5-super-vl-120b-a12b' }] })
        : jsonResponse(401, { error: { message: 'Authentication failed' } }),
    async () => {
      await assert.rejects(() => fetchProviderModels('nvidia', 'nvapi-fake-long-enough-key'), /INVALID_KEY/);
    }
  );
});

test('200 with no models still probes the provider default model', async () => {
  await withFetch(
    async (url, init) =>
      isModelList(url, init)
        ? jsonResponse(200, { data: [] })
        : jsonResponse(200, { choices: [{ message: { content: 'o' } }] }),
    async () => {
      assert.deepEqual(await fetchProviderModels('openai', OPENAI_KEY), ['gpt-4o']);
    }
  );
});

test('google 200 strips models/ prefix and filters generateContent models', async () => {
  let sawHeader;
  await withFetch(
    async (url, init) => {
      sawHeader = init.headers['x-goog-api-key'];
      if (isModelList(url, init)) {
        return jsonResponse(200, {
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
          ],
        });
      }
      return jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'o' }] } }] });
    },
    async () => {
      assert.deepEqual(await fetchProviderModels('google', GOOGLE_KEY), [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
      ]);
    }
  );
  assert.equal(sawHeader, GOOGLE_KEY);
});

test('google 400 invalid API key maps to INVALID_KEY', async () => {
  await withFetch(
    async () => jsonResponse(400, { error: { message: 'API key not valid' } }),
    async () => {
      await assert.rejects(() => fetchProviderModels('google', GOOGLE_KEY), /INVALID_KEY/);
    }
  );
});
