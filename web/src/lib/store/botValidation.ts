// Pure bot input validation — no imports, safe for `node --test`.
// Bounds mirror the wizard UI and the 0005 migration CHECKs.

export const BOT_PROVIDERS = ['anthropic', 'openai'] as const;

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
  if (typeof provider !== 'string' || !(BOT_PROVIDERS as readonly string[]).includes(provider)) {
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
