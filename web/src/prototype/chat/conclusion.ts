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
const CONCLUSION_LOCALIZED = {
  en: {
    analystName: 'AI Analyst',
    analystArchetype: 'Analyst',
    userLabel: 'User',
    analyzedBy: (name: string) => `Analyzed by ${name}`,
    goodTitle: (fallback: string) => fallback,
    normalTitle: (fallback: string) => fallback,
    badTitle: (fallback: string) => fallback,
    singleSummary: (speaker: string, topic: string, body: string) =>
      `Synthesis from ${speaker} on "${topic}": ${body}`,
    multiSummary: (count: number, topic: string, body: string) =>
      `Synthesis of ${count} chat responses on "${topic}": ${body}`,
    multiDissent: (speakers: string, body: string) =>
      `Contrasting perspectives across ${speakers}: ${body}`,
    goodDesc: (body: string) => `Favorable outcome based on the chat discussion: ${body}`,
    normalDesc: (body: string) => `Baseline trajectory synthesized from the conversation: ${body}`,
    badDesc: (body: string) => `Risks and downside considerations raised in the chat: ${body}`,
  },
  vi: {
    analystName: 'Chuyên gia Phân tích AI',
    analystArchetype: 'Phân tích',
    userLabel: 'Người dùng',
    analyzedBy: (name: string) => `Phân tích bởi ${name}`,
    goodTitle: () => 'Hướng Tốt (Tích cực)',
    normalTitle: () => 'Hướng Bình thường (Cơ sở)',
    badTitle: () => 'Hướng Xấu (Rủi ro)',
    singleSummary: (speaker: string, topic: string, body: string) =>
      `Tổng hợp từ ${speaker} về "${topic}": ${body}`,
    multiSummary: (count: number, topic: string, body: string) =>
      `Tổng hợp ${count} câu trả lời trong đoạn chat về "${topic}": ${body}`,
    multiDissent: (speakers: string, body: string) =>
      `Các góc nhìn bổ sung trong đoạn chat giữa ${speakers}: ${body}`,
    goodDesc: (body: string) =>
      `Khi các điều kiện thuận lợi theo phân tích từ cuộc trò chuyện: ${body}`,
    normalDesc: (body: string) =>
      `Diễn biến thực tế ở mức cơ sở dựa trên các ý kiến trong phòng chat: ${body}`,
    badDesc: (body: string) =>
      `Các rủi ro và trở ngại cần phòng ngừa từ cuộc thảo luận: ${body}`,
  },
} as const;

export const pickConclusionAnalyst = (
  seated: AdvisorPersona[],
  apiKeys: ApiKeyConfig[],
  keys: Record<string, string>,
  language: Language = 'en'
): {
  analyst: AdvisorPersona;
  keyMeta: ApiKeyConfig | undefined;
  apiKey: string | undefined;
  model: string;
} => {
  const loc = CONCLUSION_LOCALIZED[language];
  const fallbackAdvisor: AdvisorPersona = seated[0] ?? {
    id: 'analyst',
    name: loc.analystName,
    archetype: loc.analystArchetype,
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
  const userLabel = CONCLUSION_LOCALIZED[language].userLabel;
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
  CONCLUSION_LOCALIZED[language].analyzedBy(analyst.name);

export const buildFallbackConclusion = (
  topic: string,
  messages: ChatMessage[],
  seated: AdvisorPersona[],
  analyst: AdvisorPersona,
  language: Language
): ConclusionAnalysis => {
  const t = copy[language];
  const loc = CONCLUSION_LOCALIZED[language];
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
          title: loc.goodTitle(t.favorableTitle),
          subtitle,
          description: t.favorableDescription,
          actions: [t.favorableActionOne, t.favorableActionTwo],
        },
        normal: {
          title: loc.normalTitle(t.baselineTitle),
          subtitle,
          description: t.baselineDescription,
          actions: [t.baselineActionOne, t.baselineActionTwo],
        },
        bad: {
          title: loc.badTitle(t.difficultTitle),
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

  const summaryText =
    advisorMessages.length === 1
      ? loc.singleSummary(speakerOf(advisorMessages[0].authorId), topic, clip(firstAnswer, 320))
      : loc.multiSummary(advisorMessages.length, topic, clip(points.slice(0, 3).join(' | '), 380));

  const dissentText =
    advisorMessages.length > 1
      ? loc.multiDissent(
          Array.from(new Set(advisorMessages.map((m) => speakerOf(m.authorId)))).join(', '),
          clip(lastAnswer, 240)
        )
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
        title: loc.goodTitle(t.favorableTitle),
        subtitle,
        description: loc.goodDesc(clip(firstAnswer, 240)),
        actions: [t.favorableActionOne, t.favorableActionTwo],
      },
      normal: {
        title: loc.normalTitle(t.baselineTitle),
        subtitle,
        description: loc.normalDesc(clip(middleAnswer, 240)),
        actions: [t.baselineActionOne, t.baselineActionTwo],
      },
      bad: {
        title: loc.badTitle(t.difficultTitle),
        subtitle,
        description: loc.badDesc(clip(lastAnswer, 240)),
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

const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  const closed = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (closed) return closed[1].trim();
  const opened = trimmed.match(/```(?:json)?\s*([\s\S]*)$/i);
  if (opened) return opened[1].trim();
  return trimmed;
};

const looksLikeJsonPayload = (text: string): boolean => {
  const stripped = stripCodeFences(text);
  if (/^\s*[\[{]/.test(stripped)) return true;
  return /"(?:summary|dissent|recommendation|scenarios)"\s*:/.test(stripped);
};

const sanitizeJsonText = (input: string): string => {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let nextIdx = i + 1;
      while (nextIdx < input.length && /\s/.test(input[nextIdx])) nextIdx += 1;
      if (input[nextIdx] === '}' || input[nextIdx] === ']') continue;
    }
    out += ch;
  }
  return out;
};

const readJsonStringToken = (
  text: string,
  quoteIndex: number
): { value: string; nextIndex: number; closed: boolean } => {
  let out = '';
  let i = quoteIndex + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      return { value: out, nextIndex: i + 1, closed: true };
    }
    if (ch === '\\') {
      if (i + 1 >= text.length) break;
      const esc = text[i + 1];
      switch (esc) {
        case 'n':
          out += '\n';
          i += 2;
          break;
        case 'r':
          out += '\r';
          i += 2;
          break;
        case 't':
          out += '\t';
          i += 2;
          break;
        case 'b':
          out += '\b';
          i += 2;
          break;
        case 'f':
          out += '\f';
          i += 2;
          break;
        case '"':
          out += '"';
          i += 2;
          break;
        case '\\':
          out += '\\';
          i += 2;
          break;
        case '/':
          out += '/';
          i += 2;
          break;
        case 'u': {
          const hex = text.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            i = text.length;
          }
          break;
        }
        default:
          out += esc;
          i += 2;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return { value: out, nextIndex: text.length, closed: false };
};

const jsonObjectSlice = (raw: string): string => {
  const stripped = stripCodeFences(raw);
  const firstBrace = stripped.indexOf('{');
  return firstBrace === -1 ? stripped : stripped.slice(firstBrace);
};

const findJsonPropertyValueStart = (
  jsonSlice: string,
  key: string,
  targetDepth?: number
): number => {
  let depth = 0;
  let i = 0;
  while (i < jsonSlice.length) {
    const ch = jsonSlice[i];
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
    } else if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      i += 1;
    } else if (ch === '"') {
      const decoded = readJsonStringToken(jsonSlice, i);
      i = decoded.nextIndex;
      if (
        decoded.closed &&
        decoded.value === key &&
        (targetDepth === undefined || depth === targetDepth)
      ) {
        let j = i;
        while (j < jsonSlice.length && /\s/.test(jsonSlice[j])) j += 1;
        if (jsonSlice[j] === ':') {
          j += 1;
          while (j < jsonSlice.length && /\s/.test(jsonSlice[j])) j += 1;
          return j;
        }
      }
    } else {
      i += 1;
    }
  }
  return -1;
};

const extractJsonStringField = (
  jsonSlice: string,
  key: string,
  targetDepth?: number
): string | null => {
  const valStart = findJsonPropertyValueStart(jsonSlice, key, targetDepth);
  if (valStart === -1 || jsonSlice[valStart] !== '"') return null;
  const { value } = readJsonStringToken(jsonSlice, valStart);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractJsonStringArrayField = (
  jsonSlice: string,
  key: string,
  targetDepth?: number
): string[] | null => {
  const valStart = findJsonPropertyValueStart(jsonSlice, key, targetDepth);
  if (valStart === -1 || jsonSlice[valStart] !== '[') return null;
  const items: string[] = [];
  let i = valStart + 1;
  while (i < jsonSlice.length) {
    const ch = jsonSlice[i];
    if (ch === ']') break;
    if (ch === '"') {
      const token = readJsonStringToken(jsonSlice, i);
      const item = token.value.trim();
      if (item.length > 0) items.push(item);
      i = token.nextIndex;
    } else {
      i += 1;
    }
  }
  return items.length > 0 ? items : null;
};

const tryParseLenientJson = (raw: string): Record<string, unknown> | null => {
  const stripped = stripCodeFences(raw);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;

  const candidate = stripped.slice(firstBrace, lastBrace + 1);
  for (const text of [candidate, sanitizeJsonText(candidate)]) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try next strategy
    }
  }
  return null;
};

/**
 * Ensures the summary shown in SessionConcludedView is plain readable text,
 * unwrapping JSON/fenced-JSON payloads (including truncated AI JSON outputs)
 * and never leaking raw JSON markup into the summary card.
 */
export const extractReadableSummary = (
  raw: unknown,
  fallbackSummary = ''
): string => {
  let current = typeof raw === 'string' ? raw.trim() : '';
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current) return fallbackSummary;
    if (!looksLikeJsonPayload(current)) return current;

    const parsed = tryParseLenientJson(current);
    if (parsed && typeof parsed.summary === 'string' && parsed.summary.trim().length > 0) {
      current = parsed.summary.trim();
      continue;
    }

    const slice = jsonObjectSlice(current);
    const extracted =
      extractJsonStringField(slice, 'summary', 1) ??
      extractJsonStringField(slice, 'summary');
    if (extracted) {
      current = extracted;
      continue;
    }

    return fallbackSummary;
  }
  return looksLikeJsonPayload(current) ? fallbackSummary : current;
};

const sanitizePlainField = (val: unknown, fallback: string): string => {
  const cleaned = cleanString(val, fallback);
  return looksLikeJsonPayload(cleaned) ? fallback : cleaned;
};

const extractPartialBranch = (
  jsonSlice: string,
  branchKey: 'good' | 'normal' | 'bad',
  subtitle: string,
  fbBranch: ScenarioBranch
): ScenarioBranch => {
  const start = findJsonPropertyValueStart(jsonSlice, branchKey, 2);
  if (start === -1 || jsonSlice[start] !== '{') {
    return { ...fbBranch, subtitle };
  }
  const branchSlice = jsonSlice.slice(start);
  return {
    title: extractJsonStringField(branchSlice, 'title', 1) ?? fbBranch.title,
    subtitle,
    description:
      extractJsonStringField(branchSlice, 'description', 1) ?? fbBranch.description,
    actions: extractJsonStringArrayField(branchSlice, 'actions', 1) ?? fbBranch.actions,
  };
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
  const parsed = tryParseLenientJson(trimmed);

  if (parsed) {
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
        summary: extractReadableSummary(parsed.summary, fallback.chair.summary),
        dissent: sanitizePlainField(parsed.dissent, fallback.chair.dissent),
        recommendation: sanitizePlainField(
          parsed.recommendation,
          fallback.chair.recommendation
        ),
      },
      scenarios: {
        good: parseBranch(rawScenarios.good, fallback.scenarios.good),
        normal: parseBranch(rawScenarios.normal, fallback.scenarios.normal),
        bad: parseBranch(rawScenarios.bad, fallback.scenarios.bad),
      },
    };
  }

  if (looksLikeJsonPayload(trimmed)) {
    const slice = jsonObjectSlice(trimmed);
    const extractedDissent =
      extractJsonStringField(slice, 'dissent', 1) ?? fallback.chair.dissent;
    const extractedRecommendation =
      extractJsonStringField(slice, 'recommendation', 1) ??
      fallback.chair.recommendation;

    return {
      analyst,
      chair: {
        summary: extractReadableSummary(trimmed, fallback.chair.summary),
        dissent: sanitizePlainField(extractedDissent, fallback.chair.dissent),
        recommendation: sanitizePlainField(
          extractedRecommendation,
          fallback.chair.recommendation
        ),
      },
      scenarios: {
        good: extractPartialBranch(slice, 'good', subtitle, fallback.scenarios.good),
        normal: extractPartialBranch(slice, 'normal', subtitle, fallback.scenarios.normal),
        bad: extractPartialBranch(slice, 'bad', subtitle, fallback.scenarios.bad),
      },
    };
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

  const { analyst, keyMeta, apiKey, model } = pickConclusionAnalyst(seated, apiKeys, keys, language);
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
          maxTokens: 3000,
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
