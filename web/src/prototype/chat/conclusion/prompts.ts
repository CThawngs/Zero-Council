/**
 * Bilingual prompt builder for Chair conclusion & Good/Normal/Bad scenario synthesis.
 */

import type { AdvisorPersona, Language } from '../../types.ts';

/** Builds the system instruction and structured JSON prompt for live Chair synthesis. */
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
