import assert from 'node:assert/strict';
import test from 'node:test';

const {
  validateBotInput,
  BUILTIN_BOT_PROVIDERS,
  slugifyCustomProvider,
} = await import('../web/src/lib/store/botValidation.ts?bots=1');

const valid = {
  name: ' Atlas ',
  instruction: '  Be sharp. ',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
};

test('valid input is trimmed and accepted', () => {
  assert.deepEqual(validateBotInput(valid), {
    bot: { name: 'Atlas', instruction: 'Be sharp.', provider: 'anthropic', model: 'claude-sonnet-4-5' },
  });
});

test('all 8 verified built-in providers are accepted', () => {
  assert.equal(BUILTIN_BOT_PROVIDERS.length, 8);
  for (const prov of BUILTIN_BOT_PROVIDERS) {
    const result = validateBotInput({ ...valid, provider: prov, model: 'test-model' });
    assert.equal(result.bot.provider, prov);
  }
});

test('custom OpenAI and Anthropic provider slugs are accepted', () => {
  const oaiId = slugifyCustomProvider('openai', 'Together AI Gateway!');
  assert.equal(oaiId, 'custom:openai:together-ai-gateway');
  assert.equal(validateBotInput({ ...valid, provider: oaiId, model: 'qwen-2.5' }).bot.provider, oaiId);

  const antId = slugifyCustomProvider('anthropic', 'Claude Proxy');
  assert.equal(antId, 'custom:anthropic:claude-proxy');
  assert.equal(validateBotInput({ ...valid, provider: antId, model: 'claude-custom' }).bot.provider, antId);
});

test('blank name rejected as NAME_REQUIRED', () => {
  assert.deepEqual(validateBotInput({ ...valid, name: '   ' }), { error: 'NAME_REQUIRED' });
});

test('name over 80 chars rejected', () => {
  assert.deepEqual(validateBotInput({ ...valid, name: 'x'.repeat(81) }), { error: 'NAME_REQUIRED' });
});

test('blank instruction rejected as INSTRUCTION_REQUIRED', () => {
  assert.deepEqual(validateBotInput({ ...valid, instruction: '' }), { error: 'INSTRUCTION_REQUIRED' });
});

test('instruction over 4000 chars rejected', () => {
  assert.deepEqual(validateBotInput({ ...valid, instruction: 'x'.repeat(4001) }), {
    error: 'INSTRUCTION_REQUIRED',
  });
});

test('unknown provider rejected as UNKNOWN_PROVIDER', () => {
  assert.deepEqual(validateBotInput({ ...valid, provider: 'gemini' }), { error: 'UNKNOWN_PROVIDER' });
  assert.deepEqual(validateBotInput({ ...valid, provider: 'custom:google:foo' }), {
    error: 'UNKNOWN_PROVIDER',
  });
});

test('non-string provider rejected as UNKNOWN_PROVIDER', () => {
  assert.deepEqual(validateBotInput({ ...valid, provider: 42 }), { error: 'UNKNOWN_PROVIDER' });
});

test('blank model rejected as MODEL_REQUIRED', () => {
  assert.deepEqual(validateBotInput({ ...valid, model: ' ' }), { error: 'MODEL_REQUIRED' });
});

test('non-string name rejected as NAME_REQUIRED', () => {
  assert.deepEqual(validateBotInput({ ...valid, name: null }), { error: 'NAME_REQUIRED' });
});
