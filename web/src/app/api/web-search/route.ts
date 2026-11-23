import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { formatWebSearchAttachmentText, searchWebLive } from '@/lib/deliberation/web-search';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function GET(request: Request) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'deliberation:web-search',
    limit: 30,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 300);
  if (!q) {
    return Response.json({ error: 'QUERY_REQUIRED' }, { status: 400 });
  }

  try {
    const results = await searchWebLive(q, { limit: 5 });
    return Response.json({
      query: q,
      results,
      formattedText: formatWebSearchAttachmentText(q, results),
    });
  } catch (error) {
    console.error('[web-search] failed:', (error as Error).message);
    return Response.json({ error: 'SEARCH_FAILED', results: [] }, { status: 500 });
  }
}