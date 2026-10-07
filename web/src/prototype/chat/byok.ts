/**
 * Bring-your-own-key adapters. This is the seam BYOK fills.
 *
 * The engine never learns which provider answered. Each adapter turns one `ChatTurnRequest` into
 * one `BotTurn`, so adding a provider is a new entry in `PROVIDERS`, not a change to `runTurn`.
 *
 * Keys are held in memory by the caller and sent from the browser straight to the provider. Nothing
 * is persisted and nothing reaches our server — that is the honest reading of "private by default".
 * The cost is that a page reload clears the key, and a user who trusts this page trusts it with
 * their own key. Both are true and are stated in the Integrations screen.
 *
 * No SDK: `fetch` is enough for both wire formats and the repo has a no-new-dependency rule.
 */

import { SILENT_TOKEN, USER_HANDLE, aliasTable, findMentions, type BotGenerator, type BotTurn, type ChatBot, type ChatTurnRequest } from './engine.ts';

export type ProviderId = 'anthropic' | 'openai';

export interface ProviderModel {
  id: string;
  label: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  models: ProviderModel[];
  /** Env or setting the key comes from, named only so the UI can ask for the right thing. */
  keyHint: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: [{ id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }],
    keyHint: 'sk-ant-…',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
    keyHint: 'sk-…',
  },
];

export const providerById = (id: ProviderId): Provider => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

/**
 * The one tool an advisor may call. Same name and shape as Hermes' `message_agent`, because the
 * point is that a model asked to address someone produces a target rather than a paragraph that
 * happens to contain "@The Dreamer".
 */
const HANDOFF_TOOL = {
  name: 'message_agent',
  description:
    'Hand the floor to another member of this council. Call this at the end of your reply. ' +
    'Pass "user" to return the question to the human instead of to another advisor. ' +
    'Pass "all" to call back every advisor currently held out of the room.',
  input_schema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Display name of the advisor to speak next, or "user", or "all".',
      },
    },
    required: ['target'],
  },
} as const;

/**
 * Resolves whatever the model put in `target` to a roster id.
 *
 * A model will not obey the schema. It will return "The Dreamer", "dreamer", "Dreamer, take this
 * one" or a paragraph. Silently dropping those would leave the room stalled with no explanation, so
 * an unresolvable target closes the round back to the user instead — which is the recoverable
 * failure. The visible text still says what the advisor said.
 */
export const resolveTarget = (raw: string, roster: ChatBot[]): string[] => {
  const wanted = raw.replace(/^@/, '').trim();
  if (!wanted) return [];
  if (/^user$/i.test(wanted)) return [USER_HANDLE];
  const direct = roster.find((bot) => bot.id === wanted.toLowerCase());
  if (direct) return [direct.id];
  const hit = findMentions(`@${wanted}`, aliasTable(roster)).find((m) => m.id !== USER_HANDLE);
  return hit ? [hit.id] : [];
};

interface Credentials {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

/** What each advisor is told about themselves and the room. Kept short: the transcript is the context. */
const systemPrompt = (request: ChatTurnRequest, persona: string | undefined): string => {
  const roster = request.waiting.map((bot) => `- ${bot.name}`).join('\n');
  const closing = request.isClosing
    ? 'You have the floor last in this round. Answer the human directly, then call message_agent with target "user".'
    : // Always offer the human as a target. Without this an advisor who has run out of objections
      // picks a colleague at random instead of handing the question back, and the round drags on.
      'When you are done, call message_agent with the name of the advisor who should go next, or with "user" if the council has nothing left to add and the human should decide.';

  return [
    persona,
    '',
    'You are one advisor in a council that deliberates in a shared chat room. Other advisors and the human both read the whole transcript, so you do not need to repeat what has already been said.',
    'Read the room before answering. Take a position, say why, and name what would change your mind.',
    'Speak in the room’s own language and keep it to a few sentences.',
    '',
    'Still to speak this round:',
    roster || '- nobody',
    '',
    closing,
    `If you have nothing to add, reply with exactly ${SILENT_TOKEN} and do not call the tool.`,
  ].join('\n');
};

const toAnthropicMessages = (request: ChatTurnRequest) =>
  request.history.map((message) => ({
    role: message.authorId === USER_HANDLE ? 'user' : 'assistant',
    content: message.authorId === USER_HANDLE ? message.body : `${message.authorId}: ${message.body}`,
  }));

const requestAnthropic = async (credentials: Credentials, request: ChatTurnRequest, persona: string | undefined) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': credentials.apiKey,
      'anthropic-version': '2023-06-01',
      // Required for any call made from a browser. It opts this origin into direct API access.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: credentials.model,
      max_tokens: 1024,
      system: systemPrompt(request, persona),
      messages: toAnthropicMessages(request),
      tools: [HANDOFF_TOOL],
    }),
  });

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
    // A tool call that arrived but cannot be read is a different situation from no tool call at
    // all, and the engine must be able to tell them apart: the first needs closing, the second is
    // just an advisor who did not hand off.
    attempted: Boolean(tool),
  };
};

const requestOpenAi = async (credentials: Credentials, request: ChatTurnRequest, persona: string | undefined) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${credentials.apiKey}`,
    },
    body: JSON.stringify({
      model: credentials.model,
      max_completion_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt(request, persona) },
        ...toAnthropicMessages(request).map((m) => ({ role: m.role, content: m.content })),
      ],
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
    }),
  });

  if (!response.ok) throw new Error(`openai ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    choices: { message: { content?: string | null; tool_calls?: { function: { name: string; arguments: string } }[] } }[];
  };

  const message = payload.choices[0]?.message;
  const call = message?.tool_calls?.find((c) => c.function.name === HANDOFF_TOOL.name);
  let target = '';
  if (call) {
    // `arguments` is a JSON string, and a malformed one must not throw away the reply that came with it.
    try {
      target = String(JSON.parse(call.function.arguments ?? '{}').target ?? '');
    } catch {
      target = '';
    }
  }

  return { text: (message?.content ?? '').trim(), target, attempted: Boolean(call) };
};

export interface ByokOptions {
  /** Per-advisor system prompt, keyed by bot id. A persona with no entry still speaks. */
  personaOf?: (bot: ChatBot) => string | undefined;
  /** Called before each request so the room can show "The Dreamer is thinking". */
  onStart?: (bot: ChatBot) => void;
}

/**
 * Builds a generator that talks to a real model.
 *
 * The engine contract is unchanged, which is the whole reason the seam exists: the room loop, the
 * caps, the failure handling and the handoff rules are all engine code and none of it is provider
 * specific.
 */
export const byokGenerator =
  (credentials: Credentials, options: ByokOptions = {}): BotGenerator =>
  async (request: ChatTurnRequest): Promise<BotTurn> => {
    options.onStart?.(request.bot);

    const persona = options.personaOf?.(request.bot);
    const call = credentials.provider === 'anthropic' ? requestAnthropic : requestOpenAi;
    const { text, target, attempted } = await call(credentials, request, persona);

    if (!text || text === SILENT_TOKEN) return { text: '', handoffs: [], silent: true };

    const roster = request.waiting.length ? request.waiting : [request.bot];
    const handoffs = target ? resolveTarget(target, roster) : [];
    // The advisor tried to hand the floor but the target cannot be read or does not resolve. Closing
    // back to the human is the recoverable outcome; dropping it would stall the room on a name no
    // one can act on, with nothing on screen to explain the silence.
    if (attempted && handoffs.length === 0) handoffs.push(USER_HANDLE);

    return { text, handoffs };
  };