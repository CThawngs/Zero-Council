// Pure bot & provider input validation — no imports, safe for `node --test`.
// Bounds mirror the wizard UI and the 0008 migration definitions.

export const BUILTIN_BOT_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'openrouter',
  'nvidia',
  'deepseek',
] as const;

export const BOT_PROVIDERS = BUILTIN_BOT_PROVIDERS;

export type BuiltinBotProvider = (typeof BUILTIN_BOT_PROVIDERS)[number];
export type CustomProviderProtocol = 'openai' | 'anthropic';

const CUSTOM_PROVIDER_RE = /^custom:(openai|anthropic):[a-z0-9][a-z0-9-]{0,47}$/;

export const isBuiltinProviderId = (value: string): value is BuiltinBotProvider =>
  (BUILTIN_BOT_PROVIDERS as readonly string[]).includes(value);

export const isCustomProviderId = (value: string): boolean => CUSTOM_PROVIDER_RE.test(value);

export const customProviderProtocolOf = (value: string): CustomProviderProtocol | null => {
  const match = /^custom:(openai|anthropic):/.exec(value);
  return match ? (match[1] as CustomProviderProtocol) : null;
};

export const isValidProviderId = (value: unknown): value is string =>
  typeof value === 'string' && (isBuiltinProviderId(value) || isCustomProviderId(value));

export const slugifyCustomProvider = (protocol: CustomProviderProtocol, label: string): string => {
  const clean = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const suffix = clean || 'endpoint';
  return `custom:${protocol}:${suffix}`;
};

export interface BotInput {
  name?: unknown;
  instruction?: unknown;
  provider?: unknown;
  model?: unknown;
}

export interface ValidBotInput {
  name: string;
  instruction: string;
  provider: string;
  model: string;
}

const ok = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= max;

/** Returns the normalized bot, or an error code the route maps to a 400. */
export const validateBotInput = (input: BotInput): { bot: ValidBotInput } | { error: string } => {
  const { name, instruction, provider, model } = input ?? {};
  if (!ok(name, 80)) return { error: 'NAME_REQUIRED' };
  if (!ok(instruction, 4000)) return { error: 'INSTRUCTION_REQUIRED' };
  if (!isValidProviderId(provider)) {
    return { error: 'UNKNOWN_PROVIDER' };
  }
  if (!ok(model, 200)) return { error: 'MODEL_REQUIRED' };
  return {
    bot: {
      name: (name as string).trim(),
      instruction: (instruction as string).trim(),
      provider,
      model: (model as string).trim(),
    },
  };
};
