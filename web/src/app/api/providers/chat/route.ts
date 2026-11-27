/**
 * POST /api/providers/chat
 *
 * Server-side BYOK completion proxy for signed-in users. Decrypts the caller's stored key on the
 * server (`getKey`), executes either a single-shot text completion (`mode: 'text'`) or a room
 * bot turn (`mode: 'turn'`), and returns only the model output — the API key never leaves the
 * server.
 */

import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { getKey } from '@/lib/byok/key-store';
import { resolveVerifyTarget } from '@/lib/byok/resolve-target';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';
import { assertSafeRemoteUrl, isPrivateProviderNetworkAllowed } from '@/lib/security/ssrf';
import { effectivePlan } from '@/lib/store/account';
import { listBots } from '@/lib/store/bots';
import { isCustomProviderId, isValidProviderId } from '@/lib/store/botValidation';
import { isBotDisabledForPlan, resolveRequestBotIds } from '@/lib/store/planLimits';
import { listProviderKeys, providerStoreErrorOf } from '@/lib/store/providerKeys';
import { byokGenerator, completeByokText } from '@/prototype/chat/byok';
import type { ChatTurnRequest } from '@/prototype/chat/engine';

export const maxDuration = 60;

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MODEL_ID_LENGTH = 200;

export async function POST(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'providers:chat',
    limit: 60,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const { mode, provider, model, botId, system, prompt, maxTokens, persona, turnRequest } =
    body as {
      mode?: unknown;
      provider?: unknown;
      model?: unknown;
      botId?: unknown;
      system?: unknown;
      prompt?: unknown;
      maxTokens?: unknown;
      persona?: unknown;
      turnRequest?: unknown;
    };

  if (mode !== 'text' && mode !== 'turn') {
    return Response.json({ ok: false, error: 'INVALID_MODE' }, { status: 400 });
  }
  if (!isValidProviderId(provider)) {
    return Response.json({ ok: false, error: 'UNKNOWN_PROVIDER' }, { status: 400 });
  }
  if (typeof model !== 'string' || !model.trim() || model.trim().length > MAX_MODEL_ID_LENGTH) {
    return Response.json({ ok: false, error: 'MODEL_REQUIRED' }, { status: 400 });
  }

  const turnBotHandle =
    turnRequest && typeof turnRequest === 'object'
      ? ((turnRequest as { bot?: { id?: unknown } }).bot?.id ?? undefined)
      : undefined;
  const targetBotIds = resolveRequestBotIds(botId, turnBotHandle);
  if (targetBotIds.length > 0) {
    try {
      const [planRecord, userBots] = await Promise.all([
        effectivePlan(user.email).catch(() => null),
        listBots(user.email),
      ]);
      const planId = planRecord?.planId ?? 'free';
      if (targetBotIds.some((targetBotId) => isBotDisabledForPlan(targetBotId, userBots, planId))) {
        return Response.json({ ok: false, error: 'PLAN_BOT_LIMIT' }, { status: 403 });
      }
    } catch (error) {
      console.error('[providers/chat] plan bot check failed:', (error as Error).message);
      return Response.json({ ok: false, error: 'PLAN_CHECK_FAILED' }, { status: 500 });
    }
  }

  let records: Awaited<ReturnType<typeof listProviderKeys>>;
  try {
    records = await listProviderKeys(user.email);
  } catch (error) {
    const { code, status } = providerStoreErrorOf(error);
    console.error('[providers/chat] list failed:', (error as Error).message);
    return Response.json({ ok: false, error: code }, { status });
  }

  const record = records.find((r) => r.provider === provider);
  if (!record) {
    return Response.json({ ok: false, error: 'PROVIDER_NOT_CONNECTED' }, { status: 404 });
  }

  const resolved = resolveVerifyTarget({ provider, baseUrl: record.baseUrl });
  if (!resolved.ok) {
    return Response.json({ ok: false, error: resolved.error }, { status: 400 });
  }

  if (isCustomProviderId(provider) && !isPrivateProviderNetworkAllowed()) {
    try {
      await assertSafeRemoteUrl(resolved.target.baseUrl, {
        requireHttps: true,
        allowPrivateNetwork: false,
      });
    } catch {
      return Response.json({ ok: false, error: 'INVALID_BASE_URL' }, { status: 400 });
    }
  }

  let apiKey: string | null;
  try {
    apiKey = await getKey(user.email, provider);
  } catch (error) {
    const { code, status } = providerStoreErrorOf(error);
    console.error('[providers/chat] key read failed:', (error as Error).message);
    return Response.json({ ok: false, error: code }, { status });
  }
  if (!apiKey) {
    return Response.json({ ok: false, error: 'KEY_NOT_FOUND' }, { status: 404 });
  }

  const credentials = {
    provider,
    model: model.trim(),
    apiKey,
    protocol: resolved.target.protocol,
    baseUrl: resolved.target.baseUrl,
  };

  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]);
    if (mode === 'text') {
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return Response.json({ ok: false, error: 'PROMPT_REQUIRED' }, { status: 400 });
      }
      const text = await completeByokText(credentials, {
        system: typeof system === 'string' ? system : '',
        prompt,
        maxTokens:
          typeof maxTokens === 'number' && Number.isFinite(maxTokens) && maxTokens > 0
            ? Math.min(8192, Math.floor(maxTokens))
            : undefined,
        signal,
      });
      return Response.json({ ok: true, text });
    }

    if (!turnRequest || typeof turnRequest !== 'object') {
      return Response.json({ ok: false, error: 'TURN_REQUEST_REQUIRED' }, { status: 400 });
    }
    const rawTurn = turnRequest as Omit<ChatTurnRequest, 'signal'>;
    if (!rawTurn.bot || typeof rawTurn.bot.id !== 'string' || !Array.isArray(rawTurn.history)) {
      return Response.json({ ok: false, error: 'INVALID_TURN_REQUEST' }, { status: 400 });
    }
    const turn = await byokGenerator(credentials, {
      personaOf: () => (typeof persona === 'string' ? persona : undefined),
    })({
      ...rawTurn,
      signal,
    });
    return Response.json({ ok: true, turn });
  } catch (error) {
    if (request.signal.aborted) {
      return Response.json({ ok: false, error: 'CLIENT_ABORTED' }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : 'PROVIDER_ERROR';
    console.error(`[providers/chat] ${provider} completion failed:`, message.slice(0, 200));
    return Response.json({ ok: false, error: 'PROVIDER_ERROR' }, { status: 502 });
  }
}
