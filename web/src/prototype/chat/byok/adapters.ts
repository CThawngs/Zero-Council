/**
 * Low-level HTTP wire adapters for Anthropic Messages, OpenAI-compatible Chat Completions,
 * and Google Gemini `generateContent` endpoints (with server-side 3xx redirect SSRF guards).
 */

import { buildSystemPrompt as systemPrompt } from '../prompts.ts';
import type { ChatTurnRequest } from '../engine.ts';
import {
  resolveProviderEndpoint,
  type Credentials,
} from './providers.ts';
import {
  HANDOFF_TOOL,
  toAnthropicMessages,
  toGoogleContents,
  toOpenAiMessages,
} from './messages.ts';

/**
 * Reasoning/thinking models (Gemini 2.5+, OpenAI o-series) share output token budget between
 * internal thought tokens and visible output, so 4096 prevents mid-sentence truncation.
 */
export const CHAT_TURN_MAX_TOKENS = 4096;

export interface ProviderTurnResponse {
  text: string;
  target: string;
  attempted: boolean;
}

/**
 * Blocks HTTP 3xx redirects on the server so a custom BYOK gateway cannot bounce server-side
 * `fetch` onto internal or cloud-metadata addresses (`169.254.169.254`, `127.0.0.1`).
 */
const serverRedirectGuard = (): Pick<RequestInit, 'redirect'> =>
  typeof window === 'undefined' ? { redirect: 'error' } : {};

const rejectUnexpectedServerRedirect = (providerLabel: string, response: Response): void => {
  if (
    typeof window === 'undefined' &&
    (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400))
  ) {
    throw new Error(`${providerLabel} redirect refused`);
  }
};

/** Executes a room turn against the Anthropic Messages API and extracts reply text + handoff tool call. */
export const requestAnthropic = async (
  credentials: Credentials,
  baseUrl: string,
  request: ChatTurnRequest,
  persona: string | undefined
): Promise<ProviderTurnResponse> => {
  const useTools = !request.soloMode;
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': credentials.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: credentials.model,
      max_tokens: CHAT_TURN_MAX_TOKENS,
      system: systemPrompt(request, persona),
      messages: toAnthropicMessages(request),
      ...(useTools ? { tools: [HANDOFF_TOOL] } : {}),
    }),
    ...serverRedirectGuard(),
    signal: request.signal,
  });
  rejectUnexpectedServerRedirect('anthropic', response);

  if (!response.ok) throw new Error(`anthropic ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    content: { type: string; text?: string; name?: string; input?: { target?: string } }[];
  };

  const tool = payload.content.find((block) => block.type === 'tool_use' && block.name === 'message_agent');
  const text = payload.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();

  return {
    text,
    target: tool?.input?.target ?? '',
    attempted: Boolean(tool),
  };
};

/** Executes a room turn against an OpenAI-compatible Chat Completions endpoint with tool-fallback retry. */
export const requestOpenAi = async (
  credentials: Credentials,
  baseUrl: string,
  request: ChatTurnRequest,
  persona: string | undefined
): Promise<ProviderTurnResponse> => {
  const useTools = !request.soloMode;
  const tokenField =
    credentials.provider === 'openai'
      ? { max_completion_tokens: CHAT_TURN_MAX_TOKENS }
      : { max_tokens: CHAT_TURN_MAX_TOKENS };
  const baseBody = {
    model: credentials.model,
    ...tokenField,
    messages: [
      { role: 'system', content: systemPrompt(request, persona) },
      ...toOpenAiMessages(request),
    ],
  };

  const sendCompletion = (includeTools: boolean) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify(
        includeTools
          ? {
              ...baseBody,
              tools: [
                {
                  type: 'function',
                  function: {
                    name: HANDOFF_TOOL.name,
                    description: HANDOFF_TOOL.description,
                    parameters: HANDOFF_TOOL.input_schema,
                  },
                },
              ],
              tool_choice: 'auto',
            }
          : baseBody
      ),
      ...serverRedirectGuard(),
      signal: request.signal,
    });

  let response = await sendCompletion(useTools);
  rejectUnexpectedServerRedirect(credentials.provider, response);
  if (!response.ok && useTools && credentials.provider !== 'openai' && response.status === 400) {
    const errText = await response.text().catch(() => '');
    if (/tool/i.test(errText)) {
      response = await sendCompletion(false);
      rejectUnexpectedServerRedirect(credentials.provider, response);
    } else {
      throw new Error(`${credentials.provider} ${response.status}: ${errText.slice(0, 300)}`);
    }
  }

  if (!response.ok) {
    throw new Error(`${credentials.provider} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    choices: {
      message?: {
        content?: string | null;
        tool_calls?: { function: { name: string; arguments?: string } }[];
      };
    }[];
  };

  const message = payload.choices[0]?.message;
  const call = message?.tool_calls?.find((c) => c.function.name === HANDOFF_TOOL.name);
  let target = '';
  if (call) {
    try {
      target = String(JSON.parse(call.function.arguments ?? '{}').target ?? '');
    } catch {
      target = '';
    }
  }

  return { text: (message?.content ?? '').trim(), target, attempted: Boolean(call) };
};

/** Executes a room turn against the Google Gemini `generateContent` endpoint. */
export const requestGoogle = async (
  credentials: Credentials,
  baseUrl: string,
  request: ChatTurnRequest,
  persona: string | undefined
): Promise<ProviderTurnResponse> => {
  const modelId = credentials.model.replace(/^models\//, '');
  const useTools = !request.soloMode;
  const response = await fetch(
    `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': credentials.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt(request, persona) }],
        },
        contents: toGoogleContents(request),
        ...(useTools
          ? {
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: HANDOFF_TOOL.name,
                      description: HANDOFF_TOOL.description,
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          target: {
                            type: 'STRING',
                            description: HANDOFF_TOOL.input_schema.properties.target.description,
                          },
                        },
                        required: ['target'],
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
        generationConfig: { maxOutputTokens: CHAT_TURN_MAX_TOKENS },
      }),
      ...serverRedirectGuard(),
      signal: request.signal,
    }
  );
  rejectUnexpectedServerRedirect('google', response);

  if (!response.ok) throw new Error(`google ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    candidates?: {
      content?: {
        parts?: {
          text?: string;
          thought?: boolean;
          functionCall?: { name?: string; args?: Record<string, unknown> };
        }[];
      };
    }[];
  };

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((part) => part.functionCall?.name === HANDOFF_TOOL.name);
  const rawTarget = call?.functionCall?.args?.target;
  const target = typeof rawTarget === 'string' ? rawTarget : '';
  const text = parts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  return { text, target, attempted: Boolean(call) };
};

/**
 * Single-shot text completion across Anthropic, OpenAI-compatible, and Google Gemini without room
 * handoff tools. Used by structured deliberation and Chair synthesis when BYOK keys are connected.
 */
export const completeByokText = async (
  credentials: Credentials,
  options: { system: string; prompt: string; maxTokens?: number; signal?: AbortSignal }
): Promise<string> => {
  const maxTokens = options.maxTokens ?? CHAT_TURN_MAX_TOKENS;
  const { provider, protocol, baseUrl } = resolveProviderEndpoint(credentials);

  if (protocol === 'anthropic') {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': credentials.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: credentials.model,
        max_tokens: maxTokens,
        system: options.system,
        messages: [{ role: 'user', content: options.prompt }],
      }),
      ...serverRedirectGuard(),
      signal: options.signal,
    });
    rejectUnexpectedServerRedirect('anthropic', response);
    if (!response.ok) throw new Error(`anthropic ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = (await response.json()) as { content?: { type: string; text?: string }[] };
    return (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();
  }

  if (protocol === 'google') {
    const modelId = credentials.model.replace(/^models\//, '');
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': credentials.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.system }] },
          contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
        ...serverRedirectGuard(),
        signal: options.signal,
      }
    );
    rejectUnexpectedServerRedirect('google', response);
    if (!response.ok) throw new Error(`google ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    return (payload.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text ?? '')
      .join('\n')
      .trim();
  }

  const tokenField = provider === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${credentials.apiKey}`,
    },
    body: JSON.stringify({
      model: credentials.model,
      ...tokenField,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.prompt },
      ],
    }),
    ...serverRedirectGuard(),
    signal: options.signal,
  });
  rejectUnexpectedServerRedirect(provider, response);
  if (!response.ok) throw new Error(`${provider} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  return (payload.choices?.[0]?.message?.content ?? '').trim();
};
