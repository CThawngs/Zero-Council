/**
 * Analyst selection, transcript extraction, and deterministic fallback synthesis for room conclusions.
 */

import { USER_HANDLE, type ChatMessage } from '../engine.ts';
import { copy } from '../../i18n.ts';
import type { AdvisorPersona, ApiKeyConfig, Language } from '../../types.ts';
import type { Contribution } from '../../../lib/deliberation/types.ts';
import type { ConclusionAnalysis } from './types.ts';

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

/** Matches a persona ID against an author/target ID with or without a `bot:` prefix. */
export const matchPersonaId = (persona: { id: string }, targetId: string): boolean => {
  if (persona.id === targetId) return true;
  const strip = (s: string) => (s.startsWith('bot:') ? s.slice(4) : s);
  return strip(persona.id) === strip(targetId);
};

/**
 * Selects one seated advisor to act as the Chair analyst, preferring an advisor whose own provider
 * key is connected and falling back to any connected provider key.
 */
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

  const isUsable = (item: ApiKeyConfig) =>
    item.connected && (Boolean(keys[item.provider]) || Boolean(item.hasKey));

  for (const persona of seated) {
    const directKey = apiKeys.find(
      (item) => item.provider === persona.provider && isUsable(item)
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

  const anyConnected = apiKeys.find(isUsable);
  return {
    analyst: fallbackAdvisor,
    keyMeta: anyConnected,
    apiKey: anyConnected ? keys[anyConnected.provider] : undefined,
    model: anyConnected?.modelName || fallbackAdvisor.model,
  };
};

/** Builds a speaker-attributed transcript and per-advisor contribution records from room messages. */
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

/** Returns the localized "Analyzed by <Analyst>" subtitle shown on scenario cards. */
export const analystSubtitle = (analyst: AdvisorPersona, language: Language): string =>
  CONCLUSION_LOCALIZED[language].analyzedBy(analyst.name);

/** Builds a baseline fallback conclusion structure used to fill missing fields on partial JSON output. */
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
