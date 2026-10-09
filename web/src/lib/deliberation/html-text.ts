/**
 * HTML to readable text. No dependency, no DOM, no node built-ins.
 *
 * It lives apart from `read-link.ts` for one concrete reason: that file imports `node:dns` and
 * `node:net` to refuse a link that resolves inside this network, and a single value import of it
 * from a client component drags those into the browser bundle, where Turbopack fails the build
 * outright ("the chunking context does not support external modules: node:dns/promises").
 *
 * The split is transport, not logic. The server fetches a URL and then parses it with this; the
 * browser fetches a URL and parses it with this. Same words either way.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

const decodeEntities = (value: string): string =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, entity: string) => {
    const key = entity.toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });

/**
 * HTML to readable text, with no dependency. Deliberately crude: it does not
 * build a DOM, so it cannot execute anything and cannot be tricked into
 * hanging on malformed markup. What survives is the prose, which is the only
 * part a model can use anyway.
 */
export const htmlToText = (html: string): { title: string; text: string } => {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : '';

  let body = html;
  const titleEnd = body.toLowerCase().indexOf('</title>');
  if (titleEnd !== -1) body = body.slice(titleEnd);
  // Keep the alt text; drop everything else inside a tag.
  body = body.replace(/<(script|style|noscript|template|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  body = body.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, ' $1 ');
  body = body.replace(/<[^>]+>/g, ' ');
  body = decodeEntities(body);
  // Collapse the runs of whitespace that stripping tags leaves behind.
  body = body.replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();

  return { title, text: body };
};