/**
 * Server-only: turns untrusted `{ provider, protocol?, baseUrl? }` input into a verification target.
 *
 * - Built-in providers ALWAYS use their canonical protocol + Base URL; whatever the client sent is
 *   ignored, so a verified provider key can never be routed to an attacker-controlled host.
 * - Custom providers take their protocol from the id (`custom:openai:*` / `custom:anthropic:*`) and
 *   their Base URL must pass the SSRF guard (no loopback / private hosts in production).
 */

import { customProviderProtocolOf, isBuiltinProviderId, isCustomProviderId } from '@/lib/store/botValidation';
import { builtinProviderById, normalizeBaseUrl } from '@/prototype/chat/byok';
import { isAllowedProviderBaseUrl, type VerifyTarget } from './verify.ts';

export type ResolveTargetResult =
  | { ok: true; target: VerifyTarget; label: string }
  | { ok: false; error: 'UNKNOWN_PROVIDER' | 'INVALID_PROTOCOL' | 'INVALID_BASE_URL' };

const allowPrivateProviderNetwork = (): boolean =>
  process.env.NODE_ENV !== 'production' || process.env.ZC_ALLOW_PRIVATE_PROVIDER_URLS === '1';

export const resolveVerifyTarget = (input: {
  provider: unknown;
  protocol?: unknown;
  baseUrl?: unknown;
  label?: unknown;
}): ResolveTargetResult => {
  const { provider } = input;
  if (typeof provider !== 'string') return { ok: false, error: 'UNKNOWN_PROVIDER' };

  if (isBuiltinProviderId(provider)) {
    const builtin = builtinProviderById(provider);
    if (!builtin) return { ok: false, error: 'UNKNOWN_PROVIDER' };
    return {
      ok: true,
      label: builtin.label,
      target: {
        providerId: builtin.id,
        protocol: builtin.protocol,
        baseUrl: builtin.baseUrl,
        defaultModel: builtin.models[0]?.id,
      },
    };
  }

  if (isCustomProviderId(provider)) {
    const protocol = customProviderProtocolOf(provider);
    if (!protocol) return { ok: false, error: 'INVALID_PROTOCOL' };
    // A client may echo the protocol; it must agree with the id, never override it.
    if (input.protocol !== undefined && input.protocol !== protocol) {
      return { ok: false, error: 'INVALID_PROTOCOL' };
    }
    if (!isAllowedProviderBaseUrl(input.baseUrl, { allowPrivateNetwork: allowPrivateProviderNetwork() })) {
      return { ok: false, error: 'INVALID_BASE_URL' };
    }
    const label =
      typeof input.label === 'string' && input.label.trim().length > 0
        ? input.label.trim().slice(0, 60)
        : provider;
    return {
      ok: true,
      label,
      target: {
        providerId: provider,
        protocol,
        baseUrl: normalizeBaseUrl(input.baseUrl as string),
      },
    };
  }

  return { ok: false, error: 'UNKNOWN_PROVIDER' };
};
