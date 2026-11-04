// validateBotInput: bounds mirror the wizard UI and the 0005 migration CHECKs.
import assert from 'node:assert/strict';
import test from 'node:test';

const { validateBotInput } = await import(
  '../web/src/lib/store/botValidation.ts?bots=1'
);

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

test('openai provider accepted', () => {
  const result = validateBotInput({ ...valid, provider: 'openai', model: 'gpt-4o' });
  assert.equal(result.bot.provider, 'openai');
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
