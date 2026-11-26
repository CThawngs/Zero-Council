/**
 * Built-in verified BYOK provider catalog and canonical endpoint resolution.
 *
 * All built-in providers lock their protocol and Base URL (`lockedBaseUrl: true`) so user API keys
 * are never routed to untrusted hosts. Custom providers support OpenAI-compatible and Anthropic
 * wire protocols with normalized user-supplied Base URLs.
 */

import {
  normalizeProviderBaseUrl,
  type VerifyTarget,
} from '../../../lib/byok/verify.ts';
import type { ChatBot } from '../engine.ts';

export type BuiltinProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'groq'
  | 'xai'
  | 'openrouter'
  | 'nvidia'
  | 'deepseek';

export type ProviderProtocol = 'anthropic' | 'openai' | 'google';

/** Built-in provider ID or `custom:(openai|anthropic):<slug>`. */
export type ProviderId = string;

export interface ProviderModel {
  id: string;
  label: string;
}

export interface Provider {
  id: BuiltinProviderId;
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  /** True on all built-in verified providers: Base URL input is read-only in UI and API. */
  lockedBaseUrl: true;
  models: ProviderModel[];
  /** Key prefix hint shown as placeholder in the API key input. */
  keyHint: string;
}

export interface ProviderEndpointSpec {
  provider: ProviderId;
  protocol?: ProviderProtocol;
  baseUrl?: string;
}

export interface Credentials {
  provider: ProviderId;
  model: string;
  apiKey: string;
  protocol?: ProviderProtocol;
  baseUrl?: string;
}

export interface ByokOptions {
  /** Per-advisor system prompt lookup keyed by bot ID. */
  personaOf?: (bot: ChatBot) => string | undefined;
  /** Invoked right before each provider request begins so UI can show thinking status. */
  onStart?: (bot: ChatBot) => void;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    lockedBaseUrl: true,
    models: [{ id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }],
    keyHint: 'sk-ant-…',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    lockedBaseUrl: true,
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
    keyHint: 'sk-…',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    protocol: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    lockedBaseUrl: true,
    models: [{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }],
    keyHint: 'AIza…',
  },
  {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    lockedBaseUrl: true,
    models: [{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' }],
    keyHint: 'gsk_…',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    lockedBaseUrl: true,
    models: [{ id: 'grok-2-latest', label: 'Grok 2 Latest' }],
    keyHint: 'xai-…',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    lockedBaseUrl: true,
    models: [{ id: 'openai/gpt-4o-mini', label: 'OpenRouter GPT-4o mini' }],
    keyHint: 'sk-or-…',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    protocol: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    lockedBaseUrl: true,
    models: [{ id: 'nvidia/nemotron-3.5-super-vl-120b-a12b', label: 'Nemotron 3.5 Super 120B' }],
    keyHint: 'nvapi-…',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    lockedBaseUrl: true,
    models: [{ id: 'deepseek-chat', label: 'DeepSeek V3 Chat' }],
    keyHint: 'sk-…',
  },
];

/** Finds a built-in provider definition by ID, or returns `undefined` for custom providers. */
export const builtinProviderById = (id: string): Provider | undefined =>
  PROVIDERS.find((p) => p.id === id);

/** Resolves a provider definition by ID, falling back to the first built-in provider. */
export const providerById = (id: ProviderId): Provider =>
  builtinProviderById(id) ?? PROVIDERS[0];

/**
 * Normalizes a user-typed Base URL: trims whitespace, removes trailing slashes, and strips pasted
 * endpoint suffixes (`/chat/completions`, `/messages`, `/models`) so only the API root remains.
 */
export const normalizeBaseUrl = (raw: string): string => normalizeProviderBaseUrl(raw);

/** Resolves the effective wire protocol and canonical/normalized Base URL for a provider target. */
export const resolveProviderEndpoint = (
  target: ProviderId | ProviderEndpointSpec
): { provider: ProviderId; protocol: ProviderProtocol; baseUrl: string; isBuiltin: boolean } => {
  const id = typeof target === 'string' ? target : target.provider;
  const builtin = builtinProviderById(id);
  if (builtin) {
    return {
      provider: builtin.id,
      protocol: builtin.protocol,
      baseUrl: builtin.baseUrl,
      isBuiltin: true,
    };
  }
  const explicitProtocol = typeof target === 'object' ? target.protocol : undefined;
  const inferredProtocol: ProviderProtocol =
    explicitProtocol ?? (id.startsWith('custom:anthropic:') ? 'anthropic' : 'openai');
  const rawBase =
    typeof target === 'object' && target.baseUrl
      ? normalizeBaseUrl(target.baseUrl)
      : inferredProtocol === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : 'https://api.openai.com/v1';
  return {
    provider: id,
    protocol: inferredProtocol,
    baseUrl: rawBase,
    isBuiltin: false,
  };
};

/** Builds a strict live-verification target (using locked endpoints for built-ins). */
export const verifyTargetFor = (target: ProviderId | ProviderEndpointSpec): VerifyTarget => {
  const { provider, protocol, baseUrl } = resolveProviderEndpoint(target);
  return {
    providerId: provider,
    protocol,
    baseUrl,
    defaultModel: builtinProviderById(provider)?.models[0]?.id,
  };
};
