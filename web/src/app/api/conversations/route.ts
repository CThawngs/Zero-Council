import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson } from '@/lib/security/request-guard';
import {
  createConversation,
  deleteAllConversations,
  deleteConversation,
  listConversations,
  updateConversation,
  validateCreateConversation,
} from '@/lib/store/conversations';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function GET() {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const conversations = await listConversations(user.email);
    return Response.json({ conversations });
  } catch (error) {
    console.error('[conversations] list failed:', (error as Error).message);
    return Response.json({ error: 'LIST_FAILED' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'conversations:write',
    limit: 120,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const parsed = validateCreateConversation(
    (body && typeof body === 'object' ? body : {}) as Parameters<
      typeof validateCreateConversation
    >[0]
  );
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const conversation = await createConversation(user.email, parsed.value);
    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('[conversations] create failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'conversations:write',
    limit: 120,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const payload = (body && typeof body === 'object' ? body : {}) as {
    id?: unknown;
  } & Record<string, unknown>;
  if (typeof payload.id !== 'string' || !payload.id.trim()) {
    return Response.json({ error: 'CONVERSATION_ID_REQUIRED' }, { status: 400 });
  }
  try {
    const result = await updateConversation(user.email, payload.id.trim(), payload);
    if ('error' in result) {
      const status = result.error === 'CONVERSATION_NOT_FOUND' ? 404 : 400;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json(result);
  } catch (error) {
    console.error('[conversations] update failed:', (error as Error).message);
    return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const removed = await deleteConversation(user.email, id);
      if (!removed) return Response.json({ error: 'CONVERSATION_NOT_FOUND' }, { status: 404 });
    } else {
      await deleteAllConversations(user.email);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[conversations] delete failed:', (error as Error).message);
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}