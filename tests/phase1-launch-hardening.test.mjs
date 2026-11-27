// Phase 1 production launch hardening unit & contract tests:
// 1. PayOS config, safe orderCode, USD coupon math & orderHandlers auth/CSRF/PATCH hard-404
// 2. CSRF verifySameOrigin, OAuth canonical redirect, and API route mutation guard audit
// 3. Server-side plan limits (advisor seats + excess disabled bots) & migration 0010 SQL audit
// 4. Unified SSRF guard (IPv4, IPv6 fe80..febf, hex ::ffff:a9fe:a9fe, DNS multi-record) & BYOK redirect:'error'
// 5. Model allow-list (Gemini 2.5 + OpenRouter vendors), engine turn abort/retry, conclusion error honesty & ops

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const {
  getPayosCredentials,
  isPayosConfigured,
  isPayosDevSimulationAllowed,
  generateOrderCode,
  amountUsdAfterCoupon,
} = await import('../web/src/lib/payos/config.ts');

const { createPayosOrderHandlers } = await import('../web/src/lib/payos/orderHandlers.ts');

const {
  resolveCanonicalOrigin,
  sanitizeRelativeNextPath,
  verifySameOrigin,
} = await import('../web/src/lib/security/request-guard.ts');

const { resetRateLimitStore } = await import('../web/src/lib/security/rate-limit.ts');

const {
  isGroupRosterOverPlanLimit,
  resolveRequestBotId,
  resolveRequestBotIds,
  isBotDisabledForPlan,
} = await import('../web/src/lib/store/planLimits.ts');

const { PLANS, planPrice } = await import('../web/src/prototype/data/plans.ts');

const {
  isBlockedIp,
  isPrivateHostname,
  validateRemoteUrlLiteral,
  assertSafeRemoteUrl,
  UnsafeRemoteUrlError,
} = await import('../web/src/lib/security/ssrf.ts');

const { verifyProviderKey } = await import('../web/src/lib/byok/verify.ts');

const {
  visibleModelsForProvider,
  isNonChatModel,
} = await import('../web/src/prototype/chat/modelAllowList.ts');

const {
  PROVIDERS,
  completeByokText,
} = await import('../web/src/prototype/chat/byok.ts');

const {
  DEFAULT_TURN_TIMEOUT_MS,
  runTurn,
} = await import('../web/src/prototype/chat/engine.ts');

const {
  ConclusionAnalysisError,
  analyzeChatRoomConclusion,
} = await import('../web/src/prototype/chat/conclusion.ts');

const { isFounder, FOUNDER_EMAIL } = await import('../web/src/lib/founder.ts');

async function withEnv(overrides, fn) {
  const saved = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// --- 1. PayOS config & orderHandlers lockdown ---

test('payos config: reads canonical PAYOS_*, supports legacy PAYLOS_*, and ignores NEXT_PUBLIC_PAYOS_*', async () => {
  await withEnv(
    {
      PAYOS_CLIENT_ID: undefined,
      PAYOS_API_KEY: undefined,
      PAYOS_CHECKSUM_KEY: undefined,
      PAYOS_CHECKSUM: undefined,
      PAYLOS_CLIENT_ID: undefined,
      PAYLOS_API_KEY: undefined,
      PAYLOS_CHECKSUM_KEY: undefined,
      NEXT_PUBLIC_PAYOS_CLIENT_ID: 'leaked-public-id',
      NEXT_PUBLIC_PAYOS_API_KEY: 'leaked-public-key',
      NEXT_PUBLIC_PAYOS_CHECKSUM_KEY: 'leaked-public-checksum',
    },
    () => {
      const creds = getPayosCredentials();
      assert.equal(creds.clientId, undefined);
      assert.equal(creds.apiKey, undefined);
      assert.equal(creds.checksumKey, undefined);
      assert.equal(isPayosConfigured(), false);
    }
  );

  await withEnv(
    {
      PAYOS_CLIENT_ID: 'cid-live',
      PAYOS_API_KEY: 'api-live',
      PAYOS_CHECKSUM_KEY: 'chk-live',
    },
    () => {
      assert.equal(isPayosConfigured(), true);
      assert.deepEqual(getPayosCredentials(), {
        clientId: 'cid-live',
        apiKey: 'api-live',
        checksumKey: 'chk-live',
      });
    }
  );
});

test('payos helpers: generateOrderCode stays inside MAX_SAFE_INTEGER and amountUsdAfterCoupon scales cleanly', () => {
  const now = 1_795_180_000_000;
  const c1 = generateOrderCode(now, 7);
  const c2 = generateOrderCode(now, 42);
  assert.ok(Number.isSafeInteger(c1) && c1 > 0 && c1 < Number.MAX_SAFE_INTEGER);
  assert.notEqual(c1, c2);

  assert.equal(amountUsdAfterCoupon('9.99', 0), '9.99');
  assert.equal(amountUsdAfterCoupon('10.00', 25), '7.50');
  assert.equal(amountUsdAfterCoupon('9.99', 100), '0.00');
});

test('payos orderHandlers: enforces auth + owner on GET/POST and hard-404s PATCH outside local offline dev', async () => {
  resetRateLimitStore();
  const orders = new Map([
    [
      123456,
      {
        orderCode: 123456,
        planId: 'pro',
        amountVnd: 139000,
        amountUsd: '5.50',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        userEmail: 'owner@zerocouncil.app',
      },
    ],
  ]);
  const grants = [];
  let signedInEmail = null;

  const handlers = createPayosOrderHandlers({
    currentAccount: async () =>
      signedInEmail ? { email: signedInEmail, role: 'user', createdAt: new Date().toISOString() } : null,
    getOrder: async (code) => orders.get(code) ?? null,
    markOrder: async (code, status, extra) => {
      const existing = orders.get(code);
      if (!existing) return null;
      const updated = { ...existing, status, ...extra };
      orders.set(code, updated);
      return updated;
    },
    deleteOrder: async (code) => orders.delete(code),
    listGrants: async (email) => grants.filter((g) => g.userEmail === email),
    addGrant: async (input) => {
      const g = { id: `g-${grants.length + 1}`, createdAt: new Date().toISOString(), ...input };
      grants.push(g);
      return g;
    },
    redeemCoupon: async () => null,
    getPayosClient: () => null,
  });

  const ctx = { params: Promise.resolve({ orderCode: '123456' }) };
  const originHeaders = { Origin: 'https://zerocouncil.app' };

  // Unauthenticated GET -> 401
  const unauthGet = await handlers.GET(
    new Request('https://zerocouncil.app/api/payos/orders/123456'),
    ctx
  );
  assert.equal(unauthGet.status, 401);

  // Authenticated non-owner GET -> 403
  signedInEmail = 'intruder@zerocouncil.app';
  const intruderGet = await handlers.GET(
    new Request('https://zerocouncil.app/api/payos/orders/123456'),
    ctx
  );
  assert.equal(intruderGet.status, 403);

  // Owner GET -> 200
  signedInEmail = 'owner@zerocouncil.app';
  const ownerGet = await handlers.GET(
    new Request('https://zerocouncil.app/api/payos/orders/123456'),
    ctx
  );
  assert.equal(ownerGet.status, 200);
  const ownerPayload = await ownerGet.json();
  assert.equal(ownerPayload.orderCode, 123456);
  assert.equal(ownerPayload.userEmail, undefined);

  // POST without Origin -> 403 CSRF
  const csrfPost = await handlers.POST(
    new Request('https://zerocouncil.app/api/payos/orders/123456', { method: 'POST' }),
    ctx
  );
  assert.equal(csrfPost.status, 403);

  // PATCH in production -> hard 404 even for signed-in owner with valid Origin
  await withEnv(
    {
      NODE_ENV: 'production',
      VERCEL: undefined,
      PAYOS_CLIENT_ID: undefined,
      PAYOS_API_KEY: undefined,
      PAYOS_CHECKSUM_KEY: undefined,
    },
    async () => {
      assert.equal(isPayosDevSimulationAllowed(), false);
      const res = await handlers.PATCH(
        new Request('https://zerocouncil.app/api/payos/orders/123456', {
          method: 'PATCH',
          headers: originHeaders,
        }),
        ctx
      );
      assert.equal(res.status, 404);
      assert.equal(grants.length, 0);
    }
  );

  // PATCH on Vercel (VERCEL=1) -> hard 404 even if NODE_ENV=development
  await withEnv(
    {
      NODE_ENV: 'development',
      VERCEL: '1',
      PAYOS_CLIENT_ID: undefined,
      PAYOS_API_KEY: undefined,
      PAYOS_CHECKSUM_KEY: undefined,
    },
    async () => {
      assert.equal(isPayosDevSimulationAllowed(), false);
      const res = await handlers.PATCH(
        new Request('https://zerocouncil.app/api/payos/orders/123456', {
          method: 'PATCH',
          headers: originHeaders,
        }),
        ctx
      );
      assert.equal(res.status, 404);
    }
  );

  // PATCH when PayOS credentials are configured -> hard 404 even in local development
  await withEnv(
    {
      NODE_ENV: 'development',
      VERCEL: undefined,
      PAYOS_CLIENT_ID: 'cid',
      PAYOS_API_KEY: 'key',
      PAYOS_CHECKSUM_KEY: 'chk',
    },
    async () => {
      assert.equal(isPayosDevSimulationAllowed(), false);
      const res = await handlers.PATCH(
        new Request('https://zerocouncil.app/api/payos/orders/123456', {
          method: 'PATCH',
          headers: originHeaders,
        }),
        ctx
      );
      assert.equal(res.status, 404);
    }
  );

  // PATCH in local offline development -> still rejects non-owner (403) and grants owner (200)
  await withEnv(
    {
      NODE_ENV: 'development',
      VERCEL: undefined,
      PAYOS_CLIENT_ID: undefined,
      PAYOS_API_KEY: undefined,
      PAYOS_CHECKSUM_KEY: undefined,
      PAYLOS_CLIENT_ID: undefined,
      PAYLOS_API_KEY: undefined,
      PAYLOS_CHECKSUM_KEY: undefined,
    },
    async () => {
      signedInEmail = 'intruder@zerocouncil.app';
      const denied = await handlers.PATCH(
        new Request('https://zerocouncil.app/api/payos/orders/123456', {
          method: 'PATCH',
          headers: originHeaders,
        }),
        ctx
      );
      assert.equal(denied.status, 403);

      signedInEmail = 'owner@zerocouncil.app';
      const ok = await handlers.PATCH(
        new Request('https://zerocouncil.app/api/payos/orders/123456', {
          method: 'PATCH',
          headers: originHeaders,
        }),
        ctx
      );
      assert.equal(ok.status, 200);
      assert.equal(grants.length, 1);
      assert.equal(grants[0].planId, 'pro');
    }
  );
});

// --- 2. CSRF verifySameOrigin, OAuth canonical redirect & route guard audit ---

test('request-guard: verifySameOrigin blocks cross-site, null, or missing Origin while allowing same-origin', async () => {
  await withEnv({ NEXT_PUBLIC_SITE_URL: 'https://zerocouncil.app' }, async () => {
    const okOrigin = verifySameOrigin(
      new Request('https://zerocouncil.app/api/bots', {
        method: 'POST',
        headers: { Origin: 'https://zerocouncil.app' },
      })
    );
    assert.equal(okOrigin, null);

    const okReferer = verifySameOrigin(
      new Request('https://zerocouncil.app/api/bots', {
        method: 'POST',
        headers: { Referer: 'https://zerocouncil.app/chat?room=1' },
      })
    );
    assert.equal(okReferer, null);

    const rejectedCases = [
      new Request('https://zerocouncil.app/api/bots', { method: 'POST' }),
      new Request('https://zerocouncil.app/api/bots', {
        method: 'POST',
        headers: { Origin: 'null' },
      }),
      new Request('https://zerocouncil.app/api/bots', {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
      }),
      new Request('https://zerocouncil.app/api/bots', {
        method: 'POST',
        headers: {
          Origin: 'https://zerocouncil.app',
          'Sec-Fetch-Site': 'cross-site',
        },
      }),
    ];

    for (const badReq of rejectedCases) {
      const denied = verifySameOrigin(badReq);
      assert.ok(denied instanceof Response);
      assert.equal(denied.status, 403);
      assert.deepEqual(await denied.json(), { ok: false, error: 'CSRF_ORIGIN_MISMATCH' });
    }
  });
});

test('request-guard: accepts the public Host origin behind local and Vercel proxies', async () => {
  await withEnv({ NEXT_PUBLIC_SITE_URL: 'https://zerocouncil.app', VERCEL: undefined }, async () => {
    const localRequest = new Request('http://localhost:8804/api/language', {
      method: 'POST',
      headers: { Host: '127.0.0.1:8804', Origin: 'http://127.0.0.1:8804' },
    });
    assert.equal(verifySameOrigin(localRequest), null);

    await withEnv({ VERCEL: '1' }, async () => {
      const previewRequest = new Request('http://internal-pod/api/language', {
        method: 'POST',
        headers: {
          Host: 'internal-pod',
          Origin: 'https://zero-council-git-feature-preview.vercel.app',
          'x-forwarded-host': 'zero-council-git-feature-preview.vercel.app',
          'x-forwarded-proto': 'https',
        },
      });
      assert.equal(verifySameOrigin(previewRequest), null);

      const crossSiteRequest = new Request('http://internal-pod/api/language', {
        method: 'POST',
        headers: {
          Host: 'internal-pod',
          Origin: 'https://evil.example',
          'x-forwarded-host': 'zero-council-git-feature-preview.vercel.app',
          'x-forwarded-proto': 'https',
          'sec-fetch-site': 'cross-site',
        },
      });
      assert.equal(verifySameOrigin(crossSiteRequest)?.status, 403);
    });
  });
});

test('request-guard: resolveCanonicalOrigin ignores spoofed x-forwarded-host and sanitizeRelativeNextPath blocks open redirects', () => {
  const spoofedReq = new Request('https://internal-pod.local/auth/callback?code=abc', {
    headers: {
      'x-forwarded-host': 'evil.example',
      'x-forwarded-proto': 'https',
    },
  });
  assert.equal(
    resolveCanonicalOrigin(spoofedReq, 'https://zerocouncil.app/'),
    'https://zerocouncil.app'
  );
  assert.equal(resolveCanonicalOrigin(spoofedReq, ''), 'https://internal-pod.local');

  const origin = 'https://zerocouncil.app';
  assert.equal(sanitizeRelativeNextPath('/settings?tab=billing#top', origin), '/settings?tab=billing#top');
  assert.equal(sanitizeRelativeNextPath('//evil.example/phish', origin), '/');
  assert.equal(sanitizeRelativeNextPath('/\\evil.example/phish', origin), '/');
  assert.equal(sanitizeRelativeNextPath('https://evil.example/phish', origin), '/');
  assert.equal(sanitizeRelativeNextPath('javascript:alert(1)', origin), '/');
  assert.equal(sanitizeRelativeNextPath('/path\r\nSet-Cookie: bad=1', origin), '/');
});

test('static security audit: all cookie-authenticated mutating API routes enforce verifySameOrigin and zero NEXT_PUBLIC_PAYOS_* exist', () => {
  const apiDir = path.join(repoRoot, 'web', 'src', 'app', 'api');
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name === 'route.ts') out.push(full);
    }
    return out;
  };

  const exemptNonCookieRoutes = new Set([
    path.join(apiDir, 'payos', 'webhook', 'route.ts'),
    path.join(apiDir, 'council', 'route.ts'),
    path.join(apiDir, 'dev-login', 'route.ts'),
  ]);

  for (const routeFile of walk(apiDir)) {
    const src = fs.readFileSync(routeFile, 'utf8');
    const exportsMutation = /export\s+(?:async\s+function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/.test(src);
    if (!exportsMutation || exemptNonCookieRoutes.has(routeFile)) continue;

    // `payos/orders/[orderCode]/route.ts` delegates directly to `createPayosOrderHandlers`, which calls `verifySameOrigin`.
    const guarded =
      src.includes('verifySameOrigin(') || src.includes('createPayosOrderHandlers(');
    assert.ok(
      guarded,
      `Expected CSRF verifySameOrigin guard in mutating route: ${path.relative(repoRoot, routeFile)}`
    );
  }

  // Ensure PayOS webhook route NEVER calls verifySameOrigin (external server-to-server callback).
  const webhookSrc = fs.readFileSync(path.join(apiDir, 'payos', 'webhook', 'route.ts'), 'utf8');
  assert.equal(webhookSrc.includes('verifySameOrigin'), false);

  // Ensure zero references to NEXT_PUBLIC_PAYOS_ anywhere in web/src.
  const webSrcDir = path.join(repoRoot, 'web', 'src');
  const checkNoPublicPayos = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) checkNoPublicPayos(full);
      else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8');
        assert.equal(
          content.includes('NEXT_PUBLIC_PAYOS_'),
          false,
          `Forbidden client-exposed PayOS env var in ${path.relative(repoRoot, full)}`
        );
      }
    }
  };
  checkNoPublicPayos(webSrcDir);
});

// --- 3. Server-side plan limits & DB migration 0010 audit ---

test('planLimits: enforces maxActiveAdvisors and locks excess bots after downgrade', () => {
  assert.equal(isGroupRosterOverPlanLimit(2, 'free'), false);
  assert.equal(isGroupRosterOverPlanLimit(3, 'free'), true);
  assert.equal(isGroupRosterOverPlanLimit(4, 'pro'), false);
  assert.equal(isGroupRosterOverPlanLimit(5, 'pro'), true);
  assert.equal(isGroupRosterOverPlanLimit(8, 'ultra'), false);
  assert.equal(isGroupRosterOverPlanLimit(9, 'ultra'), true);

  assert.equal(resolveRequestBotId('bot:advisor-1'), 'advisor-1');
  assert.equal(resolveRequestBotId(undefined, 'bot:advisor-2'), 'advisor-2');
  assert.equal(resolveRequestBotId(undefined, 'builtin-stoic'), null);

  assert.deepEqual(resolveRequestBotIds('advisor-1', 'bot:advisor-2'), ['advisor-1', 'advisor-2']);
  assert.deepEqual(resolveRequestBotIds('advisor-1', 'advisor-2'), ['advisor-1', 'advisor-2']);
  assert.equal(resolveRequestBotId('advisor-1', 'bot:advisor-2'), 'advisor-2');

  const bots = [
    { id: 'b1', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b2', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'b3', createdAt: '2026-01-03T00:00:00.000Z' },
  ];
  assert.equal(isBotDisabledForPlan('b1', bots, 'free'), false);
  assert.equal(isBotDisabledForPlan('b2', bots, 'free'), false);
  assert.equal(isBotDisabledForPlan('b3', bots, 'free'), true);
  assert.equal(isBotDisabledForPlan('bot:b3', bots, 'free'), true);
  assert.equal(isBotDisabledForPlan('b3', bots, 'pro'), false);
  assert.ok(resolveRequestBotIds('b1', 'bot:b3').some((id) => isBotDisabledForPlan(id, bots, 'free')));
});

test('plan prices do not imply monthly billing for one-time 30-day passes', () => {
  assert.equal(planPrice(PLANS.find((plan) => plan.id === 'pro'), 'en'), '$5.99');
  assert.equal(planPrice(PLANS.find((plan) => plan.id === 'pro'), 'vi'), '139.000₫');
});

test('public documentation matches the shipped 55-second turn timeout', () => {
  for (const file of ['README.md', 'features/FEATURE_MAP.md']) {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    assert.match(source, /55s/, `${file} should document the shipped 55-second timeout`);
    assert.doesNotMatch(source, /30s/, `${file} must not claim a 30-second turn timeout`);
  }
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /AppContext\.tsx/, 'README should not point to the removed AppContext file');
});

test('migration 0010 & stale catalog cleanup: revokes anon/authenticated grants, hardens trigger, and removes dead seed', () => {
  const migrationPath = path.join(
    repoRoot,
    'web',
    'supabase',
    'migrations',
    '0010_lockdown_rls_and_indexes.sql'
  );
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /drop policy if exists "Users can read\/manage their own profile" on public\.zc_users/i);
  assert.match(sql, /drop policy if exists "Users can modify their own custom agents" on public\.zc_agents/i);
  assert.match(sql, /drop policy if exists "Users can manage conversations they own" on public\.zc_conversations/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.%I FROM anon, authenticated/i);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(sql, /IF new\.email IS NULL OR pg_catalog\.btrim\(new\.email\) = '' THEN/i);
  assert.match(sql, /idx_zc_conversations_user_updated/i);
  assert.match(sql, /idx_zc_orders_user_created/i);

  const deadSeedPath = path.join(repoRoot, 'web', 'supabase', 'seed', 'providers_models.sql');
  assert.equal(fs.existsSync(deadSeedPath), false);

  const providerKeysStoreSrc = fs.readFileSync(
    path.join(repoRoot, 'web', 'src', 'lib', 'store', 'providerKeys.ts'),
    'utf8'
  );
  assert.equal(providerKeysStoreSrc.includes('zc_agent_providers'), false);
});

// --- 4. Unified SSRF guard & BYOK server redirect refusal ---

test('ssrf: blocks IPv4 private/metadata/CGNAT/benchmark, IPv6 fe80..febf, and hex-normalized ::ffff:a9fe:a9fe', () => {
  const blockedIps = [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fe9f::1',
    'febf::1',
    '::ffff:169.254.169.254',
    '::ffff:a9fe:a9fe',
    '::ffff:7f00:1',
    '64:ff9b::a9fe:a9fe',
    '2002:a9fe:a9fe::1',
  ];
  for (const ip of blockedIps) {
    assert.equal(isBlockedIp(ip), true, `Expected IP to be blocked: ${ip}`);
  }

  assert.equal(isBlockedIp('93.184.216.34'), false);
  assert.equal(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946'), false);

  assert.equal(isPrivateHostname('localhost.'), true);
  assert.equal(isPrivateHostname('metadata.google.internal.'), true);
  assert.equal(isPrivateHostname('api.openai.com'), false);

  // `new URL()` rewrites `[::ffff:169.254.169.254]` into `[::ffff:a9fe:a9fe]` — must stay blocked!
  const hexMappedCheck = validateRemoteUrlLiteral('https://[::ffff:169.254.169.254]/v1/models', {
    requireHttps: true,
  });
  assert.equal(hexMappedCheck.ok, false);
  assert.equal(hexMappedCheck.error.code, 'BLOCKED_ADDRESS');
});

test('ssrf: assertSafeRemoteUrl & verifyProviderKey reject DNS hostnames resolving to private IPs before fetch', async () => {
  await assert.rejects(
    () =>
      assertSafeRemoteUrl('https://rebind.attacker.example/v1', {
        requireHttps: true,
        lookupImpl: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '169.254.169.254', family: 4 },
        ],
      }),
    (err) => err instanceof UnsafeRemoteUrlError && err.code === 'BLOCKED_ADDRESS'
  );

  const safeUrl = await assertSafeRemoteUrl('https://gateway.example.com/v1', {
    requireHttps: true,
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
  });
  assert.equal(safeUrl.origin, 'https://gateway.example.com');

  await withEnv({ NODE_ENV: 'production', VERCEL: '1', ZC_ALLOW_PRIVATE_PROVIDER_URLS: undefined }, async () => {
    let fetchCalls = 0;
    const result = await verifyProviderKey(
      {
        providerId: 'custom:openai:gw',
        protocol: 'openai',
        baseUrl: 'https://ssrf-gateway.example.com/v1',
      },
      'sk-custom-test-key-123456',
      {
        lookupImpl: async () => [{ address: '127.0.0.1', family: 4 }],
        fetchImpl: async () => {
          fetchCalls += 1;
          return new Response('{}', { status: 200 });
        },
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'INVALID_BASE_URL');
    assert.equal(fetchCalls, 0);
  });
});

test('byok server fetch: sets redirect:"error" and refuses 3xx responses without following internal redirects', async () => {
  const originalFetch = globalThis.fetch;
  let seenRedirectMode = null;
  globalThis.fetch = async (_url, init) => {
    seenRedirectMode = init?.redirect ?? null;
    return new Response('', {
      status: 302,
      headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
    });
  };
  try {
    await assert.rejects(
      () =>
        completeByokText(
          {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: 'sk-test-12345678',
          },
          {
            system: 'sys',
            prompt: 'hello',
          }
        ),
      /redirect/i
    );
    assert.equal(seenRedirectMode, 'error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- 5. Core AI engine, model allow-list, conclusion honesty & ops ---

test('modelAllowList: restores Gemini 2.5 chat family, expands OpenRouter vendors, and excludes non-chat models', () => {
  const googleProvider = PROVIDERS.find((p) => p.id === 'google');
  assert.equal(googleProvider?.models[0]?.id, 'gemini-2.5-flash');

  const googleFiltered = visibleModelsForProvider('google', [
    'gemini-3.1-pro',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-embedding-001',
    'imagen-3.0-generate-002',
    'veo-2.0-generate-001',
  ]);
  assert.deepEqual(googleFiltered, [
    'gemini-3.1-pro',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ]);

  const openRouterFiltered = visibleModelsForProvider('openrouter', [
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'moonshotai/kimi-k2',
    'minimax/minimax-m1',
    'liquid/lfm-7b',
    'z-ai/glm-4.5',
    'microsoft/phi-4',
    'nousresearch/hermes-3-llama-3.1-405b',
    'openai/text-embedding-3-large',
    'openai/dall-e-3',
    'openai/whisper-large-v3',
  ]);
  assert.deepEqual(openRouterFiltered, [
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'moonshotai/kimi-k2',
    'minimax/minimax-m1',
    'liquid/lfm-7b',
    'z-ai/glm-4.5',
    'microsoft/phi-4',
    'nousresearch/hermes-3-llama-3.1-405b',
  ]);

  assert.equal(isNonChatModel('text-embedding-3-small'), true);
  assert.equal(isNonChatModel('omni-moderation-latest'), true);
  assert.equal(isNonChatModel('gemini-2.5-flash'), false);
});

test('chat engine: aborts per-turn signal on timeout without retrying, and retries transient 503 once', async () => {
  assert.equal(DEFAULT_TURN_TIMEOUT_MS, 55_000);

  let timeoutCalls = 0;
  let childAborted = false;
  const timedOut = await runTurn({
    roster: [{ id: 'b1', name: 'BotOne' }],
    mode: 'panel',
    history: [],
    userMessage: { id: 'u1', authorId: 'user', body: 'Analyze market', mentioned: [] },
    turnTimeoutMs: 30,
    retryDelayMs: 5,
    generate: (req) =>
      new Promise((_resolve, reject) => {
        timeoutCalls += 1;
        req.signal?.addEventListener(
          'abort',
          () => {
            childAborted = true;
            reject(new DOMException('Turn timed out', 'AbortError'));
          },
          { once: true }
        );
      }),
  });
  assert.equal(timeoutCalls, 1, 'Timeouts must never auto-retry');
  assert.equal(childAborted, true, 'Child AbortController must abort hung generator');
  assert.equal(timedOut.stoppedBy, 'failed');
  assert.equal(timedOut.failureReason, 'timeout');
  assert.equal(timedOut.turnError?.reason, 'timeout');

  let transientCalls = 0;
  const recovered = await runTurn({
    roster: [{ id: 'b1', name: 'BotOne' }],
    mode: 'panel',
    history: [],
    userMessage: { id: 'u2', authorId: 'user', body: 'Retry once on 503', mentioned: [] },
    turnTimeoutMs: 1_000,
    retryDelayMs: 5,
    generate: async () => {
      transientCalls += 1;
      if (transientCalls === 1) {
        throw new Error('OpenAI 503: Service Unavailable');
      }
      return { text: 'Recovered on second attempt.', handoffs: ['user'] };
    },
  });
  assert.equal(transientCalls, 2);
  assert.equal(recovered.messages.at(-1)?.body, 'Recovered on second attempt.');
});

test('conclusion: throws ConclusionAnalysisError instead of fabricating fake Concluded report on missing key or 429', async () => {
  const persona = {
    id: 'bot:analyst',
    name: 'Analyst',
    archetype: 'Strategist',
    model: 'gpt-4o-mini',
    provider: 'openai',
    colorToken: 'persona-sage',
    colorHex: '#7C9885',
    stance: 'Analytical',
    instructions: '',
    sampleQuote: '',
  };
  const messages = [{ id: 'm1', authorId: 'user', body: 'Should we ship today?', mentioned: [] }];

  await assert.rejects(
    () =>
      analyzeChatRoomConclusion({
        topic: 'Launch readiness',
        messages,
        seated: [persona],
        allPersonas: [persona],
        apiKeys: [],
        keys: {},
        language: 'en',
      }),
    (err) => err instanceof ConclusionAnalysisError && err.reason === 'missing-key'
  );

  await assert.rejects(
    () =>
      analyzeChatRoomConclusion({
        topic: 'Launch readiness',
        messages,
        seated: [persona],
        allPersonas: [persona],
        apiKeys: [
          {
            provider: 'openai',
            label: 'OpenAI',
            modelName: 'gpt-4o-mini',
            connected: true,
            hasKey: true,
          },
        ],
        keys: {},
        language: 'en',
        completeFn: async () => {
          throw new Error('OpenAI 429: Too Many Requests — rate limit exceeded');
        },
      }),
    (err) => err instanceof ConclusionAnalysisError && err.reason === 'rate-limit'
  );
});

test('ops: FOUNDER_EMAILS overrides founder set at runtime and sync-vercel-env.yml pins checkout SHA without PAYLOS_ typos', async () => {
  await withEnv({ FOUNDER_EMAILS: ' cofounder@zerocouncil.app , ops@zerocouncil.app ' }, () => {
    assert.equal(isFounder('COFOUNDER@zerocouncil.app'), true);
    assert.equal(isFounder('ops@zerocouncil.app'), true);
    assert.equal(isFounder(FOUNDER_EMAIL), false);
  });

  const workflowSrc = fs.readFileSync(
    path.join(repoRoot, '.github', 'workflows', 'sync-vercel-env.yml'),
    'utf8'
  );
  assert.match(workflowSrc, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.equal(workflowSrc.includes('actions/checkout@v4'), false);
  assert.equal(workflowSrc.includes('PAYLOS_'), false);
});
