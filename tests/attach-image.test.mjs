/**
 * Image attachments: the pure parts (sizing, data URLs), what each provider is sent, and that image
 * bytes never reach sessionStorage.
 *
 * The canvas step needs a browser, so it is not covered here and says so in the HANDOFF. These
 * tests stub `fetch` and `window`, the same way byok.test.mjs does, so they prove the wire format
 * and the storage rule without a key or a network.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

const { fitWithin, splitDataUrl, isImageFile, MAX_IMAGE_EDGE, MAX_IMAGES_PER_MESSAGE } = await import(
  '../web/src/prototype/chat/read-image-web.ts'
);
const { byokGenerator } = await import('../web/src/prototype/chat/byok.ts');
const { USER_HANDLE } = await import('../web/src/prototype/chat/engine.ts');
const { attachmentStatus } = await import('../web/src/prototype/chat/attachment-status.ts');
const { writeStoredRoom, readStoredRoom } = await import('../web/src/prototype/chat/storage.ts');

const DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('fitWithin shrinks the longest side and never scales up', () => {
  assert.deepEqual(fitWithin(4000, 2000), { width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE / 2 });
  assert.deepEqual(fitWithin(1000, 3136), { width: Math.round((1000 * MAX_IMAGE_EDGE) / 3136), height: MAX_IMAGE_EDGE });
  assert.deepEqual(fitWithin(300, 200), { width: 300, height: 200 });
  assert.ok(fitWithin(5000, 1).height >= 1, 'a sliver must not collapse to zero');
});

test('splitDataUrl hands back the parts providers want, or null', () => {
  assert.deepEqual(splitDataUrl(DATA_URL), { mediaType: 'image/jpeg', base64: '/9j/4AAQSkZJRg==' });
  assert.equal(splitDataUrl('not a data url'), null);
  assert.equal(splitDataUrl('data:image/png,plain'), null);
});

test('isImageFile goes by MIME type, then by extension', () => {
  assert.equal(isImageFile({ name: 'x.bin', type: 'image/png' }), true);
  assert.equal(isImageFile({ name: 'PHOTO.JPG', type: '' }), true);
  assert.equal(isImageFile({ name: 'report.pdf', type: 'application/pdf' }), false);
  assert.equal(isImageFile({ name: 'noextension' }), false);
  assert.equal(MAX_IMAGES_PER_MESSAGE, 4);
});

const ROSTER = [{ id: 'dreamer', name: 'The Dreamer' }];
const image = (over = {}) => ({ id: 'a1', kind: 'image', name: 'chart.png', href: 'image:chart.png', dataUrl: DATA_URL, ...over });
const request = (attachments) => ({
  bot: ROSTER[0],
  history: [
    { id: '0', authorId: USER_HANDLE, body: 'old question', mentioned: [] },
    { id: '1', authorId: 'dreamer', body: 'old answer', mentioned: [] },
    { id: '2', authorId: USER_HANDLE, body: 'What is in this chart?', mentioned: [], attachments },
  ],
  waiting: ROSTER,
  isClosing: false,
  prompt: 'What is in this chart?',
  language: 'en',
  attachments,
});

const capture = async (provider, attachments) => {
  const original = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, init) => {
    seen = JSON.parse(init.body);
    const body =
      provider === 'anthropic'
        ? { content: [{ type: 'text', text: 'ok' }] }
        : { choices: [{ message: { content: 'ok' } }] };
    return { ok: true, status: 200, json: async () => body, text: async () => '' };
  };
  try {
    const model = provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4o';
    await byokGenerator({ provider, model, apiKey: 'k' })(request(attachments));
  } finally {
    globalThis.fetch = original;
  }
  return seen;
};

test('Anthropic: the picture rides on the latest human message only, as a base64 block', async () => {
  const body = await capture('anthropic', [image()]);
  assert.equal(typeof body.messages[0].content, 'string', 'an earlier message stays plain text');
  assert.equal(typeof body.messages[1].content, 'string');
  assert.deepEqual(body.messages[2].content, [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQSkZJRg==' } },
    { type: 'text', text: 'What is in this chart?' },
  ]);
  assert.match(body.system, /chart\.png \(uploaded image\): attached to the human's last message/);
});

test('OpenAI: the picture is an image_url part carrying a data URL', async () => {
  const body = await capture('openai', [image()]);
  const last = body.messages.at(-1);
  assert.equal(last.role, 'user');
  assert.deepEqual(last.content, [
    { type: 'text', text: 'What is in this chart?' },
    { type: 'image_url', image_url: { url: DATA_URL } },
  ]);
});

test('an image that could not be read is named in the prompt and never sent as a picture', async () => {
  const body = await capture('anthropic', [image({ dataUrl: undefined, problem: 'The image is larger than 20 MB.' })]);
  assert.equal(typeof body.messages[2].content, 'string');
  assert.match(body.system, /NOT read — The image is larger than 20 MB\./);
});

test('an image chip never claims it was "read in full"', () => {
  const copy = { chatAttachmentRead: 'READ', chatAttachmentUnread: 'UNREAD {reason}', chatAttachmentTruncated: 'CUT {chars}', chatImageAttached: 'IMAGE' };
  assert.equal(attachmentStatus(image(), copy), 'IMAGE');
  assert.equal(attachmentStatus(image({ problem: 'bad' }), copy), 'UNREAD bad');
});

test('image bytes are not written to sessionStorage, and an unsent image is flagged after reload', () => {
  const store = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
  };
  try {
    writeStoredRoom({
      title: 't', mode: 'panel', roster: ['dreamer'],
      messages: [{ id: 'm1', authorId: USER_HANDLE, body: 'hi', mentioned: [], attachments: [image()] }],
      pending: [image({ id: 'a2' })],
      turns: 0, stoppedBy: null, failures: [], held: [],
    });
    const raw = [...store.values()][0];
    assert.ok(!raw.includes('/9j/'), 'no base64 may reach storage');
    const restored = readStoredRoom();
    assert.equal(restored.messages[0].attachments[0].dataUrl, undefined);
    assert.equal(restored.messages[0].attachments[0].problem, undefined, 'an already-sent image is not an error');
    assert.match(restored.pending[0].problem, /not kept when the page reloaded/);
  } finally {
    delete globalThis.window;
  }
});
