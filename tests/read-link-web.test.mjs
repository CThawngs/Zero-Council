/**
 * The browser-side link reader — the transport that actually ships when a human pins a link.
 *
 * The CORS ceiling is a decision, not a failure to work around, so it is asserted rather than left
 * implicit: a site that refuses to share must say so in words the room can show, not vanish.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

const { UnreadableLinkError, readLinkInBrowser } = await import(
  '../web/src/prototype/chat/read-link-web.ts'
);

const PAGE = `<!doctype html><html><head><title>The spec</title></head>
<body><h1>Spec</h1><p>Ship the rewrite.</p><script>alert(1)</script></body></html>`;

const stubFetch = (impl) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
};

test('a page that shares its text is read', async () => {
  const restore = stubFetch(async () => new Response(PAGE, { status: 200 }));
  try {
    const reading = await readLinkInBrowser('https://example.com/spec');
    assert.equal(reading.title, 'The spec');
    assert.match(reading.text, /Ship the rewrite\./);
    assert.equal(/alert\(1\)/.test(reading.text), false, 'script text must not survive into the room');
  } finally {
    restore();
  }
});

test('a non-web scheme is refused before any request', async () => {
  let called = false;
  const restore = stubFetch(async () => {
    called = true;
    return new Response('');
  });
  try {
    await assert.rejects(
      () => readLinkInBrowser('javascript:alert(1)'),
      (error) => error instanceof UnreadableLinkError && /http/.test(error.reason)
    );
    assert.equal(called, false, 'a javascript: URL must never reach fetch');
  } finally {
    restore();
  }
});

test('something that is not a link is refused', async () => {
  await assert.rejects(
    () => readLinkInBrowser('just some words'),
    (error) => error instanceof UnreadableLinkError
  );
});

test('a page that answers an error is reported, not retried forever', async () => {
  const restore = stubFetch(async () => new Response('nope', { status: 500 }));
  try {
    await assert.rejects(
      () => readLinkInBrowser('https://example.com/gone'),
      (error) => error instanceof UnreadableLinkError && /500/.test(error.reason)
    );
  } finally {
    restore();
  }
});

test('a page with no readable text is refused rather than pinned empty', async () => {
  const restore = stubFetch(
    async () => new Response('<html><head></head><body>   </body></html>', { status: 200 })
  );
  try {
    await assert.rejects(
      () => readLinkInBrowser('https://example.com/blank'),
      (error) => error instanceof UnreadableLinkError && /no readable text/.test(error.reason)
    );
  } finally {
    restore();
  }
});

test('a browser refusal is named as a refusal, not as a broken link', async () => {
  // A CORS block surfaces as an opaque TypeError. Calling that "the link is broken" sends the
  // reader off to debug a page that works fine in every other tab.
  const restore = stubFetch(async () => {
    throw new TypeError('Failed to fetch');
  });
  try {
    await assert.rejects(
      () => readLinkInBrowser('https://example.com/private'),
      (error) => error instanceof UnreadableLinkError && /would not share/.test(error.reason)
    );
  } finally {
    restore();
  }
});

test('a page that never answers is dropped instead of hanging the room', async () => {
  const restore = stubFetch(
    (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      })
  );
  try {
    await assert.rejects(
      () => readLinkInBrowser('https://example.com/slow', { timeoutMs: 20 }),
      (error) => error instanceof UnreadableLinkError && /too long/.test(error.reason)
    );
  } finally {
    restore();
  }
});