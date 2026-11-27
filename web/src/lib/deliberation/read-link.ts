/**
 * ============================================================================
 * Reading a link — server-side web attachment reader with unified SSRF guard.
 * ============================================================================
 *
 * Why server-side and not the browser: a page fetched from the browser is
 * subject to that page's CORS policy, so most links would come back empty. A
 * route handler can read them.
 *
 * Every hop (including manual redirect targets) is validated through
 * `assertSafeRemoteUrl` in `../security/ssrf.ts` so loopback, RFC1918, CGNAT,
 * cloud metadata (`169.254.169.254`, `[::ffff:169.254.169.254]` / `::ffff:a9fe:a9fe`),
 * link-local IPv6 (`fe80::/10`), and DNS names resolving to private addresses
 * are refused before `fetch` is invoked.
 *
 * Explicit `.ts` imports below so plain `node --test` can run the tests directly.
 */

import {
  assertSafeRemoteUrl,
  UnsafeRemoteUrlError,
  type DnsLookupFn,
} from '../security/ssrf.ts';
import { htmlToText } from './html-text.ts';

export { htmlToText };

export interface LinkReading {
  /** After redirects. What was actually read, which is not always what was asked for. */
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

/** A link we will not or could not read. `reason` is safe to show a user. */
export class UnreadableLink extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnreadableLink';
    this.reason = reason;
  }
}

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 20_000;
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;

const assertPublicUrl = async (raw: string, lookupImpl?: DnsLookupFn): Promise<URL> => {
  try {
    return await assertSafeRemoteUrl(raw, {
      requireHttps: false,
      allowPrivateNetwork: false,
      lookupImpl,
    });
  } catch (error) {
    if (error instanceof UnsafeRemoteUrlError) {
      switch (error.code) {
        case 'INVALID_URL':
          throw new UnreadableLink('That does not look like a link.');
        case 'UNSAFE_PROTOCOL':
          throw new UnreadableLink('Only http and https links can be opened.');
        case 'DNS_LOOKUP_FAILED':
          throw new UnreadableLink('That host could not be found.');
        case 'CREDENTIALS_NOT_ALLOWED':
        case 'BLOCKED_ADDRESS':
        default:
          throw new UnreadableLink('That link points inside this network and cannot be opened.');
      }
    }
    throw new UnreadableLink('That host could not be found.');
  }
};

export interface ReadLinkOptions {
  timeoutMs?: number;
  maxText?: number;
  /** Injected in tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Injected in tests. Defaults to `node:dns/promises` lookup via `ssrf.ts`.
   */
  lookupImpl?: DnsLookupFn;
}

/**
 * Fetch a link and return its text. Throws `UnreadableLink` with a reason that
 * is safe to show a user — the messages never include the resolved address.
 */
export const readLink = async (
  raw: string,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxText = MAX_TEXT,
    fetchImpl = fetch,
    lookupImpl,
  }: ReadLinkOptions = {}
): Promise<LinkReading> => {
  let current = raw;
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current, lookupImpl);
    response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'text/html,text/plain;q=0.9,*/*;q=0.1',
        'user-agent': 'ZeroCouncilLinkReader/1.0',
      },
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get('location');
    if (!isRedirect || !location) break;
    if (hop === MAX_REDIRECTS) throw new UnreadableLink('That link redirects too many times.');
    current = new URL(location, url).toString();
    response = null;
  }

  if (!response) throw new UnreadableLink('That link redirects too many times.');
  if (!response.ok) throw new UnreadableLink(`That link answered ${response.status}.`);

  const type = response.headers.get('content-type') ?? '';
  if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
    throw new UnreadableLink('That link is not a web page.');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new UnreadableLink('That link sent no content.');
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = MAX_BYTES - received;
      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        await reader.cancel();
        break;
      }
      received += value.byteLength;
      chunks.push(value);
    }
  } catch {
    throw new UnreadableLink('That link could not be read all the way through.');
  }

  const body = new TextDecoder().decode(concat(chunks));
  const { title, text } = htmlToText(body);
  if (text.length === 0) throw new UnreadableLink('That page had no readable text.');

  const truncated = text.length > maxText;
  return {
    url: response.url || current,
    title,
    text: truncated ? text.slice(0, maxText) : text,
    truncated,
  };
};

const concat = (chunks: Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
};
