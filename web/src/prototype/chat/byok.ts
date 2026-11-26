/**
 * Public BYOK adapter entrypoint across 8 verified providers + custom OpenAI/Anthropic endpoints.
 *
 * Submodules under `./byok/`:
 * - `providers.ts`: provider catalog, locked Base URLs, endpoint resolution
 * - `verification.ts`: strict live-inference connection verification & custom model probing
 * - `messages.ts`: multi-agent transcript normalization & A2A handoff target resolution
 * - `adapters.ts`: Anthropic, OpenAI-compatible, and Google Gemini HTTP wire calls
 */

import {
  SILENT_TOKEN,
  USER_HANDLE,
  type BotGenerator,
  type BotTurn,
  type ChatTurnRequest,
} from './engine.ts';
import {
  resolveProviderEndpoint,
  type ByokOptions,
  type Credentials,
} from './byok/providers.ts';
import { resolveTarget } from './byok/messages.ts';
import {
  requestAnthropic,
  requestGoogle,
  requestOpenAi,
} from './byok/adapters.ts';

export {
  PROVIDERS,
  builtinProviderById,
  providerById,
  normalizeBaseUrl,
  resolveProviderEndpoint,
  verifyTargetFor,
  type BuiltinProviderId,
  type ProviderProtocol,
  type ProviderId,
  type ProviderModel,
  type Provider,
  type ProviderEndpointSpec,
  type Credentials,
  type ByokOptions,
} from './byok/providers.ts';

export {
  verifyProviderKeyDirect,
  fetchProviderModels,
  verifyProviderConnection,
  testProviderModel,
  type ProviderConnectionResult,
} from './byok/verification.ts';

export { resolveTarget } from './byok/messages.ts';
export { completeByokText } from './byok/adapters.ts';

/** Creates a `BotGenerator` for the chat engine that dispatches BYOK turns and parses handoffs. */
export const byokGenerator =
  (credentials: Credentials, options: ByokOptions = {}): BotGenerator =>
  async (request: ChatTurnRequest): Promise<BotTurn> => {
    options.onStart?.(request.bot);

    const persona = options.personaOf?.(request.bot);
    const { protocol, baseUrl } = resolveProviderEndpoint(credentials);
    const call =
      protocol === 'anthropic'
        ? requestAnthropic
        : protocol === 'google'
          ? requestGoogle
          : requestOpenAi;
    const { text, target, attempted } = await call(credentials, baseUrl, request, persona);

    if (request.soloMode) {
      if (!text || text === SILENT_TOKEN) return { text: '', handoffs: [], silent: true };
      return { text, handoffs: [USER_HANDLE] };
    }

    const candidates = request.isClosing
      ? []
      : (request.handoffTargets ?? request.waiting).filter((bot) => bot.id !== request.bot.id);
    const handoffs = target ? resolveTarget(target, candidates) : [];
    if (attempted && handoffs.length === 0) handoffs.push(USER_HANDLE);

    // Preserve structured handoffs on tool-only turns (empty text), while explicit [SILENT] drops them.
    if (!text || text === SILENT_TOKEN) {
      return { text: '', handoffs: text === SILENT_TOKEN ? [] : handoffs, silent: true };
    }

    return { text, handoffs };
  };
