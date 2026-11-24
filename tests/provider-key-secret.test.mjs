// Provider-key encryption secret resolution, key-version tags, rotation and legacy decrypt,
// plus the store's typed errors and foreign-key handling. No network: Supabase is stubbed.
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import test from 'node:test';

const {
  decryptProviderKey,
  encryptProviderKey,
  getEncryptionMode,
  isEncryptionKeyConfigured,
} = await import('../web/src/lib/crypto/providerKeys.ts');
const { providerStoreErrorOf, saveProviderKey } = await import('../web/src/lib/store/providerKeys.ts');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.service-role-test-value.signature-part-123456';
const OTHER_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.another-project-entirely.signature-part-999999';

const ENCRYPTION_ENV_KEYS = [
  'VERCEL',
  'ZC_REQUIRE_PROD_SECRETS',
  'ZC_PROVIDER_KEY_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
];

/** Runs `fn` with exactly the given encryption-related env vars (everything else unset). */
const withEnv = async (overrides, fn) => {
  const saved = new Map(ENCRYPTION_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENCRYPTION_ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

/** Builds a pre-v2 envelope exactly like the old code did (plain SHA-256 key, `v1` tag). */
const legacyEnvelope = (plain, seed) => {
  const key = createHash('sha256').update(seed).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${body.toString('base64')}`;
};

test('explicit ZC_PROVIDER_KEY_SECRET wins: v1 envelope, mode explicit-secret', async () => {
  await withEnv(
    { VERCEL: '1', ZC_PROVIDER_KEY_SECRET: randomBytes(32).toString('base64'), SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY },
    () => {
      assert.equal(getEncryptionMode(), 'explicit-secret');
      assert.equal(isEncryptionKeyConfigured(), true);
      const envelope = encryptProviderKey('sk-live-explicit');
      assert.equal(envelope.split(':')[0], 'v1');
      assert.equal(envelope.split(':').length, 4);
      assert.equal(decryptProviderKey(envelope), 'sk-live-explicit');
    }
  );
});

test('Vercel with only SUPABASE_SERVICE_ROLE_KEY: derived key, tagged v2:srk1, save/load works', async () => {
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    assert.equal(getEncryptionMode(), 'derived-from-service-role');
    assert.equal(isEncryptionKeyConfigured(), true);
    const envelope = encryptProviderKey('sk-derived-123');
    const parts = envelope.split(':');
    assert.deepEqual(parts.slice(0, 2), ['v2', 'srk1']);
    assert.equal(parts.length, 5);
    assert.ok(!envelope.includes('sk-derived-123'));
    assert.equal(decryptProviderKey(envelope), 'sk-derived-123');
  });
});

test('the derived key is domain-separated (HKDF), not the raw SHA-256 of the service-role key', async () => {
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    const [, , ivB64, tagB64, bodyB64] = encryptProviderKey('sk-domain').split(':');
    const naiveKey = createHash('sha256').update(SERVICE_ROLE_KEY).digest();
    const decipher = createDecipheriv('aes-256-gcm', naiveKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    assert.throws(
      () => Buffer.concat([decipher.update(Buffer.from(bodyB64, 'base64')), decipher.final()]),
      'the raw SHA-256 of the service-role key must not open a v2 row'
    );
  });
});

test('rotation: rows sealed with the derived key stay readable after ZC_PROVIDER_KEY_SECRET is added', async () => {
  let derivedEnvelope = '';
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    derivedEnvelope = encryptProviderKey('sk-before-rotation');
  });
  await withEnv(
    { VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, ZC_PROVIDER_KEY_SECRET: randomBytes(32).toString('base64') },
    () => {
      assert.equal(decryptProviderKey(derivedEnvelope), 'sk-before-rotation');
      assert.equal(encryptProviderKey('sk-after-rotation').split(':')[0], 'v1', 'new writes use the explicit secret');
    }
  );
});

test('legacy v1 rows sealed with SHA-256(service-role key) (pre-v2 local dev) still decrypt', async () => {
  const envelope = legacyEnvelope('sk-legacy-local', SERVICE_ROLE_KEY);
  await withEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    assert.equal(decryptProviderKey(envelope), 'sk-legacy-local');
  });
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    assert.equal(decryptProviderKey(envelope), 'sk-legacy-local');
  });
});

test('a different service-role key can never open another project\'s rows', async () => {
  let envelope = '';
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    envelope = encryptProviderKey('sk-project-a');
  });
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: OTHER_SERVICE_ROLE_KEY }, () => {
    assert.throws(() => decryptProviderKey(envelope));
  });
});

test('deployed host with no usable secret: typed errors, never a static fallback', async () => {
  await withEnv({ VERCEL: '1' }, () => {
    assert.equal(getEncryptionMode(), 'missing');
    assert.equal(isEncryptionKeyConfigured(), false);
    assert.throws(() => encryptProviderKey('sk-x'), /^Error: MISSING_PROVIDER_KEY_SECRET$/);
    // A dev-fallback envelope must not open on a deployed host.
    assert.throws(() => decryptProviderKey(legacyEnvelope('sk-dev', 'zc-dev-only-not-a-secret')), /MISSING_PROVIDER_KEY_SECRET/);
  });
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key' }, () => {
    assert.equal(getEncryptionMode(), 'missing', 'placeholder service-role keys are ignored');
  });
  for (const malformed of ['not-valid-base64!!!', randomBytes(16).toString('base64')]) {
    await withEnv({ VERCEL: '1', ZC_PROVIDER_KEY_SECRET: malformed, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
      assert.equal(getEncryptionMode(), 'invalid-secret');
      assert.throws(() => encryptProviderKey('sk-x'), /^Error: INVALID_PROVIDER_KEY_SECRET$/);
    });
  }
});

test('local dev without any secret keeps working (dev fallback) and reports it honestly', async () => {
  await withEnv({}, () => {
    assert.equal(getEncryptionMode(), 'dev-fallback');
    assert.equal(isEncryptionKeyConfigured(), false);
    assert.equal(decryptProviderKey(encryptProviderKey('sk-dev-only')), 'sk-dev-only');
  });
});

test('tampered or malformed envelopes are rejected', async () => {
  await withEnv({ VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY }, () => {
    const parts = encryptProviderKey('untouched').split(':');
    parts[4] = Buffer.from('tampered-bytes-0000').toString('base64');
    assert.throws(() => decryptProviderKey(parts.join(':')));
    assert.throws(() => decryptProviderKey('v2:unknown:a:b:c'), /BAD_ENVELOPE/);
    assert.throws(() => decryptProviderKey('v3:a:b:c'), /BAD_ENVELOPE/);
  });
});

test('providerStoreErrorOf maps failures to stable, non-secret codes', () => {
  assert.deepEqual(providerStoreErrorOf(new Error('MISSING_PROVIDER_KEY_SECRET')), {
    code: 'MISSING_PROVIDER_KEY_SECRET',
    status: 503,
  });
  assert.deepEqual(providerStoreErrorOf(new Error('INVALID_PROVIDER_KEY_SECRET')), {
    code: 'INVALID_PROVIDER_KEY_SECRET',
    status: 503,
  });
  assert.deepEqual(providerStoreErrorOf(new Error('SUPABASE_NOT_CONFIGURED')), { code: 'STORE_NOT_CONFIGURED', status: 503 });
  assert.deepEqual(providerStoreErrorOf(new Error('STORE_SCHEMA_OUTDATED')), { code: 'STORE_SCHEMA_OUTDATED', status: 503 });
  assert.deepEqual(providerStoreErrorOf(new Error('SUPABASE_500:boom')), { code: 'STORE_UNAVAILABLE', status: 502 });
});

/** Stubs the Supabase REST API; `respond(path, method, body)` returns [status, json]. */
const withSupabase = async (respond, fn) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const path = url.replace('https://db.example.supabase.co/rest/v1/', '');
    const method = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ path, method, body });
    const [status, payload] = respond(path, method, body);
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  };
  try {
    await withEnv(
      { VERCEL: '1', SUPABASE_URL: 'https://db.example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY },
      () => fn(calls)
    );
  } finally {
    globalThis.fetch = original;
  }
};

const FK_VIOLATION = {
  code: '23503',
  message: 'insert or update on table "zc_provider_keys" violates foreign key constraint "fk_zc_provider_keys_provider"',
};

test('save on an old schema with the provider FK: built-in id is seeded once, then saved', async () => {
  let keyAttempts = 0;
  await withSupabase(
    (path, method, body) => {
      if (path.startsWith('zc_provider_keys') && method === 'POST') {
        keyAttempts += 1;
        if (keyAttempts === 1) return [409, FK_VIOLATION];
        return [201, [{ ...body, updated_at: body.updated_at }]];
      }
      if (path.startsWith('zc_agent_providers')) return [201, [{ id: body.id, name: body.name }]];
      return [404, {}];
    },
    async (calls) => {
      const saved = await saveProviderKey('User@Example.com', 'nvidia', 'meta/llama-3.1-8b-instruct', 'nvapi-real-key-123', {
        label: 'NVIDIA NIM',
        protocol: 'openai',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
      });
      assert.equal(saved.provider, 'nvidia');
      const catalogWrites = calls.filter((call) => call.path.startsWith('zc_agent_providers'));
      assert.equal(catalogWrites.length, 1);
      assert.deepEqual(catalogWrites[0].body, { id: 'nvidia', name: 'NVIDIA NIM' });
      const stored = calls.filter((call) => call.path.startsWith('zc_provider_keys')).at(-1).body;
      assert.equal(stored.user_email, 'user@example.com');
      assert.ok(stored.encrypted_key.startsWith('v2:srk1:'), 'Vercel without ZC_PROVIDER_KEY_SECRET uses the derived key');
      assert.ok(!JSON.stringify(calls).includes('nvapi-real-key-123'), 'the plaintext key never reaches the database');
    }
  );
});

test('save on an old schema with the provider FK: custom ids are refused with STORE_SCHEMA_OUTDATED, nothing leaks to the public catalog', async () => {
  await withSupabase(
    (path, method) => (path.startsWith('zc_provider_keys') && method === 'POST' ? [409, FK_VIOLATION] : [201, []]),
    async (calls) => {
      await assert.rejects(
        () => saveProviderKey('user@example.com', 'custom:openai:my-gateway', 'm', 'gw-key-1234567', { label: 'My secret gateway' }),
        /^Error: STORE_SCHEMA_OUTDATED$/
      );
      assert.equal(calls.filter((call) => call.path.startsWith('zc_agent_providers')).length, 0);
    }
  );
});

test('save without any encryption secret on Vercel fails with the typed error before touching the database', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('[]', { status: 201 });
  };
  try {
    await withEnv({ VERCEL: '1', SUPABASE_URL: 'https://db.example.supabase.co' }, async () => {
      // No service-role key: Supabase is not configured either, so the store refuses first.
      await assert.rejects(() => saveProviderKey('u@example.com', 'openai', 'gpt-4o', 'sk-x-123456789'), /SUPABASE_NOT_CONFIGURED/);
    });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(called, false);
});
