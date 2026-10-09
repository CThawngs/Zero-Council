/**
 * Reading a link from the browser, for the room.
 *
 * Why this is NOT `lib/deliberation/read-link.ts`: that one resolves DNS and refuses a host that
 * points inside this network, which is the right guard for a *server* fetching a URL on someone's
 * behalf. It needs `node:dns`, and importing it from a client component fails the build outright.
 *
 * Why this is not an API route either: an unauthenticated endpoint that fetches any URL is an open
 * proxy — anyone who finds it spends our bandwidth. That call is the product owner's, and it has
 * not been made. So the fetch happens in the user's own browser, where the risk is their own and
 * no server is involved.
 *
 * The ceiling, stated plainly: most sites send no CORS header, so the browser refuses the read and
 * the attachment says so out loud. That is a real limit, not a bug to be worked around by routing
 * it through our server.
 */

import { htmlToText } from '../../lib/deliberation/html-text.ts';

const MAX_TEXT = 20_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export class UnreadableLinkError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'UnreadableLinkError';
    this.reason = reason;
  }
};

/** Only http(s). A `javascript:` or `data:` URL here would be a way to run code in our own page. */
const parseHref = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnreadableLinkError('That does not look like a link.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnreadableLinkError('Only http and https links can be read.');
  }
  return url;
};

export const readLinkInBrowser = async (
  raw: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<{ title: string; text: string }> => {
  const url = parseHref(raw.trim());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) {
      throw new UnreadableLinkError(`The page answered ${response.status}.`);
    }
    const html = await response.text();
    const { title, text } = htmlToText(html);
    if (!text.trim()) {
      throw new UnreadableLinkError('The page had no readable text.');
    }
    return { title, text: text.slice(0, MAX_TEXT) };
  } catch (error) {
    if (error instanceof UnreadableLinkError) throw error;
    // A CORS refusal surfaces as an opaque TypeError, and naming that honestly is more useful than
    // saying "the link is broken" — the link may be perfectly fine and simply not shareable.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new UnreadableLinkError('The page took too long to answer.');
    }
    throw new UnreadableLinkError('The browser would not share this page. Most sites block that.');
  } finally {
    clearTimeout(timer);
  }
};