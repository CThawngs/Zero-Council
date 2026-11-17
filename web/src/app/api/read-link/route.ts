import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { UnreadableLink, readLink } from '@/lib/deliberation/read-link';

export async function POST(request: Request) {
  const { denied } = await currentUserOnly();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const url = typeof (body as { url?: unknown })?.url === 'string' ? (body as { url: string }).url.trim() : '';
  if (!url) {
    return Response.json({ error: 'URL_REQUIRED' }, { status: 400 });
  }

  try {
    const reading = await readLink(url);
    return Response.json(reading);
  } catch (error) {
    if (error instanceof UnreadableLink) {
      return Response.json({ error: 'UNREADABLE_LINK', reason: error.reason }, { status: 422 });
    }
    return Response.json({ error: 'READ_FAILED', reason: 'Could not read this link.' }, { status: 500 });
  }
}
