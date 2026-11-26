/**
 * Transcript normalization, multimodal attachment extraction, and A2A handoff target resolution
 * for Anthropic, OpenAI-compatible, and Google Gemini wire formats.
 */

import { splitDataUrl } from '../read-image-web.ts';
import {
  RESUME_ALL,
  USER_HANDLE,
  aliasTable,
  findMentions,
  type ChatBot,
  type ChatTurnRequest,
} from '../engine.ts';

/** Tool schema offered during multi-agent group turns so bots can pass the floor cleanly. */
export const HANDOFF_TOOL = {
  name: 'message_agent',
  description:
    'Hand the conversational floor to another bot in this group chat. Call this at the end of your reply. ' +
    'Pass "user" to return the conversation to the human instead of another bot. ' +
    'Pass "all" to invite every bot currently held out of the group.',
  input_schema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Display name of the bot to speak next, or "user", or "all".',
      },
    },
    required: ['target'],
  },
} as const;

/** Resolves a raw handoff target string from a tool call into valid roster bot IDs or `user`. */
export const resolveTarget = (raw: string, roster: ChatBot[]): string[] => {
  const wanted = raw.replace(/^@/, '').trim();
  if (!wanted) return [];
  if (/^(user|you)$/i.test(wanted)) return [USER_HANDLE];
  if (/^(all|everyone)$/i.test(wanted)) return roster.map((bot) => bot.id);
  const direct = roster.find((bot) => bot.id.toLowerCase() === wanted.toLowerCase());
  if (direct) return [direct.id];
  const hit = findMentions(`@${wanted}`, aliasTable(roster)).find(
    (m) => m.id !== USER_HANDLE && m.id !== RESUME_ALL
  );
  return hit ? [hit.id] : [];
};

const imagesOf = (request: ChatTurnRequest) => {
  const rawUrls: string[] = [];
  for (const attachment of request.attachments ?? []) {
    if (attachment.problem) continue;
    if (attachment.kind === 'image' && attachment.dataUrl) {
      rawUrls.push(attachment.dataUrl);
    } else if (attachment.kind === 'video') {
      if (Array.isArray(attachment.frames) && attachment.frames.length > 0) {
        rawUrls.push(...attachment.frames);
      } else if (attachment.dataUrl) {
        rawUrls.push(attachment.dataUrl);
      }
    }
  }
  return rawUrls
    .map((url) => splitDataUrl(url))
    .filter((parts): parts is NonNullable<typeof parts> => parts !== null);
};

const speakerNameOf = (request: ChatTurnRequest, authorId: string): string => {
  const known = [
    request.bot,
    ...(request.roster ?? []),
    ...(request.handoffTargets ?? []),
    ...(request.waiting ?? []),
  ];
  return known.find((bot) => bot.id === authorId)?.name ?? authorId;
};

/**
 * Normalizes transcript history for LLM chat APIs:
 * - In group rooms, only `request.bot`'s own prior turns map to `assistant`; messages from the
 *   human and other bots map to `user` with `[Speaker Name]:` attribution.
 * - Consecutive same-role turns are merged, and the sequence always starts and ends with `user`.
 */
const toMessages = (request: ChatTurnRequest) => {
  const images = imagesOf(request);
  const lastUser = images.length
    ? request.history.map((message) => message.authorId).lastIndexOf(USER_HANDLE)
    : -1;
  const raw = request.history.map((message, index) => {
    const isSelf = message.authorId === request.bot.id;
    const isUser = message.authorId === USER_HANDLE;
    const role: 'user' | 'assistant' = request.soloMode
      ? isUser
        ? 'user'
        : 'assistant'
      : isSelf
        ? 'assistant'
        : 'user';
    const content = isUser || request.soloMode || isSelf
      ? message.body
      : `[${speakerNameOf(request, message.authorId)}]: ${message.body}`;
    return {
      role,
      content,
      images: index === lastUser ? images : [],
    };
  });

  const normalized: {
    role: 'user' | 'assistant';
    content: string;
    images: { mediaType: string; base64: string }[];
  }[] = [];
  for (const item of raw) {
    const prev = normalized.at(-1);
    if (prev && prev.role === item.role) {
      prev.content = prev.content
        ? item.content
          ? `${prev.content}\n\n${item.content}`
          : prev.content
        : item.content;
      if (item.images.length > 0) prev.images = [...prev.images, ...item.images];
    } else {
      normalized.push({ ...item });
    }
  }

  if (normalized[0]?.role === 'assistant') {
    normalized.unshift({ role: 'user', content: 'Continue the conversation.', images: [] });
  }
  if (normalized.length === 0 || normalized[normalized.length - 1]?.role === 'assistant') {
    const modeCue =
      request.mode === 'panel'
        ? `Now it is your turn, ${request.bot.name}. Give your independent answer to the human.`
        : `Now it is your turn, ${request.bot.name}. Critique and respond to the previous points.`;
    normalized.push({
      role: 'user',
      content: request.soloMode ? 'Continue.' : modeCue,
      images: [],
    });
  }

  return normalized;
};

/** Formats normalized conversation turns into Anthropic Messages API content blocks. */
export const toAnthropicMessages = (request: ChatTurnRequest) => {
  const merged: {
    role: 'user' | 'assistant';
    content:
      | string
      | (
          | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
          | { type: 'text'; text: string }
        )[];
  }[] = [];
  for (const { role, content, images } of toMessages(request)) {
    const blocks = images.length
      ? [
          ...images.map((image) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
          })),
          { type: 'text' as const, text: content },
        ]
      : content;
    const prev = merged.at(-1);
    if (prev && prev.role === role && typeof prev.content === 'string' && typeof blocks === 'string') {
      prev.content = `${prev.content}\n\n${blocks}`;
    } else {
      merged.push({ role, content: blocks });
    }
  }
  return merged;
};

/** Formats normalized conversation turns into OpenAI-compatible Chat Completions messages. */
export const toOpenAiMessages = (request: ChatTurnRequest) =>
  toMessages(request).map(({ role, content, images }) => ({
    role,
    content: images.length
      ? [
          { type: 'text' as const, text: content },
          ...images.map((image) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
          })),
        ]
      : content,
  }));

type GooglePart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** Formats normalized conversation turns into alternating `user`/`model` Gemini contents. */
export const toGoogleContents = (request: ChatTurnRequest) => {
  const merged: { role: 'user' | 'model'; parts: GooglePart[] }[] = [];
  for (const { role, content, images } of toMessages(request)) {
    const geminiRole = role === 'user' ? 'user' : 'model';
    const parts: GooglePart[] = [
      ...images.map((image) => ({
        inlineData: { mimeType: image.mediaType, data: image.base64 },
      })),
      { text: content },
    ];
    const prev = merged.at(-1);
    if (prev && prev.role === geminiRole) {
      prev.parts.push(...parts);
    } else {
      merged.push({ role: geminiRole, parts });
    }
  }
  return merged;
};
