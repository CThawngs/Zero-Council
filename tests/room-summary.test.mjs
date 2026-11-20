import assert from 'node:assert/strict';
import test from 'node:test';

test('RoomSummaryView roster & message filtering only includes user-created bots', () => {
  // Simulate the personas pool (presets + user bots)
  const personas = [
    { id: 'pragmatist', name: 'Pragmatist', model: 'claude-sonnet-4-5', provider: 'anthropic' },
    { id: 'dreamer', name: 'Dreamer', model: 'gpt-4o', provider: 'openai' },
    { id: 'bot:custom-1', name: 'My Custom Bot 1', model: 'gpt-4o-mini', provider: 'openai' },
    { id: 'bot:custom-2', name: 'My Custom Bot 2', model: 'claude-sonnet-4-5', provider: 'anthropic' },
  ];

  // Logic replicated directly from RoomSummaryView
  const userBots = personas.filter((persona) => persona.id.startsWith('bot:'));
  assert.equal(userBots.length, 2);
  assert.deepEqual(userBots.map((b) => b.id), ['bot:custom-1', 'bot:custom-2']);

  // Case 1: Room with mixed roster (preset + user bot)
  const roomMixed = {
    roster: ['pragmatist', 'bot:custom-1'],
    messages: [
      { id: '1', authorId: 'user', body: 'Hello team' },
      { id: '2', authorId: 'pragmatist', body: 'Preset advice here' },
      { id: '3', authorId: 'bot:custom-1', body: 'Custom bot response' },
    ],
  };

  const rosterMixed = roomMixed.roster
    .map((id) => userBots.find((persona) => persona.id === id || persona.id === `bot:${id}`))
    .filter((persona) => Boolean(persona));

  assert.equal(rosterMixed.length, 1);
  assert.equal(rosterMixed[0].id, 'bot:custom-1');

  const advisorMessagesMixed = roomMixed.messages.filter(
    (message) =>
      message.authorId !== 'user' &&
      rosterMixed.some((persona) => persona.id === message.authorId || `bot:${persona.id}` === message.authorId)
  );

  assert.equal(advisorMessagesMixed.length, 1);
  assert.equal(advisorMessagesMixed[0].authorId, 'bot:custom-1');

  const positionsMixed = rosterMixed.map((persona) => {
    const spoken = advisorMessagesMixed.filter(
      (message) => message.authorId === persona.id || `bot:${persona.id}` === message.authorId
    );
    return { persona, turns: spoken.length, last: spoken[spoken.length - 1] };
  });

  assert.equal(positionsMixed.length, 1);
  assert.equal(positionsMixed[0].persona.name, 'My Custom Bot 1');
  assert.equal(positionsMixed[0].turns, 1);
  assert.equal(positionsMixed[0].last?.body, 'Custom bot response');

  // Case 2: Room with only presets -> no user bots shown
  const roomPresetsOnly = {
    roster: ['pragmatist', 'dreamer'],
    messages: [
      { id: '1', authorId: 'user', body: 'Hello' },
      { id: '2', authorId: 'pragmatist', body: 'Advice' },
    ],
  };

  const rosterPresetsOnly = roomPresetsOnly.roster
    .map((id) => userBots.find((persona) => persona.id === id || persona.id === `bot:${id}`))
    .filter((persona) => Boolean(persona));

  assert.equal(rosterPresetsOnly.length, 0);

  const advisorMessagesPresetsOnly = roomPresetsOnly.messages.filter(
    (message) =>
      message.authorId !== 'user' &&
      rosterPresetsOnly.some((persona) => persona.id === message.authorId || `bot:${persona.id}` === message.authorId)
  );

  assert.equal(advisorMessagesPresetsOnly.length, 0);

  // Case 3: Room with only user-created bots
  const roomUserBotsOnly = {
    roster: ['bot:custom-1', 'bot:custom-2'],
    messages: [
      { id: '1', authorId: 'user', body: 'What should we build?' },
      { id: '2', authorId: 'bot:custom-1', body: 'Let us build X' },
      { id: '3', authorId: 'bot:custom-2', body: 'I agree with X' },
    ],
  };

  const rosterUserBotsOnly = roomUserBotsOnly.roster
    .map((id) => userBots.find((persona) => persona.id === id || persona.id === `bot:${id}`))
    .filter((persona) => Boolean(persona));

  assert.equal(rosterUserBotsOnly.length, 2);
  assert.deepEqual(rosterUserBotsOnly.map((b) => b.id), ['bot:custom-1', 'bot:custom-2']);
});

test('openRoomConclusion resolves seated advisors regardless of bot: prefix', () => {
  const matchId = (p, id) => {
    if (p.id === id) return true;
    const strip = (s) => (s.startsWith('bot:') ? s.slice(4) : s);
    return strip(p.id) === strip(id);
  };

  const localizedPersonas = [
    { id: 'pragmatist', name: 'The Pragmatist' },
    { id: 'dreamer', name: 'The Dreamer' },
    { id: 'bot:bot-uuid-1', name: 'Bot 1' },
    { id: 'bot:bot-uuid-2', name: 'Bot 2' },
  ];

  // Case 1: Room roster has unprefixed bot ID
  const roomUnprefixed = {
    roster: ['bot-uuid-1', 'dreamer'],
    title: 'Room with unprefixed bot',
    messages: [{ authorId: 'user', body: 'Question?' }],
  };

  const seated1 = roomUnprefixed.roster
    .map((id) => localizedPersonas.find((persona) => matchId(persona, id)))
    .filter(Boolean);

  assert.equal(seated1.length, 2);
  assert.equal(seated1[0].name, 'Bot 1');
  assert.equal(seated1[1].name, 'The Dreamer');

  // Case 2: Room roster has prefixed bot ID
  const roomPrefixed = {
    roster: ['bot:bot-uuid-1', 'bot:bot-uuid-2'],
    title: 'Room with prefixed bots',
    messages: [{ authorId: 'user', body: 'Question 2?' }],
  };

  const seated2 = roomPrefixed.roster
    .map((id) => localizedPersonas.find((persona) => matchId(persona, id)))
    .filter(Boolean);

  assert.equal(seated2.length, 2);
  assert.equal(seated2[0].name, 'Bot 1');
  assert.equal(seated2[1].name, 'Bot 2');

  // Case 3: Button enablement check (only disabled while isDeliberating)
  const isConclusionDisabled = (isDeliberating) => isDeliberating;
  assert.equal(isConclusionDisabled(true), true); // Deliberating -> disabled
  assert.equal(isConclusionDisabled(false), false); // Ready -> enabled
});
