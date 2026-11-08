// fetchProviderModels probe: one call validates the key and returns the live list.
// fetch is stubbed — no network, no real key.
import assert from 'node:assert/strict';
import test from 'node:test';

const { fetchProviderModels } = await import(
  '../web/src/prototype/chat/byok.ts?probe=1'
);

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
};

const jsonResponse = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

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
      await assert.rejects(
        () => fetchProviderModels('openai', 'sk-fake'),
        /INVALID_KEY/
      );
    }
  );
  assert.equal(sawAuth, 'Bearer sk-fake');
});

test('401 from anthropic throws INVALID_KEY with browser-access header', async () => {
  let sawHeader;
  await withFetch(
    async (url, init) => {
      sawHeader = init.headers['anthropic-dangerous-direct-browser-access'];
      return jsonResponse(401, {});
    },
    async () => {
      await assert.rejects(
        () => fetchProviderModels('anthropic', 'sk-ant-fake'),
        /INVALID_KEY/
      );
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
      await assert.rejects(
        () => fetchProviderModels('openai', 'sk-fake'),
        /NETWORK_FAILED/
      );
    }
  );
});

test('200 returns sorted deduped model ids', async () => {
  await withFetch(
    async () =>
      jsonResponse(200, {
        data: [{ id: 'gpt-4o' }, { id: 'claude-x' }, { id: 'gpt-4o' }, { id: 7 }, {}],
      }),
    async () => {
      assert.deepEqual(await fetchProviderModels('openai', 'sk-real'), ['claude-x', 'gpt-4o']);
    }
  );
});

test('200 with no models returns an empty list (caller treats as NO_MODELS)', async () => {
  await withFetch(
    async () => jsonResponse(200, { data: [] }),
    async () => {
      assert.deepEqual(await fetchProviderModels('openai', 'sk-real'), []);
    }
  );
});
