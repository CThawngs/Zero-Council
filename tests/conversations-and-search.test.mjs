import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zc-conv-test-'));
process.env.ZC_CONVERSATIONS_STORE = path.join(tmpDir, 'conversations.json');
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  validateCreateConversation,
  createConversation,
  listConversations,
  updateConversation,
  deleteConversation,
} = await import('../web/src/lib/store/conversations.ts');
const { parseDuckDuckGoHtml } = await import('../web/src/lib/deliberation/web-search.ts');

test('group chat strictly requires >= 2 bots while solo bot allows multiple 1-on-1 threads', async () => {
  const user = 'founder@example.com';

  assert.deepEqual(
    validateCreateConversation({
      kind: 'group',
      title: 'Invalid Single Bot Group',
      roster: ['bot:1'],
    }),
    { error: 'GROUP_REQUIRES_TWO_BOTS' }
  );

  const validGroup = validateCreateConversation({
    kind: 'group',
    title: 'Product & Engineering Group',
    roster: ['bot:1', 'bot:2'],
    mode: 'round-robin',
  });
  assert.ok('value' in validGroup);

  const group = await createConversation(user, validGroup.value);
  assert.equal(group.kind, 'group');
  assert.deepEqual(group.roster, ['bot:1', 'bot:2']);

  // Multiple independent threads for a single solo bot
  const solo1 = validateCreateConversation({
    kind: 'solo',
    botId: '1',
    title: 'Architecture Review',
    roster: ['bot:1'],
  });
  const solo2 = validateCreateConversation({
    kind: 'solo',
    botId: '1',
    title: 'Pricing Brainstorm',
    roster: ['bot:1'],
  });
  assert.ok('value' in solo1 && 'value' in solo2);

  const soloThread1 = await createConversation(user, solo1.value);
  const soloThread2 = await createConversation(user, solo2.value);
  assert.notEqual(soloThread1.id, soloThread2.id);

  const list = await listConversations(user);
  assert.equal(list.length, 3);

  // Rejects shrinking a group below 2 bots on update
  assert.deepEqual(
    await updateConversation(user, group.id, { roster: ['bot:1'] }),
    { error: 'GROUP_REQUIRES_TWO_BOTS' }
  );

  const updatedRes = await updateConversation(user, group.id, {
    title: 'Core Strategy Council',
    roster: ['bot:1', 'bot:2', 'bot:3'],
  });
  assert.ok('conversation' in updatedRes);
  assert.equal(updatedRes.conversation.title, 'Core Strategy Council');
  assert.equal(updatedRes.conversation.roster.length, 3);

  const deleted = await deleteConversation(user, soloThread1.id);
  assert.equal(deleted, true);
  assert.equal((await listConversations(user)).length, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('parseDuckDuckGoHtml extracts clean live web titles, decoded URLs, and snippets', () => {
  const sampleHtml = `
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fai-trends-2026&rut=abc">AI Engineering Trends 2026</a>
      <a class="result__snippet">Multi-model BYOK architectures and structured agent councils lead enterprise adoption.</a>
    </div>
  `;
  const results = parseDuckDuckGoHtml(sampleHtml, 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'AI Engineering Trends 2026');
  assert.equal(results[0].url, 'https://example.com/ai-trends-2026');
  assert.match(results[0].snippet, /Multi-model BYOK architectures/);
});
