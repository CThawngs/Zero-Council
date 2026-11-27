/**
 * Pure conversion helpers and server-proxied BYOK completion bridge used by `AppContext` hooks.
 */

import { useEffect, useLayoutEffect } from 'react';
import type { AdvisorPersona, DeliberationSession, Language, UserBot } from '../types';
import type { Round } from '@/lib/deliberation/types';
import { localizePersona } from '../data/catalog';
import { copy } from '../i18n';
import type { ChatBot } from '../chat/engine';
import { completeByokText } from '../chat/byok';

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const nextSessionId = (() => {
  let seq = 0;
  return () => {
    seq += 1;
    return `session-${seq}`;
  };
})();

/** Placeholder concluded session shown when no session has been synthesized yet. */
export const emptyConcludedSession = (language: Language): DeliberationSession => {
  const t = copy[language];
  const round: Round = {
    index: 1,
    mode: 'independent',
    framework: 'scenarios',
    prompt: '',
    language,
    contributions: [],
    chair: { summary: '', dissent: '', recommendation: '' },
    frameworkOutput: { kind: 'scenarios', matrix: null },
  };
  return {
    id: 'empty',
    title: '',
    summary: '',
    framework: 'Good / Normal / Bad Scenarios',
    mode: 'independent',
    timestamp: new Date(0).toISOString(),
    relativeTime: '',
    status: 'Concluded',
    advisors: [],
    rounds: [round],
    scenarios: {
      good: { title: t.favorableTitle, subtitle: '', description: '', actions: [] },
      normal: { title: t.baselineTitle, subtitle: '', description: '', actions: [] },
      bad: { title: t.difficultTitle, subtitle: '', description: '', actions: [] },
    },
  };
};

/** Maps advisor personas to minimal `{ id, name }` records for the chat turn engine. */
export const toChatBots = (roster: AdvisorPersona[]): ChatBot[] =>
  roster.map((persona) => ({ id: persona.id, name: persona.name }));

/** Prefixes a user-created bot ID for unified persona lookup (`bot:<id>`). */
export const botPersonaId = (botId: string) => `bot:${botId}`;

const BOT_COLORS: { token: AdvisorPersona['colorToken']; hex: string }[] = [
  { token: 'persona-sage', hex: '#7C9885' },
  { token: 'persona-rose', hex: '#B98389' },
  { token: 'persona-slate', hex: '#6E85A6' },
  { token: 'persona-ochre', hex: '#C2955E' },
];

/** Converts a user-created `UserBot` record into a room `AdvisorPersona`. */
export const botToPersona = (bot: UserBot, index = 0): AdvisorPersona => {
  const palette = BOT_COLORS[index % BOT_COLORS.length];
  return {
    id: botPersonaId(bot.id),
    name: bot.name,
    archetype: bot.name,
    model: bot.model,
    provider: bot.provider,
    colorToken: palette.token,
    colorHex: palette.hex,
    stance: bot.instruction.slice(0, 96),
    instructions: bot.instruction,
    sampleQuote: '',
  };
};

/** Localizes built-in advisor labels inside a saved deliberation session. */
export const localizeSession = (
  session: DeliberationSession,
  language: Language
): DeliberationSession => ({
  ...session,
  advisors: session.advisors.map((persona) => localizePersona(persona, language)),
});

/**
 * Executes a single structured synthesis/completion call using the user's connected BYOK key
 * (direct if supplied in-memory, otherwise decrypted server-side via `/api/providers/chat`).
 */
export const completeByokTextViaServer = async (
  credentials: {
    provider: string;
    model: string;
    apiKey?: string;
    protocol?: 'anthropic' | 'openai' | 'google';
    baseUrl?: string;
    botId?: string;
  },
  options: { system: string; prompt: string; maxTokens?: number; signal?: AbortSignal }
): Promise<string> => {
  if (credentials.apiKey) {
    return completeByokText({ ...credentials, apiKey: credentials.apiKey }, options);
  }
  const response = await fetch('/api/providers/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'text',
      provider: credentials.provider,
      model: credentials.model,
      ...(credentials.botId ? { botId: credentials.botId } : {}),
      system: options.system,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
    }),
    signal: options.signal,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    text?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || payload?.ok !== true || typeof payload.text !== 'string') {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR');
  }
  return payload.text;
};
