import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';
import { effectivePlan } from '@/lib/store/account';
import { createBot, deleteBot, listBots, updateBot } from '@/lib/store/bots';
import { listProviderKeys } from '@/lib/store/providerKeys';
import { validateBotInput } from '@/lib/store/botValidation';
import { planById } from '@/prototype/data/plans';

const MAX_BODY_BYTES = 64 * 1024;

/** The caller's own bots. The account email comes from the session, never the body. */
export async function GET() {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const bots = await listBots(user.email);
    return Response.json({ bots });
  } catch (error) {
    console.error('[bots] list failed:', (error as Error).message);
    return Response.json({ error: 'LIST_FAILED' }, { status: 500 });
  }
}

/** A bot is valid when its provider is connected on this account and the model is in its model list. */
const assertBrainConnected = async (email: string, provider: string, model: string) => {
  const keys = await listProviderKeys(email);
  return keys.some(
    (entry) =>
      entry.provider === provider &&
      (entry.model === model || (entry.models ?? []).includes(model))
  );
};

export async function POST(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'bots:write',
    limit: 60,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const parsed = validateBotInput(
    (body && typeof body === 'object' ? body : {}) as Parameters<typeof validateBotInput>[0]
  );
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const planRecord = await effectivePlan(user.email).catch(() => null);
    const plan = planById(planRecord?.planId ?? 'free');
    const existing = await listBots(user.email);
    if (existing.length >= plan.maxBots) {
      return Response.json({ error: 'BOT_CAP_REACHED', cap: plan.maxBots }, { status: 403 });
    }
    if (!(await assertBrainConnected(user.email, parsed.bot.provider, parsed.bot.model))) {
      return Response.json({ error: 'MODEL_NOT_CONNECTED' }, { status: 400 });
    }
    const bot = await createBot(user.email, parsed.bot);
    return Response.json({ bot }, { status: 201 });
  } catch (error) {
    console.error('[bots] create failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'bots:write',
    limit: 60,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const payload = (body && typeof body === 'object' ? body : {}) as { id?: unknown };
  const { id } = payload;
  if (typeof id !== 'string' || !id.trim()) {
    return Response.json({ error: 'BOT_ID_REQUIRED' }, { status: 400 });
  }
  const parsed = validateBotInput(payload as Parameters<typeof validateBotInput>[0]);
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    if (!(await assertBrainConnected(user.email, parsed.bot.provider, parsed.bot.model))) {
      return Response.json({ error: 'MODEL_NOT_CONNECTED' }, { status: 400 });
    }
    const bot = await updateBot(user.email, id.trim(), parsed.bot);
    if (!bot) return Response.json({ error: 'BOT_NOT_FOUND' }, { status: 404 });
    return Response.json({ bot });
  } catch (error) {
    console.error('[bots] update failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'BOT_ID_REQUIRED' }, { status: 400 });
    const removed = await deleteBot(user.email, id);
    if (!removed) return Response.json({ error: 'BOT_NOT_FOUND' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[bots] delete failed:', (error as Error).message);
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
