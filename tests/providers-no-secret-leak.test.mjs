// Security invariant tests for keeping decrypted BYOK provider keys strictly on the server:
// 1. maskProviderKey never exposes key prefixes or short secrets.
// 2. pickConclusionAnalyst / analyzeChatRoomConclusion work with server-held keys (`hasKey: true`,
//    no plaintext key in `keys`) when routed via the server completion adapter.
// 3. `/api/providers` route handlers and `AppContext.tsx` do not serialize or hydrate `key`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { maskProviderKey } = await import('../web/src/lib/crypto/providerKeys.ts');
const { analyzeChatRoomConclusion, pickConclusionAnalyst } = await import(
  '../web/src/prototype/chat/conclusion.ts'
);

test('maskProviderKey masks short and normal keys without exposing prefix or body', () => {
  assert.equal(maskProviderKey(''), '••••');
  assert.equal(maskProviderKey('sk-12345'), '••••');
  assert.equal(maskProviderKey('  sk-ant-api03-secret-body-wxyz  '), '••••wxyz');
  const masked = maskProviderKey('sk-proj-supersecretkey-9876');
  assert.equal(masked, '••••9876');
  assert.equal(masked.includes('sk-proj'), false);
  assert.equal(masked.includes('supersecretkey'), false);
});

test('pickConclusionAnalyst & analyzeChatRoomConclusion support server-held keys without plaintext in browser', async () => {
  const seated = [
    {
      id: 'bot:alpha',
      name: 'Alpha',
      archetype: 'Alpha',
      model: 'gpt-4o',
      provider: 'openai',
      colorToken: 'persona-sage',
      colorHex: '#7C9885',
      stance: 'Critical thinker',
      instructions: 'Analyze risks',
      sampleQuote: '',
    },
  ];
  const apiKeys = [
    { provider: 'openai', modelName: 'gpt-4o-mini', connected: true, hasKey: true, maskedKey: '••••9876' },
  ];
  const keys = {}; // Browser state holds ZERO plaintext keys.

  const picked = pickConclusionAnalyst(seated, apiKeys, keys);
  assert.equal(picked.analyst.id, 'bot:alpha');
  assert.equal(picked.keyMeta?.provider, 'openai');
  assert.equal(picked.apiKey, undefined);

  let serverProxyCalled = false;
  const result = await analyzeChatRoomConclusion({
    topic: 'Should we ship?',
    messages: [{ id: '1', authorId: 'user', body: 'Should we ship?' }],
    seated,
    allPersonas: seated,
    apiKeys,
    keys,
    language: 'en',
    completeFn: async (credentials) => {
      serverProxyCalled = true;
      assert.equal(credentials.provider, 'openai');
      assert.equal(credentials.model, 'gpt-4o');
      assert.equal(credentials.apiKey, '');
      return JSON.stringify({
        summary: 'Proxy conclusion generated server-side.',
        dissent: 'None.',
        recommendation: 'Proceed.',
        scenarios: {
          good: { title: 'Good', description: 'All green', actions: ['Deploy'] },
          normal: { title: 'Normal', description: 'Steady', actions: ['Monitor'] },
          bad: { title: 'Bad', description: 'Alert fires', actions: ['Rollback'] },
        },
      });
    },
  });

  assert.equal(serverProxyCalled, true);
  assert.equal(result.analysis.chair.summary, 'Proxy conclusion generated server-side.');
});

test('GET /api/providers strips plaintext key and AppContext never hydrates entry.key', () => {
  const providersRoute = readFileSync(join(ROOT, 'web/src/app/api/providers/route.ts'), 'utf8');
  assert.match(providersRoute, /rows\.map\(\(\{\s*key,\s*\.\.\.record\s*\}\)\s*=>/);
  assert.match(providersRoute, /hasKey:\s*true/);
  assert.match(providersRoute, /maskedKey:\s*maskProviderKey/);

  const chatRoute = readFileSync(join(ROOT, 'web/src/app/api/providers/chat/route.ts'), 'utf8');
  assert.match(chatRoute, /currentUserOnly\(\)/);
  assert.match(chatRoute, /enforceRateLimit/);
  assert.match(chatRoute, /getKey\(user\.email,\s*provider\)/);

  const appContext = readFileSync(join(ROOT, 'web/src/prototype/context/AppContext.tsx'), 'utf8');
  assert.equal(appContext.includes('entry.key'), false);
  assert.equal(appContext.includes('[provider]: key'), false);
});
