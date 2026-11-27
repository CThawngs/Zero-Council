// Production security hardening unit tests:
// 1. Strict ZC_PROVIDER_KEY_SECRET enforcement on deployed hosts (providerKeys.ts)
// 2. Memory-bounded sliding-window rate limiter & 429 headers (rate-limit.ts)
// 3. Bounded JSON body stream reader & 413/400 guards (request-guard.ts)

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

const {
  encryptProviderKey,
  decryptProviderKey,
  isEncryptionKeyConfigured,
} = await import('../web/src/lib/crypto/providerKeys.ts');

const {
  checkRateLimit,
  enforceRateLimit,
  extractClientIp,
  getClientIp,
  getRateLimitBucketCount,
  resetRateLimitStore,
} = await import('../web/src/lib/security/rate-limit.ts');

const { readBoundedJson } = await import('../web/src/lib/security/request-guard.ts');

function withEnv(overrides, fn) {
  const saved = new Map();
  for (const [k, v] of Object.entries(overrides)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of saved.entries()) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// --- 1. providerKeys.ts strict production secret enforcement ---

test('providerKeys: dev/test mode falls back cleanly when ZC_PROVIDER_KEY_SECRET is unset', () => {
  withEnv(
    {
      VERCEL: undefined,
      ZC_REQUIRE_PROD_SECRETS: undefined,
      ZC_PROVIDER_KEY_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      assert.equal(isEncryptionKeyConfigured(), false);
      const cipher = encryptProviderKey('sk-dev-fallback-key');
      assert.equal(decryptProviderKey(cipher), 'sk-dev-fallback-key');
    }
  );
});

test('providerKeys: VERCEL=1 refuses missing, malformed, or wrong-length ZC_PROVIDER_KEY_SECRET', () => {
  const cases = [
    [undefined, /MISSING_PROVIDER_KEY_SECRET/],
    ['', /MISSING_PROVIDER_KEY_SECRET/],
    ['not-valid-base64!!!', /INVALID_PROVIDER_KEY_SECRET/],
    [randomBytes(16).toString('base64'), /INVALID_PROVIDER_KEY_SECRET/],
    [randomBytes(48).toString('base64'), /INVALID_PROVIDER_KEY_SECRET/],
  ];
  for (const [invalidSecret, expectedError] of cases) {
    withEnv(
      {
        VERCEL: '1',
        ZC_REQUIRE_PROD_SECRETS: undefined,
        ZC_PROVIDER_KEY_SECRET: invalidSecret,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
      () => {
        assert.equal(isEncryptionKeyConfigured(), false);
        assert.throws(() => encryptProviderKey('sk-prod-test'), expectedError);
      }
    );
  }
});

test('providerKeys: ZC_REQUIRE_PROD_SECRETS=1 enforces explicit 32-byte base64 key on encrypt and decrypt', () => {
  const validSecret = randomBytes(32).toString('base64');
  let envelope = '';

  withEnv(
    {
      VERCEL: undefined,
      ZC_REQUIRE_PROD_SECRETS: '1',
      ZC_PROVIDER_KEY_SECRET: validSecret,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      assert.equal(isEncryptionKeyConfigured(), true);
      envelope = encryptProviderKey('sk-live-secret-999');
      assert.equal(decryptProviderKey(envelope), 'sk-live-secret-999');
    }
  );

  withEnv(
    {
      VERCEL: undefined,
      ZC_REQUIRE_PROD_SECRETS: '1',
      ZC_PROVIDER_KEY_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      assert.throws(() => decryptProviderKey(envelope), /MISSING_PROVIDER_KEY_SECRET/);
    }
  );
});

// --- 2. rate-limit.ts sliding window, headers, and bounded memory ---

test('rate-limit: prefers x-vercel-forwarded-for and x-real-ip over spoofable leftmost x-forwarded-for', () => {
  const reqVercel = new Request('http://localhost/api/test', {
    headers: {
      'x-vercel-forwarded-for': '203.0.113.55',
      'x-real-ip': '198.51.100.4',
      'x-forwarded-for': '1.2.3.4, 10.0.0.1',
    },
  });
  assert.equal(getClientIp(reqVercel), '203.0.113.55');
  assert.equal(extractClientIp(reqVercel), '203.0.113.55');

  const reqRealIpVsSpoof = new Request('http://localhost/api/test', {
    headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'x-real-ip': '198.51.100.4' },
  });
  assert.equal(getClientIp(reqRealIpVsSpoof), '198.51.100.4');

  const reqForwardedChain = new Request('http://localhost/api/test', {
    headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' },
  });
  assert.equal(getClientIp(reqForwardedChain), '198.51.100.7');

  const reqLocal = new Request('http://localhost/api/test');
  assert.equal(getClientIp(reqLocal), 'local');
});

test('rate-limit: sliding window enforces limit, emits 429 headers, and recovers after window expiry', async () => {
  resetRateLimitStore();
  await withEnv({ ZC_DISABLE_RATE_LIMIT: undefined, VERCEL: undefined }, async () => {
    const req = new Request('http://localhost/api/auth/check-account', {
      headers: { 'x-forwarded-for': '203.0.113.42' },
    });

    const r1 = checkRateLimit(req, { scope: 'unit:auth', limit: 2, windowMs: 10_000, nowMs: 1_000 });
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);

    const r2 = checkRateLimit(req, { scope: 'unit:auth', limit: 2, windowMs: 10_000, nowMs: 2_500 });
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);

    const deniedResponse = enforceRateLimit(req, {
      scope: 'unit:auth',
      limit: 2,
      windowMs: 10_000,
      nowMs: 3_000,
    });
    assert.ok(deniedResponse instanceof Response);
    assert.equal(deniedResponse.status, 429);
    assert.equal(deniedResponse.headers.get('X-RateLimit-Limit'), '2');
    assert.equal(deniedResponse.headers.get('X-RateLimit-Remaining'), '0');
    assert.equal(deniedResponse.headers.get('Retry-After'), '8');
    assert.equal(deniedResponse.headers.get('Cache-Control'), 'no-store');
    assert.ok(Number(deniedResponse.headers.get('X-RateLimit-Reset')) >= 11);

    const payload = await deniedResponse.json();
    assert.deepEqual(payload, {
      ok: false,
      error: 'RATE_LIMITED',
      retryAfterSeconds: 8,
    });

    // Advance past first timestamp (1_000 + 10_000 = 11_000): one slot frees up.
    const r4 = checkRateLimit(req, { scope: 'unit:auth', limit: 2, windowMs: 10_000, nowMs: 11_001 });
    assert.equal(r4.allowed, true);
    assert.equal(r4.remaining, 0);
  });
});

test('rate-limit: LRU bucket cap evicts oldest/expired entries so spoofed IPs never leak memory', () => {
  resetRateLimitStore();
  withEnv({ ZC_DISABLE_RATE_LIMIT: undefined, VERCEL: undefined }, () => {
    for (let i = 0; i < 25; i++) {
      const req = new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': `198.51.100.${i}` },
      });
      const res = checkRateLimit(req, {
        scope: 'unit:cap',
        limit: 5,
        windowMs: 60_000,
        nowMs: 5_000 + i,
        maxBuckets: 6,
      });
      assert.equal(res.allowed, true);
      assert.ok(getRateLimitBucketCount() <= 6);
    }
    assert.equal(getRateLimitBucketCount(), 6);
  });
});

test('rate-limit: ZC_DISABLE_RATE_LIMIT=1 bypasses locally but is ignored when VERCEL=1', () => {
  resetRateLimitStore();
  const req = new Request('http://localhost/api/test', {
    headers: { 'x-forwarded-for': '203.0.113.88' },
  });

  withEnv({ ZC_DISABLE_RATE_LIMIT: '1', VERCEL: undefined }, () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(
        enforceRateLimit(req, { scope: 'unit:bypass', limit: 1, windowMs: 60_000 }),
        null
      );
    }
  });

  withEnv({ ZC_DISABLE_RATE_LIMIT: '1', VERCEL: '1' }, () => {
    assert.equal(
      enforceRateLimit(req, { scope: 'unit:bypass', limit: 1, windowMs: 60_000 }),
      null
    );
    const blocked = enforceRateLimit(req, { scope: 'unit:bypass', limit: 1, windowMs: 60_000 });
    assert.ok(blocked instanceof Response);
    assert.equal(blocked.status, 429);
  });
});

// --- 3. request-guard.ts bounded JSON body stream reader ---

test('request-guard: readBoundedJson parses valid JSON within maxBytes', async () => {
  const req = new Request('http://localhost/api/language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'vi', nested: [1, 2, 3] }),
  });
  const parsed = await readBoundedJson(req, 1024);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data, { language: 'vi', nested: [1, 2, 3] });
});

test('request-guard: readBoundedJson rejects oversized Content-Length with 413 immediately', async () => {
  let streamPulled = false;
  let streamCancelled = false;
  const stream = new ReadableStream(
    {
      pull(controller) {
        streamPulled = true;
        controller.enqueue(new TextEncoder().encode('{"hello":"world"}'));
        controller.close();
      },
      cancel() {
        streamCancelled = true;
      },
    },
    { highWaterMark: 0 }
  );

  const req = new Request('http://localhost/api/providers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '999999',
    },
    body: stream,
    duplex: 'half',
  });

  const result = await readBoundedJson(req, 256);
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 413);
  assert.equal(streamPulled, false);
  assert.equal(streamCancelled, true);
  assert.deepEqual(await result.response.json(), {
    ok: false,
    error: 'PAYLOAD_TOO_LARGE',
  });
});

test('request-guard: readBoundedJson aborts oversized chunked stream without Content-Length with 413', async () => {
  let chunksProduced = 0;
  let cancelled = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    pull(controller) {
      chunksProduced += 1;
      controller.enqueue(encoder.encode('x'.repeat(120)));
      if (chunksProduced >= 10) {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  const req = new Request('http://localhost/api/bots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: stream,
    duplex: 'half',
  });

  const result = await readBoundedJson(req, 250);
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 413);
  assert.equal(cancelled, true);
  assert.ok(chunksProduced <= 4, `expected early stream abort, got ${chunksProduced} chunks`);
  assert.deepEqual(await result.response.json(), {
    ok: false,
    error: 'PAYLOAD_TOO_LARGE',
  });
});

test('request-guard: readBoundedJson rejects malformed or empty JSON with 400 INVALID_JSON', async () => {
  const malformedReq = new Request('http://localhost/api/bots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"broken": ',
  });
  const malformed = await readBoundedJson(malformedReq, 1024);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.response.status, 400);
  assert.deepEqual(await malformed.response.json(), {
    ok: false,
    error: 'INVALID_JSON',
  });

  const emptyReq = new Request('http://localhost/api/bots', {
    method: 'POST',
  });
  const empty = await readBoundedJson(emptyReq, 1024);
  assert.equal(empty.ok, false);
  assert.equal(empty.response.status, 400);
  assert.deepEqual(await empty.response.json(), {
    ok: false,
    error: 'INVALID_JSON',
  });
});
