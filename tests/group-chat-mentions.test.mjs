import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CHAT_UX_COPY,
  applyMentionReplacement,
  buildMentionCandidates,
  detectMentionQuery,
  filterMentionCandidates,
  formatTurnFailureReason,
  normalizeMentionSearch,
  tokenizeMentions,
  triggerMentionAtCursor,
} = await import('../web/src/prototype/chat/mentions.ts');

const {
  COUNCIL_ROUNDS,
  RESUME_ALL,
  USER_HANDLE,
  parseMentions,
  planSpeakers,
  runTurn,
} = await import('../web/src/prototype/chat/engine.ts');

const { buildSystemPrompt } = await import('../web/src/prototype/chat/prompts.ts');
const { resolveTarget } = await import('../web/src/prototype/chat/byok.ts');
const { scriptedGenerator } = await import('../web/src/prototype/chat/scripted.ts');
const {
  buildFallbackConclusion,
  pickConclusionAnalyst,
} = await import('../web/src/prototype/chat/conclusion.ts');

const GROUP_ROSTER = [
  {
    id: 'bot:a',
    name: 'The Pragmatist',
    archetype: 'Operations',
    providerLabel: 'Anthropic',
    modelLabel: 'Claude Sonnet 4.5',
    colorHex: '#2f6bff',
    connected: true,
    locked: false,
  },
  {
    id: 'bot:b',
    name: 'Cố vấn Chiến lược',
    archetype: 'Chiến lược',
    providerLabel: 'OpenAI',
    modelLabel: 'GPT-4o',
    colorHex: '#16b981',
    connected: false,
    locked: false,
  },
  {
    id: 'bot:c',
    name: 'Đức Kỹ Sư',
    archetype: 'Kiến trúc sư',
    providerLabel: 'Google Gemini',
    modelLabel: 'Gemini 2.5 Flash',
    colorHex: '#f5a524',
    connected: true,
    locked: false,
  },
  {
    id: 'bot:locked',
    name: 'Locked Advisor',
    archetype: 'Paused',
    connected: false,
    locked: true,
  },
];

const ENGINE_ROSTER = [
  { id: 'bot:a', name: 'The Pragmatist' },
  { id: 'bot:b', name: 'Cố vấn Chiến lược' },
  { id: 'bot:c', name: 'Đức Kỹ Sư' },
];

test('detectMentionQuery triggers on valid @ positions and ignores emails, newlines, and completed mentions', () => {
  const handles = ['all', 'everyone', 'user', 'you', 'The Pragmatist', 'Cố vấn Chiến lược', 'Đức Kỹ Sư'];

  assert.deepEqual(detectMentionQuery('@', 1, handles), { start: 0, end: 1, query: '' });
  assert.deepEqual(detectMentionQuery('Hey @Prag', 9, handles), {
    start: 4,
    end: 9,
    query: 'Prag',
  });
  assert.deepEqual(detectMentionQuery('(@Cố vấn', 8, handles), {
    start: 1,
    end: 8,
    query: 'Cố vấn',
  });

  // Mid-sentence cursor before trailing words
  const mid = 'Ask @duc about caching';
  assert.deepEqual(detectMentionQuery(mid, 8, handles), {
    start: 4,
    end: 8,
    query: 'duc',
  });

  // Must NOT trigger inside email addresses
  assert.equal(detectMentionQuery('Email dev@zerocouncil.local', 27, handles), null);
  assert.equal(detectMentionQuery('user.name@company.vn', 20, handles), null);

  // Must NOT trigger across newline boundaries
  assert.equal(detectMentionQuery('@Prag\nnext line', 15, handles), null);

  // Completed handle + trailing space closes the menu automatically
  assert.equal(detectMentionQuery('@all ', 5, handles), null);
  assert.equal(detectMentionQuery('@user ', 6, handles), null);
  assert.equal(detectMentionQuery('@The Pragmatist ', 16, handles), null);
  assert.equal(detectMentionQuery('@Cố vấn Chiến lược ', 19, handles), null);
});

test('triggerMentionAtCursor inserts @ cleanly on mobile/toolbar tap and toggles bare @ closed', () => {
  const emptyTap = triggerMentionAtCursor('', 0);
  assert.deepEqual(emptyTap, { text: '@', cursor: 1, toggledClosed: false });

  const secondTap = triggerMentionAtCursor('@', 1);
  assert.deepEqual(secondTap, { text: '', cursor: 0, toggledClosed: true });

  const afterWord = triggerMentionAtCursor('Hello', 5);
  assert.deepEqual(afterWord, { text: 'Hello @', cursor: 7, toggledClosed: false });

  const afterSpace = triggerMentionAtCursor('Hello ', 6);
  assert.deepEqual(afterSpace, { text: 'Hello @', cursor: 7, toggledClosed: false });
});

test('buildMentionCandidates and filterMentionCandidates support Vietnamese diacritics (including đ/Đ), roles, @all, and @user', () => {
  assert.equal(normalizeMentionSearch('Đức Kỹ Sư — Cố vấn'), 'duc ky su co van');

  const groupEn = buildMentionCandidates({
    roster: GROUP_ROSTER,
    isSolo: false,
    language: 'en',
  });
  // @all + 3 unlocked bots + @user (locked bot excluded)
  assert.deepEqual(
    groupEn.map((c) => c.id),
    [RESUME_ALL, 'bot:a', 'bot:b', 'bot:c', USER_HANDLE]
  );

  const soloVi = buildMentionCandidates({
    roster: [GROUP_ROSTER[1]],
    isSolo: true,
    language: 'vi',
  });
  // Solo chat omits @all, includes solo bot + @user
  assert.deepEqual(
    soloVi.map((c) => c.id),
    ['bot:b', USER_HANDLE]
  );

  // Vietnamese accent-insensitive filtering (including đ/Đ)
  const matchCoVan = filterMentionCandidates(groupEn, 'co van');
  assert.equal(matchCoVan[0]?.id, 'bot:b');

  const matchDuc = filterMentionCandidates(groupEn, 'duc ky');
  assert.equal(matchDuc[0]?.id, 'bot:c');

  // Vietnamese alias filtering for @all and @user
  const matchTatCa = filterMentionCandidates(groupEn, 'tat ca');
  assert.equal(matchTatCa[0]?.id, RESUME_ALL);

  const matchBan = filterMentionCandidates(groupEn, 'nguoi dung');
  assert.equal(matchBan[0]?.id, USER_HANDLE);

  const matchYou = filterMentionCandidates(groupEn, 'you');
  assert.equal(matchYou[0]?.id, USER_HANDLE);

  // Role / model search
  const matchRole = filterMentionCandidates(groupEn, 'kien truc');
  assert.equal(matchRole[0]?.id, 'bot:c');
});

test('applyMentionReplacement inserts @Handle with single trailing space and accurate caret index', () => {
  const startReplace = applyMentionReplacement('@pr', { start: 0, end: 3 }, 'The Pragmatist');
  assert.deepEqual(startReplace, {
    text: '@The Pragmatist ',
    cursor: 16,
  });

  // Mid-sentence replacement must not duplicate the existing space after the replaced token
  const midText = 'Ask @co about pricing';
  const midReplace = applyMentionReplacement(midText, { start: 4, end: 7 }, 'Cố vấn Chiến lược');
  assert.equal(midReplace.text, 'Ask @Cố vấn Chiến lược about pricing');
  assert.equal(midReplace.text.slice(0, midReplace.cursor), 'Ask @Cố vấn Chiến lược ');
});

test('tokenizeMentions highlights @BotName, @all, @user, @you while ignoring emails', () => {
  const names = ['The Pragmatist', 'Cố vấn Chiến lược', 'Đức Kỹ Sư'];
  const body =
    'Chào @all, nhờ @Cố vấn Chiến lược và @The Pragmatist xem mail dev@zerocouncil.local rồi hỏi lại @user / @you nhé!';
  const tokens = tokenizeMentions(body, names);
  const pills = tokens.filter((t) => t.kind !== 'text');

  assert.deepEqual(pills, [
    { kind: 'all', text: '@all' },
    { kind: 'bot', text: '@Cố vấn Chiến lược' },
    { kind: 'bot', text: '@The Pragmatist' },
    { kind: 'user', text: '@user' },
    { kind: 'user', text: '@you' },
  ]);
  assert.equal(tokens.map((t) => t.text).join(''), body, 'round-trips exact message text');
});

test('@all, @BotA @BotB subset routing, @you/@user, and BotA -> @BotC A2A handoff stay bounded without loops', async () => {
  // 1. Vietnamese đ/Đ & @you mention parsing
  assert.deepEqual(parseMentions('@duc ky su va @co van chien luoc', ENGINE_ROSTER), [
    'bot:c',
    'bot:b',
  ]);
  assert.deepEqual(parseMentions('What do @you think?', ENGINE_ROSTER), [USER_HANDLE]);

  // 2. @all schedules every room bot cleanly
  const allPlan = planSpeakers({
    roster: ENGINE_ROSTER,
    mode: 'round-robin',
    history: [{ id: 'h1', authorId: 'bot:b', body: 'prev', mentioned: [] }],
    userMessage: {
      id: 'u1',
      authorId: USER_HANDLE,
      body: '@all cùng phân tích nhé',
      mentioned: parseMentions('@all cùng phân tích nhé', ENGINE_ROSTER),
    },
  });
  assert.deepEqual(
    allPlan.speakers.map((b) => b.id),
    ['bot:a', 'bot:b', 'bot:c']
  );

  // 3. @BotC @BotA routes to the tagged subset in mention order, and BotA handing off to BotB
  //    brings BotB into the conversation cleanly within COUNCIL_ROUNDS without infinite loops
  const subsetMsg = {
    id: 'u2',
    authorId: USER_HANDLE,
    body: '@Đức Kỹ Sư @The Pragmatist đánh giá kiến trúc này',
    mentioned: parseMentions('@Đức Kỹ Sư @The Pragmatist đánh giá kiến trúc này', ENGINE_ROSTER),
  };
  const subsetPlan = planSpeakers({
    roster: ENGINE_ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: subsetMsg,
  });
  assert.deepEqual(
    subsetPlan.speakers.map((b) => b.id),
    ['bot:c', 'bot:a']
  );

  const { speakers, stoppedBy } = await runTurn({
    roster: ENGINE_ROSTER,
    mode: 'round-robin',
    history: [],
    userMessage: subsetMsg,
    rounds: COUNCIL_ROUNDS,
    generate: ({ bot }) => {
      if (bot.id === 'bot:c') {
        return { text: 'Kiến trúc ổn, nhờ @The Pragmatist xem vận hành.', handoffs: ['bot:a'] };
      }
      if (bot.id === 'bot:a') {
        return {
          text: 'Vận hành tốt, mời @Cố vấn Chiến lược chốt hướng thương mại.',
          handoffs: ['bot:b'],
        };
      }
      return { text: 'Chiến lược đã rõ, chốt lại với @user nhé!', handoffs: [USER_HANDLE] };
    },
  });

  assert.deepEqual(speakers, ['bot:c', 'bot:a', 'bot:b']);
  assert.equal(stoppedBy, 'user');

  // 4. resolveTarget handles 'all' and 'you'
  assert.deepEqual(resolveTarget('all', ENGINE_ROSTER), ['bot:a', 'bot:b', 'bot:c']);
  assert.deepEqual(resolveTarget('@everyone', ENGINE_ROSTER), ['bot:a', 'bot:b', 'bot:c']);
  assert.deepEqual(resolveTarget('@you', ENGINE_ROSTER), [USER_HANDLE]);
});

test('buildSystemPrompt instructs group chat peers to collaborate with @BotName and @user in active language', () => {
  const baseReq = {
    bot: ENGINE_ROSTER[0],
    roster: ENGINE_ROSTER,
    history: [],
    waiting: [ENGINE_ROSTER[1]],
    handoffTargets: [ENGINE_ROSTER[1], ENGINE_ROSTER[2]],
    isClosing: false,
    prompt: 'Nên ra mắt tính năng nào trước?',
    language: 'vi',
    attachments: [],
  };

  const viPrompt = buildSystemPrompt(baseReq, 'Chuyên gia vận hành thực chiến.');
  assert.match(viPrompt, /Vietnamese \(Tiếng Việt\)/);
  assert.match(viPrompt, /@BotName/);
  assert.match(viPrompt, /@user/);
  assert.match(viPrompt, /Never call message_agent with your own name/);

  const enPrompt = buildSystemPrompt({ ...baseReq, language: 'en' }, 'Pragmatic operator.');
  assert.match(enPrompt, /Active app\/room language: English/);
});

test('EN/VI parity holds across CHAT_UX_COPY, failure reasons, scriptedGenerator, and conclusion fallbacks', () => {
  const enKeys = Object.keys(CHAT_UX_COPY.en).sort();
  const viKeys = Object.keys(CHAT_UX_COPY.vi).sort();
  assert.deepEqual(enKeys, viKeys, 'EN and VI UX dictionaries have identical keys');

  for (const key of enKeys) {
    assert.ok(CHAT_UX_COPY.en[key].trim().length > 0, `en.${key} non-empty`);
    assert.ok(CHAT_UX_COPY.vi[key].trim().length > 0, `vi.${key} non-empty`);
    assert.notEqual(CHAT_UX_COPY.en[key], CHAT_UX_COPY.vi[key], `${key} localized between EN and VI`);
  }

  for (const kind of ['timeout', 'transient', 'fatal', 'silent']) {
    const enReason = formatTurnFailureReason({ kind, detail: 'err', after: 100, messageId: '1' }, 'en');
    const viReason = formatTurnFailureReason({ kind, detail: 'err', after: 100, messageId: '1' }, 'vi');
    assert.notEqual(enReason, kind, 'does not leak raw failure enum kind in EN');
    assert.notEqual(viReason, kind, 'does not leak raw failure enum kind in VI');
    assert.notEqual(enReason, viReason);
  }

  // Scripted preview generator in Vietnamese has zero leaked English boilerplate
  const gen = scriptedGenerator(ENGINE_ROSTER);
  const viTurn = gen({
    bot: ENGINE_ROSTER[0],
    history: [{ id: '0', authorId: USER_HANDLE, body: 'Kế hoạch Q4', mentioned: [] }],
    waiting: [ENGINE_ROSTER[1]],
    handoffTargets: [ENGINE_ROSTER[1]],
    isClosing: false,
    prompt: 'Kế hoạch Q4',
    language: 'vi',
    attachments: [],
  });
  assert.equal(viTurn.text.includes('On "'), false, 'no hardcoded English echo prefix in VI');
  assert.equal(
    viTurn.text.includes('this is your side of it'),
    false,
    'no hardcoded English handoff phrase in VI'
  );
  assert.equal(
    viTurn.text.includes('the decision at hand'),
    false,
    'no hardcoded English default lens in VI'
  );
  assert.equal(viTurn.text.includes('@Cố vấn Chiến lược'), true);
  assert.deepEqual(viTurn.handoffs, ['bot:b']);

  // Conclusion fallback analyst in Vietnamese has localized name and archetype
  const viAnalyst = pickConclusionAnalyst([], [], {}, 'vi');
  assert.equal(viAnalyst.analyst.name, 'Chuyên gia Phân tích AI');
  assert.equal(viAnalyst.analyst.archetype, 'Phân tích');

  const enAnalyst = pickConclusionAnalyst([], [], {}, 'en');
  assert.equal(enAnalyst.analyst.name, 'AI Analyst');
  assert.equal(enAnalyst.analyst.archetype, 'Analyst');

  const viFallback = buildFallbackConclusion('Chiến lược giá', [], [], viAnalyst.analyst, 'vi');
  assert.equal(viFallback.scenarios.good.title, 'Hướng Tốt (Tích cực)');
});
