export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const decodeHtmlEntities = (raw: string): string =>
  raw
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();

const stripTags = (html: string): string => decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '));

const unwrapDuckDuckGoHref = (rawHref: string): string | null => {
  const cleaned = decodeHtmlEntities(rawHref.trim());
  if (!cleaned) return null;
  try {
    const normalized = cleaned.startsWith('//') ? `https:${cleaned}` : cleaned;
    if (normalized.includes('duckduckgo.com/l/?') || normalized.startsWith('/l/?')) {
      const urlObj = new URL(normalized, 'https://duckduckgo.com');
      const uddg = urlObj.searchParams.get('uddg');
      if (uddg && /^https?:\/\//i.test(uddg)) return uddg;
    }
    if (/^https?:\/\//i.test(normalized)) return normalized;
  } catch {
    return null;
  }
  return null;
};

/**
 * Parses DuckDuckGo HTML search response into clean `{ title, url, snippet }` items.
 */
export const parseDuckDuckGoHtml = (html: string, limit = 5): WebSearchResult[] => {
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null && results.length < limit) {
    const url = unwrapDuckDuckGoHref(match[1]);
    const title = stripTags(match[2]);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);

    const afterLink = html.slice(match.index + match[0].length, match.index + match[0].length + 1800);
    const snippetMatch = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i.exec(afterLink);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]).slice(0, 320) : '';
    results.push({ title, url, snippet });
  }

  return results;
};

export const formatWebSearchAttachmentText = (query: string, results: WebSearchResult[]): string => {
  if (results.length === 0) return `No live web results returned for "${query}".`;
  return results
    .map(
      (item, idx) =>
        `[${idx + 1}] ${item.title}\nURL: ${item.url}\n${item.snippet ? `Summary: ${item.snippet}` : ''}`.trim()
    )
    .join('\n\n');
};

export const searchWebLive = async (
  query: string,
  { limit = 5, fetchImpl = fetch }: { limit?: number; fetchImpl?: typeof fetch } = {}
): Promise<WebSearchResult[]> => {
  const q = query.trim();
  if (!q) return [];

  // 1. Primary: DuckDuckGo HTML endpoint (no API key required)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const response = await fetchImpl(ddgUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (response.ok) {
      const html = await response.text();
      const parsed = parseDuckDuckGoHtml(html, limit);
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // Fall through to Wikipedia OpenSearch fallback
  }

  // 2. Fallback: Wikipedia Search API (works reliably across restricted IPs without captcha)
  for (const wikiLang of ['vi', 'en']) {
    try {
      const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=1&format=json&srlimit=${limit}`;
      const response = await fetchImpl(wikiUrl, {
        headers: { 'user-agent': 'ZeroCouncilWebSearch/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as {
        query?: { search?: { title?: string; snippet?: string }[] };
      };
      const items = (body.query?.search ?? [])
        .filter((entry) => Boolean(entry.title))
        .map((entry) => ({
          title: String(entry.title),
          url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(String(entry.title).replace(/ /g, '_'))}`,
          snippet: stripTags(String(entry.snippet ?? '')).slice(0, 320),
        }));
      if (items.length > 0) return items.slice(0, limit);
    } catch {
      // Try next fallback
    }
  }

  return [];
};
