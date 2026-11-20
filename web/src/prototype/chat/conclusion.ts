import { USER_HANDLE, type ChatMessage } from './engine.ts';
import { completeByokText } from './byok.ts';
import { copy } from '../i18n.ts';
import type {
  AdvisorPersona,
  ApiKeyConfig,
  Language,
  ScenarioBranch,
} from '../types.ts';
import type { Contribution } from '../../lib/deliberation/engine.ts';

export interface ConclusionAnalysis {
  analyst: AdvisorPersona;
  chair: {
    summary: string;
    dissent: string;
    recommendation: string;
  };
  scenarios: {
    good: ScenarioBranch;
    normal: ScenarioBranch;
    bad: ScenarioBranch;
  };
}

export const matchPersonaId = (persona: { id: string }, targetId: string): boolean => {
  if (persona.id === targetId) return true;
  const strip = (s: string) => (s.startsWith('bot:') ? s.slice(4) : s);
  return strip(persona.id) === strip(targetId);
};

/**
 * Picks ONE AI from the seated room roster to analyze the entire chat conversation.
 * Prefers an advisor in the room whose provider key is connected; falls back to the
 * first seated advisor using any connected provider key, or offline mode if none is connected.
 */
export const pickConclusionAnalyst = (
  seated: AdvisorPersona[],
  apiKeys: ApiKeyConfig[],
  keys: Record<string, string>
): {
  analyst: AdvisorPersona;
  keyMeta: ApiKeyConfig | undefined;
  apiKey: string | undefined;
  model: string;
} => {
  const fallbackAdvisor: AdvisorPersona = seated[0] ?? {
    id: 'analyst',
    name: 'AI Analyst',
    archetype: 'Analyst',
    model: 'gpt-4o-mini',
    provider: 'openai',
    colorToken: 'persona-sage',
    colorHex: '#7C9885',
    stance: '',
    instructions: '',
    sampleQuote: '',
  };

  for (const persona of seated) {
    const directKey = apiKeys.find(
      (item) => item.provider === persona.provider && item.connected && Boolean(keys[item.provider])
    );
    if (directKey) {
      return {
        analyst: persona,
        keyMeta: directKey,
        apiKey: keys[directKey.provider],
        model: persona.model || directKey.modelName,
      };
    }
  }

  const anyConnected = apiKeys.find((item) => item.connected && Boolean(keys[item.provider]));
  return {
    analyst: fallbackAdvisor,
    keyMeta: anyConnected,
    apiKey: anyConnected ? keys[anyConnected.provider] : undefined,
    model: anyConnected?.modelName || fallbackAdvisor.model,
  };
};

export const extractChatTranscriptAndContributions = (
  messages: ChatMessage[],
  seated: AdvisorPersona[],
  allPersonas: AdvisorPersona[],
  language: Language
): {
  transcript: string;
  userMessages: ChatMessage[];
  advisorMessages: ChatMessage[];
  contributions: Contribution[];
} => {
  const userLabel = language === 'vi' ? 'Người dùng' : 'User';
  const speakerName = (authorId: string): string => {
    if (authorId === USER_HANDLE) return userLabel;
    const found =
      seated.find((p) => matchPersonaId(p, authorId)) ??
      allPersonas.find((p) => matchPersonaId(p, authorId));
    return found?.name ?? authorId;
  };

  const nonEmpty = messages.filter((m) => typeof m.body === 'string' && m.body.trim().length > 0);
  const userMessages = nonEmpty.filter((m) => m.authorId === USER_HANDLE);
  const advisorMessages = nonEmpty.filter((m) => m.authorId !== USER_HANDLE);

  const transcript = nonEmpty
    .map((m) => `[${speakerName(m.authorId)}]: ${m.body.trim()}`)
    .join('\n\n');

  const contributions: Contribution[] = [];
  const handledMsgIds = new Set<string>();

  for (const advisor of seated) {
    const spoken = advisorMessages.filter((m) => matchPersonaId(advisor, m.authorId));
    if (spoken.length > 0) {
      for (const m of spoken) handledMsgIds.add(m.id);
      contributions.push({
        advisorId: advisor.id,
        text: spoken.map((m) => m.body.trim()).join('\n\n'),
        rebuts: null,
        buildsOn: null,
      });
    }
  }

  // Include any remaining advisor messages from speakers outside current seated list
  const remainingByAuthor = new Map<string, string[]>();
  for (const m of advisorMessages) {
    if (handledMsgIds.has(m.id)) continue;
    const list = remainingByAuthor.get(m.authorId) ?? [];
    list.push(m.body.trim());
    remainingByAuthor.set(m.authorId, list);
  }
  for (const [authorId, bodies] of remainingByAuthor.entries()) {
    contributions.push({
      advisorId: authorId,
      text: bodies.join('\n\n'),
      rebuts: null,
      buildsOn: null,
    });
  }

  return { transcript, userMessages, advisorMessages, contributions };
};

export const analystSubtitle = (analyst: AdvisorPersona, language: Language): string =>
  language === 'vi' ? `Phân tích bởi ${analyst.name}` : `Analyzed by ${analyst.name}`;

export const buildFallbackConclusion = (
  topic: string,
  messages: ChatMessage[],
  seated: AdvisorPersona[],
  analyst: AdvisorPersona,
  language: Language
): ConclusionAnalysis => {
  const t = copy[language];
  const { advisorMessages } = extractChatTranscriptAndContributions(
    messages,
    seated,
    seated,
    language
  );
  const subtitle = analystSubtitle(analyst, language);

  if (advisorMessages.length === 0) {
    return {
      analyst,
      chair: {
        summary: t.chairSummary,
        dissent: t.chairDissent,
        recommendation: t.chairRecommendation,
      },
      scenarios: {
        good: {
          title: language === 'vi' ? 'Hướng Tốt (Tích cực)' : t.favorableTitle,
          subtitle,
          description: t.favorableDescription,
          actions: [t.favorableActionOne, t.favorableActionTwo],
        },
        normal: {
          title: language === 'vi' ? 'Hướng Bình thường (Cơ sở)' : t.baselineTitle,
          subtitle,
          description: t.baselineDescription,
          actions: [t.baselineActionOne, t.baselineActionTwo],
        },
        bad: {
          title: language === 'vi' ? 'Hướng Xấu (Rủi ro)' : t.difficultTitle,
          subtitle,
          description: t.difficultDescription,
          actions: [t.difficultActionOne, t.difficultActionTwo],
        },
      },
    };
  }

  const speakerOf = (authorId: string) =>
    seated.find((p) => matchPersonaId(p, authorId))?.name ?? authorId;

  const points = advisorMessages.map((m) => `${speakerOf(m.authorId)}: ${m.body.trim()}`);
  const firstAnswer = advisorMessages[0]?.body.trim() ?? '';
  const lastAnswer = advisorMessages[advisorMessages.length - 1]?.body.trim() ?? firstAnswer;
  const middleAnswer =
    advisorMessages[Math.floor(advisorMessages.length / 2)]?.body.trim() ?? firstAnswer;

  const clip = (text: string, max = 280) =>
    text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;

  if (language === 'vi') {
    const summaryText =
      advisorMessages.length === 1
        ? `Tổng hợp từ ${speakerOf(advisorMessages[0].authorId)} về "${topic}": ${clip(firstAnswer, 320)}`
        : `Tổng hợp ${advisorMessages.length} câu trả lời trong đoạn chat về "${topic}": ${clip(
            points.slice(0, 3).join(' | '),
            380
          )}`;
    const dissentText =
      advisorMessages.length > 1
        ? `Các góc nhìn bổ sung trong đoạn chat giữa ${Array.from(
            new Set(advisorMessages.map((m) => speakerOf(m.authorId)))
          ).join(', ')}: ${clip(lastAnswer, 240)}`
        : t.chairDissent;

    return {
      analyst,
      chair: {
        summary: summaryText,
        dissent: dissentText,
        recommendation: t.chairRecommendation,
      },
      scenarios: {
        good: {
          title: 'Hướng Tốt (Tích cực)',
          subtitle,
          description: `Khi các điều kiện thuận lợi theo phân tích từ cuộc trò chuyện: ${clip(firstAnswer, 240)}`,
          actions: [t.favorableActionOne, t.favorableActionTwo],
        },
        normal: {
          title: 'Hướng Bình thường (Cơ sở)',
          subtitle,
          description: `Diễn biến thực tế ở mức cơ sở dựa trên các ý kiến trong phòng chat: ${clip(middleAnswer, 240)}`,
          actions: [t.baselineActionOne, t.baselineActionTwo],
        },
        bad: {
          title: 'Hướng Xấu (Rủi ro)',
          subtitle,
          description: `Các rủi ro và trở ngại cần phòng ngừa từ cuộc thảo luận: ${clip(lastAnswer, 240)}`,
          actions: [t.difficultActionOne, t.difficultActionTwo],
        },
      },
    };
  }

  const summaryText =
    advisorMessages.length === 1
      ? `Synthesis from ${speakerOf(advisorMessages[0].authorId)} on "${topic}": ${clip(firstAnswer, 320)}`
      : `Synthesis of ${advisorMessages.length} chat responses on "${topic}": ${clip(
          points.slice(0, 3).join(' | '),
          380
        )}`;
  const dissentText =
    advisorMessages.length > 1
      ? `Contrasting perspectives across ${Array.from(
          new Set(advisorMessages.map((m) => speakerOf(m.authorId)))
        ).join(', ')}: ${clip(lastAnswer, 240)}`
      : t.chairDissent;

  return {
    analyst,
    chair: {
      summary: summaryText,
      dissent: dissentText,
      recommendation: t.chairRecommendation,
    },
    scenarios: {
      good: {
        title: t.favorableTitle,
        subtitle,
        description: `Favorable outcome based on the chat discussion: ${clip(firstAnswer, 240)}`,
        actions: [t.favorableActionOne, t.favorableActionTwo],
      },
      normal: {
        title: t.baselineTitle,
        subtitle,
        description: `Baseline trajectory synthesized from the conversation: ${clip(middleAnswer, 240)}`,
        actions: [t.baselineActionOne, t.baselineActionTwo],
      },
      bad: {
        title: t.difficultTitle,
        subtitle,
        description: `Risks and downside considerations raised in the chat: ${clip(lastAnswer, 240)}`,
        actions: [t.difficultActionOne, t.difficultActionTwo],
      },
    },
  };
};

export const buildConclusionPrompt = (
  topic: string,
  transcript: string,
  analyst: AdvisorPersona,
  language: Language
): { system: string; prompt: string } => {
  const personaHint = analyst.instructions || analyst.stance;
  if (language === 'vi') {
    const system = [
      `Bạn là ${analyst.name}${personaHint ? ` (${personaHint})` : ''}.`,
      'Nhiệm vụ của bạn là đọc toàn bộ đoạn hội thoại trong phòng chat và phân tích tất cả các câu trả lời để đưa ra kết luận tổng hợp cùng phân tích theo 3 hướng: Tốt (Good), Bình thường (Normal), và Xấu (Bad).',
      'Trả về DUY NHẤT một JSON object hợp lệ theo đúng cấu trúc yêu cầu, không kèm markdown hay lời dẫn bên ngoài JSON.',
    ].join(' ');

    const prompt = [
      `Chủ đề phòng chat: "${topic}"`,
      '',
      'Toàn bộ nội dung đoạn chat:',
      transcript || `(Chưa có tin nhắn chi tiết, hãy phân tích chủ đề: "${topic}")`,
      '',
      'Hãy phân tích toàn bộ các câu trả lời trong đoạn chat trên và trả về JSON theo cấu trúc sau (bằng Tiếng Việt):',
      '{',
      '  "summary": "Tóm tắt cốt lõi và kết luận chung từ toàn bộ các câu trả lời trong đoạn chat (2-4 câu)",',
      '  "dissent": "Điểm khác biệt, phản biện hoặc góc nhìn đáng lưu ý giữa các câu trả lời (1-2 câu)",',
      '  "recommendation": "Khuyến nghị bước tiếp theo cụ thể và thiết thực nhất (1-3 câu)",',
      '  "scenarios": {',
      '    "good": {',
      '      "title": "Hướng Tốt (Tích cực)",',
      '      "description": "Phân tích kịch bản theo hướng Tốt dựa trên các câu trả lời trong đoạn chat",',
      '      "actions": ["Hành động cụ thể 1", "Hành động cụ thể 2"]',
      '    },',
      '    "normal": {',
      '      "title": "Hướng Bình thường (Cơ sở)",',
      '      "description": "Phân tích kịch bản theo hướng Bình thường / thực tế nhất dựa trên đoạn chat",',
      '      "actions": ["Hành động cụ thể 1", "Hành động cụ thể 2"]',
      '    },',
      '    "bad": {',
      '      "title": "Hướng Xấu (Rủi ro)",',
      '      "description": "Phân tích kịch bản theo hướng Xấu / rủi ro cần lường trước dựa trên đoạn chat",',
      '      "actions": ["Hành động phòng ngừa 1", "Hành động ứng phó 2"]',
      '    }',
      '  }',
      '}',
    ].join('\n');

    return { system, prompt };
  }

  const system = [
    `You are ${analyst.name}${personaHint ? ` (${personaHint})` : ''}.`,
    'Your task is to read the entire chat conversation and analyze all answers to produce a synthesized conclusion along with a 3-way scenario analysis: Good, Normal (Baseline), and Bad (Downside).',
    'Return ONLY a valid JSON object matching the requested schema, with no extra prose outside the JSON.',
  ].join(' ');

  const prompt = [
    `Chat topic: "${topic}"`,
    '',
    'Full chat transcript:',
    transcript || `(No messages yet; analyze the topic: "${topic}")`,
    '',
    'Analyze all answers in the chat transcript above and return JSON with this exact shape (in English):',
    '{',
    '  "summary": "Core synthesis and conclusion from all answers in the chat (2-4 sentences)",',
    '  "dissent": "Key differences, trade-offs, or counterpoints raised across the answers (1-2 sentences)",',
    '  "recommendation": "Concrete recommended next step based on the chat (1-3 sentences)",',
    '  "scenarios": {',
    '    "good": {',
    '      "title": "Good Scenario (Favorable)",',
    '      "description": "Analysis of the Good / favorable trajectory based on the chat answers",',
    '      "actions": ["Concrete action 1", "Concrete action 2"]',
    '    },',
    '    "normal": {',
    '      "title": "Normal Scenario (Baseline)",',
    '      "description": "Analysis of the Normal / baseline trajectory based on the chat answers",',
    '      "actions": ["Concrete action 1", "Concrete action 2"]',
    '    },',
    '    "bad": {',
    '      "title": "Bad Scenario (Risk / Downside)",',
    '      "description": "Analysis of the Bad / risk trajectory and pitfalls based on the chat answers",',
    '      "actions": ["Mitigation action 1", "Contingency action 2"]',
    '    }',
    '  }',
    '}',
  ].join('\n');

  return { system, prompt };
};

const cleanString = (val: unknown, fallback: string): string =>
  typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;

const cleanActions = (val: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(val)) return fallback;
  const items = val
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : fallback;
};

export const parseConclusionResponse = (
  rawText: string,
  fallback: ConclusionAnalysis,
  analyst: AdvisorPersona,
  language: Language
): ConclusionAnalysis => {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed) return fallback;

  const subtitle = analystSubtitle(analyst, language);
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
      const rawScenarios =
        parsed.scenarios && typeof parsed.scenarios === 'object'
          ? (parsed.scenarios as Record<string, unknown>)
          : {};

      const parseBranch = (
        rawBranch: unknown,
        fbBranch: ScenarioBranch
      ): ScenarioBranch => {
        const b =
          rawBranch && typeof rawBranch === 'object'
            ? (rawBranch as Record<string, unknown>)
            : {};
        return {
          title: cleanString(b.title, fbBranch.title),
          subtitle,
          description: cleanString(b.description, fbBranch.description),
          actions: cleanActions(b.actions, fbBranch.actions),
        };
      };

      return {
        analyst,
        chair: {
          summary: cleanString(parsed.summary, fallback.chair.summary),
          dissent: cleanString(parsed.dissent, fallback.chair.dissent),
          recommendation: cleanString(parsed.recommendation, fallback.chair.recommendation),
        },
        scenarios: {
          good: parseBranch(rawScenarios.good, fallback.scenarios.good),
          normal: parseBranch(rawScenarios.normal, fallback.scenarios.normal),
          bad: parseBranch(rawScenarios.bad, fallback.scenarios.bad),
        },
      };
    } catch {
      // Fall through to plain-text handling
    }
  }

  // If the AI returned plain text rather than JSON, use it as the summary
  return {
    ...fallback,
    analyst,
    chair: {
      ...fallback.chair,
      summary: trimmed,
    },
  };
};

export const analyzeChatRoomConclusion = async (params: {
  topic: string;
  messages: ChatMessage[];
  seated: AdvisorPersona[];
  allPersonas: AdvisorPersona[];
  apiKeys: ApiKeyConfig[];
  keys: Record<string, string>;
  language: Language;
  signal?: AbortSignal;
  completeFn?: typeof completeByokText;
}): Promise<{
  analysis: ConclusionAnalysis;
  contributions: Contribution[];
}> => {
  const {
    topic,
    messages,
    seated,
    allPersonas,
    apiKeys,
    keys,
    language,
    signal,
    completeFn = completeByokText,
  } = params;

  const { analyst, keyMeta, apiKey, model } = pickConclusionAnalyst(seated, apiKeys, keys);
  const { transcript, contributions } = extractChatTranscriptAndContributions(
    messages,
    seated,
    allPersonas,
    language
  );
  const fallback = buildFallbackConclusion(topic, messages, seated, analyst, language);

  let analysis = fallback;

  if (keyMeta && apiKey) {
    try {
      const { system, prompt } = buildConclusionPrompt(topic, transcript, analyst, language);
      const rawText = await completeFn(
        {
          provider: keyMeta.provider,
          model,
          apiKey,
          protocol: keyMeta.protocol,
          baseUrl: keyMeta.baseUrl,
        },
        {
          system,
          prompt,
          signal,
        }
      );
      analysis = parseConclusionResponse(rawText, fallback, analyst, language);
    } catch (err) {
      console.warn('[conclusion] single-AI chat analysis failed, using transcript fallback:', err);
      analysis = fallback;
    }
  }

  const finalContributions: Contribution[] =
    contributions.length > 0
      ? contributions
      : [
          {
            advisorId: analyst.id,
            text: analysis.chair.summary,
            rebuts: null,
            buildsOn: null,
          },
        ];

  return {
    analysis,
    contributions: finalContributions,
  };
};
