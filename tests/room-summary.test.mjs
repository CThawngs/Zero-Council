import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeChatRoomConclusion,
  buildFallbackConclusion,
  extractChatTranscriptAndContributions,
  extractReadableSummary,
  matchPersonaId,
  parseConclusionResponse,
  pickConclusionAnalyst,
} from '../web/src/prototype/chat/conclusion.ts';

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
    .map((id) => localizedPersonas.find((persona) => matchPersonaId(persona, id)))
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
    .map((id) => localizedPersonas.find((persona) => matchPersonaId(persona, id)))
    .filter(Boolean);

  assert.equal(seated2.length, 2);
  assert.equal(seated2[0].name, 'Bot 1');
  assert.equal(seated2[1].name, 'Bot 2');

  // Case 3: Button enablement check (only disabled while isDeliberating)
  const isConclusionDisabled = (isDeliberating) => isDeliberating;
  assert.equal(isConclusionDisabled(true), true); // Deliberating -> disabled
  assert.equal(isConclusionDisabled(false), false); // Ready -> enabled
});

test('pickConclusionAnalyst selects one AI from the room whose provider key is connected', () => {
  const seated = [
    {
      id: 'bot:alpha',
      name: 'Alpha Bot',
      archetype: 'Alpha',
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      colorToken: 'persona-sage',
      colorHex: '#7C9885',
      stance: 'Critical thinker',
      instructions: 'Analyze risks',
      sampleQuote: '',
    },
    {
      id: 'bot:beta',
      name: 'Beta Bot',
      archetype: 'Beta',
      model: 'gpt-4o',
      provider: 'openai',
      colorToken: 'persona-rose',
      colorHex: '#B98389',
      stance: 'Builder',
      instructions: 'Focus on execution',
      sampleQuote: '',
    },
  ];

  const apiKeys = [
    { provider: 'anthropic', modelName: 'claude-sonnet-4-5', connected: false },
    { provider: 'openai', modelName: 'gpt-4o-mini', connected: true },
  ];
  const keys = { openai: 'sk-test-openai' };

  const picked = pickConclusionAnalyst(seated, apiKeys, keys);
  assert.equal(picked.analyst.id, 'bot:beta');
  assert.equal(picked.apiKey, 'sk-test-openai');
  assert.equal(picked.model, 'gpt-4o');
});

test('analyzeChatRoomConclusion uses one AI to analyze all chat messages into Good / Normal / Bad scenarios', async () => {
  const seated = [
    {
      id: 'bot:alpha',
      name: 'Alpha Bot',
      archetype: 'Alpha',
      model: 'gpt-4o',
      provider: 'openai',
      colorToken: 'persona-sage',
      colorHex: '#7C9885',
      stance: 'Chiến lược gia',
      instructions: 'Phân tích chiến lược',
      sampleQuote: '',
    },
    {
      id: 'bot:beta',
      name: 'Beta Bot',
      archetype: 'Beta',
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      colorToken: 'persona-rose',
      colorHex: '#B98389',
      stance: 'Kỹ sư hệ thống',
      instructions: 'Đánh giá kỹ thuật',
      sampleQuote: '',
    },
  ];

  const messages = [
    { id: 'm1', authorId: 'user', body: 'Chúng ta có nên chuyển sang kiến trúc microservices không?' },
    { id: 'm2', authorId: 'bot:alpha', body: 'Chỉ nên tách dần các module có tải cao để tránh đội chi phí vận hành.' },
    { id: 'm3', authorId: 'bot:beta', body: 'Cần hoàn thiện CI/CD và observability trước khi tách dịch vụ.' },
    { id: 'm4', authorId: 'user', body: 'Nếu team chỉ có 4 người thì sao?' },
    { id: 'm5', authorId: 'bot:alpha', body: 'Với 4 người, modular monolith là lựa chọn an toàn nhất hiện tại.' },
  ];

  const extracted = extractChatTranscriptAndContributions(messages, seated, seated, 'vi');
  assert.equal(extracted.contributions.length, 2);
  assert.ok(extracted.contributions[0].text.includes('modular monolith'));
  assert.ok(extracted.transcript.includes('[Alpha Bot]:'));
  assert.ok(extracted.transcript.includes('[Beta Bot]:'));

  let callCount = 0;
  let capturedPrompt = '';

  const fakeComplete = async (_conn, req) => {
    callCount += 1;
    capturedPrompt = req.prompt;
    return JSON.stringify({
      summary: 'Team 4 người nên giữ Modular Monolith và chuẩn bị trước CI/CD.',
      dissent: 'Alpha ưu tiên giữ monolith vì quy mô nhân sự, Beta nhấn mạnh điều kiện hạ tầng.',
      recommendation: 'Giữ Modular Monolith trong 6 tháng tới và tách biên module rõ ràng.',
      scenarios: {
        good: {
          title: 'Hướng Tốt (Tích cực)',
          description: 'Tốc độ phát triển nhanh, không tốn overhead vận hành hệ thống phân tán.',
          actions: ['Định nghĩa ranh giới module rõ ràng', 'Thiết lập giám sát cơ bản'],
        },
        normal: {
          title: 'Hướng Bình thường (Cơ sở)',
          description: 'Hệ thống đáp ứng tốt tải hiện tại, đôi lúc cần tối ưu database chung.',
          actions: ['Tối ưu truy vấn định kỳ', 'Giữ quy chuẩn code review'],
        },
        bad: {
          title: 'Hướng Xấu (Rủi ro)',
          description: 'Các module bị phụ thuộc chéo nếu không kiểm soát kiến trúc.',
          actions: ['Áp dụng lint kiểm soát import giữa các module', 'Viết test tích hợp'],
        },
      },
    });
  };

  const result = await analyzeChatRoomConclusion({
    topic: 'Kiến trúc Microservices hay Monolith',
    messages,
    seated,
    allPersonas: seated,
    apiKeys: [{ provider: 'openai', modelName: 'gpt-4o', connected: true }],
    keys: { openai: 'sk-test' },
    language: 'vi',
    completeFn: fakeComplete,
  });

  // Only ONE AI call is made for the entire chat conclusion
  assert.equal(callCount, 1);
  assert.ok(capturedPrompt.includes('modular monolith'));
  assert.ok(capturedPrompt.includes('CI/CD'));

  // Scenarios (Tốt, Bình thường, Xấu) and chair synthesis are populated from the AI analysis
  assert.equal(
    result.analysis.chair.summary,
    'Team 4 người nên giữ Modular Monolith và chuẩn bị trước CI/CD.'
  );
  assert.equal(result.analysis.scenarios.good.title, 'Hướng Tốt (Tích cực)');
  assert.equal(result.analysis.scenarios.good.subtitle, 'Phân tích bởi Alpha Bot');
  assert.equal(result.analysis.scenarios.normal.title, 'Hướng Bình thường (Cơ sở)');
  assert.equal(result.analysis.scenarios.bad.title, 'Hướng Xấu (Rủi ro)');
  assert.equal(result.contributions.length, 2);
});

test('parseConclusionResponse and extractReadableSummary never leak JSON into summary on truncated or fenced responses', () => {
  const analyst = {
    id: 'bot:alpha',
    name: 'Alpha Bot',
    archetype: 'Alpha',
    model: 'gemini-2.5-flash',
    provider: 'google',
    colorToken: 'persona-sage',
    colorHex: '#7C9885',
    stance: 'Strategist',
    instructions: 'Analyze carefully',
    sampleQuote: '',
  };
  const messages = [
    { id: 'm1', authorId: 'user', body: 'Should we launch this month?' },
    { id: 'm2', authorId: 'bot:alpha', body: 'Launch a closed beta first to validate retention.' },
  ];
  const fallback = buildFallbackConclusion('Launch plan', messages, [analyst], analyst, 'vi');

  // Case 1: Truncated markdown-fenced JSON cut off mid-scenarios
  const truncatedJson = [
    '```json',
    '{',
    '  "summary": "Nên mở closed beta trước để kiểm chứng giữ chân người dùng.",',
    '  "dissent": "Cần cân bằng giữa tốc độ ra mắt và độ ổn định.",',
    '  "recommendation": "Chạy closed beta 2 tuần với 50 người dùng đầu tiên.",',
    '  "scenarios": {',
    '    "good": {',
    '      "title": "Hướng Tốt (Tích cực)",',
    '      "description": "Tỷ lệ quay lại vượt 40%, đủ tín hiệu mở rộng.",',
    '      "actions": ["Mở danh sách chờ", "Thu thập phản hồi"]',
    '    },',
    '    "normal": {',
    '      "title": "Hướng Bình thường",',
    '      "description": "Kết quả ổn định nhưng cần cải thiện onboarding',
  ].join('\n');

  const parsedTruncated = parseConclusionResponse(truncatedJson, fallback, analyst, 'vi');
  assert.equal(
    parsedTruncated.chair.summary,
    'Nên mở closed beta trước để kiểm chứng giữ chân người dùng.'
  );
  assert.equal(
    parsedTruncated.chair.dissent,
    'Cần cân bằng giữa tốc độ ra mắt và độ ổn định.'
  );
  assert.equal(
    parsedTruncated.chair.recommendation,
    'Chạy closed beta 2 tuần với 50 người dùng đầu tiên.'
  );
  assert.equal(parsedTruncated.scenarios.good.title, 'Hướng Tốt (Tích cực)');
  assert.deepEqual(parsedTruncated.scenarios.good.actions, ['Mở danh sách chờ', 'Thu thập phản hồi']);
  assert.ok(!parsedTruncated.chair.summary.includes('{'));
  assert.ok(!parsedTruncated.chair.summary.includes('```'));

  // Case 2: JSON with literal newlines inside string and trailing comma
  const messyJson = `{
    "summary": "Dòng một.
Dòng hai.",
    "dissent": "Ý kiến khác biệt.",
    "recommendation": "Thử nghiệm nhỏ.",
  }`;
  const parsedMessy = parseConclusionResponse(messyJson, fallback, analyst, 'vi');
  assert.equal(parsedMessy.chair.summary, 'Dòng một.\nDòng hai.');
  assert.equal(parsedMessy.chair.dissent, 'Ý kiến khác biệt.');

  // Case 3: Double-encoded JSON inside summary
  const doubleEncoded = JSON.stringify({
    summary: JSON.stringify({ summary: 'Tóm tắt đã giải nén' }),
  });
  assert.equal(extractReadableSummary(doubleEncoded, 'fallback'), 'Tóm tắt đã giải nén');

  // Case 4: Unparseable JSON without a summary field falls back cleanly without leaking JSON
  const brokenNoSummary = '```json\n{\n  "scenarios": { "good": ';
  const parsedBroken = parseConclusionResponse(brokenNoSummary, fallback, analyst, 'vi');
  assert.equal(parsedBroken.chair.summary, fallback.chair.summary);
  assert.ok(!parsedBroken.chair.summary.trim().startsWith('{'));
  assert.ok(!parsedBroken.chair.summary.includes('```'));
});
