import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { createBot, deleteBot, listBots, updateBot } from '@/lib/store/bots';
import { listProviderKeys } from '@/lib/store/providerKeys';
import { validateBotInput } from '@/lib/store/botValidation';

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

/** A bot is only valid when its provider+model matches a connected key on this account. */
const assertBrainConnected = async (email: string, provider: string, model: string) => {
  const keys = await listProviderKeys(email);
  return keys.some((entry) => entry.provider === provider && entry.model === model);
};

export async function POST(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = validateBotInput((body ?? {}) as Parameters<typeof validateBotInput>[0]);
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  try {
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
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const { id } = (body ?? {}) as { id?: unknown };
  if (typeof id !== 'string' || !id.trim()) {
    return Response.json({ error: 'BOT_ID_REQUIRED' }, { status: 400 });
  }
  const parsed = validateBotInput((body ?? {}) as Parameters<typeof validateBotInput>[0]);
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
