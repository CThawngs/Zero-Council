import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const {
  copy,
  localizeAttachmentProblem,
  localizeAuthError,
  missingCopyKeys,
  translations,
} = await import('../web/src/prototype/i18n.ts');
const { THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY } = await import(
  '../web/src/prototype/theme.ts'
);
const { UnreadableFileError, readFileInBrowser } = await import(
  '../web/src/prototype/chat/read-file-web.ts'
);
const { UnreadableLinkError, readLinkInBrowser } = await import(
  '../web/src/prototype/chat/read-link-web.ts'
);
const { attachmentStatus } = await import(
  '../web/src/prototype/chat/attachment-status.ts'
);
const { validateCreateConversation } = await import(
  '../web/src/lib/store/conversations.ts'
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const hexToRgb = (hex) => {
  const clean = hex.trim().replace(/^#/, '');
  assert.equal(clean.length, 6, `Expected 6-digit hex colour, got ${hex}`);
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
};

const blendRgbaOver = (fg, bg, alpha) =>
  fg.map((channel, index) => Math.round(channel * alpha + bg[index] * (1 - alpha)));

const relativeLuminance = ([r, g, b]) => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const contrastRatio = (rgbA, rgbB) => {
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const collectLeafStrings = (obj, prefix = '', out = new Map()) => {
  if (typeof obj === 'string') {
    out.set(prefix, obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => collectLeafStrings(item, `${prefix}[${idx}]`, out));
    return out;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      collectLeafStrings(val, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
};

const parseCssVars = (blockText) => {
  const vars = {};
  for (const match of blockText.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
};

test('i18n copy.en and copy.vi have 100% key parity and zero empty strings', () => {
  assert.deepEqual(missingCopyKeys('en'), []);
  assert.deepEqual(missingCopyKeys('vi'), []);

  const enTopKeys = Object.keys(copy.en).sort();
  const viTopKeys = Object.keys(copy.vi).sort();
  assert.deepEqual(viTopKeys, enTopKeys, 'copy.en and copy.vi top-level keys must match 1:1');

  const enLeaves = collectLeafStrings(copy.en);
  const viLeaves = collectLeafStrings(copy.vi);
  assert.deepEqual(
    [...viLeaves.keys()].sort(),
    [...enLeaves.keys()].sort(),
    'copy.en and copy.vi nested leaf keys must match 1:1'
  );

  for (const [key, val] of enLeaves) {
    assert.ok(val.trim().length > 0, `copy.en.${key} must not be empty`);
  }
  for (const [key, val] of viLeaves) {
    assert.ok(val.trim().length > 0, `copy.vi.${key} must not be empty`);
  }

  const navEn = collectLeafStrings(translations.en);
  const navVi = collectLeafStrings(translations.vi);
  assert.deepEqual([...navVi.keys()].sort(), [...navEn.keys()].sort());
  for (const [key, val] of navVi) {
    assert.ok(val.trim().length > 0, `translations.vi.${key} must not be empty`);
  }

  assert.equal(copy.vi.emailPlaceholder, 'ban@example.com');
});

test('theme CSS wiring, @custom-variant dark, and dead theme-bootstrap.js removal', () => {
  const deadBootstrap = path.join(ROOT, 'web', 'public', 'theme-bootstrap.js');
  assert.equal(
    fs.existsSync(deadBootstrap),
    false,
    'Dead web/public/theme-bootstrap.js must be deleted'
  );

  assert.ok(THEME_BOOTSTRAP_SCRIPT.includes(THEME_STORAGE_KEY));
  assert.ok(THEME_BOOTSTRAP_SCRIPT.includes('data-theme'));
  assert.ok(THEME_BOOTSTRAP_SCRIPT.includes('colorScheme'));

  const css = fs.readFileSync(path.join(ROOT, 'web', 'src', 'app', 'globals.css'), 'utf8');
  assert.match(
    css,
    /@custom-variant\s+dark\s*\(&:where\(\[data-theme=dark\],\s*\[data-theme=dark\]\s+\*\)\);/,
    'globals.css must bind Tailwind v4 dark:* variant to [data-theme=dark]'
  );
  assert.match(css, /--color-accent-soft:\s*var\(--color-accent-soft\);/);
  assert.equal(css.includes('var(--color-black)'), false, 'Undefined --color-black must not remain');
  assert.match(
    css,
    /\.button-primary:hover[\s\S]*?color:\s*var\(--color-accent-ink\);/,
    '.button-primary:hover must preserve accent-ink contrast'
  );
});

test('WCAG 2.1 AA contrast >= 4.5:1 holds across all Light and Dark theme tokens', () => {
  const css = fs.readFileSync(path.join(ROOT, 'web', 'src', 'app', 'globals.css'), 'utf8');
  const rootMatch = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  const darkMatch = /\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(rootMatch, ':root block must exist');
  assert.ok(darkMatch, "[data-theme='dark'] block must exist");

  const lightVars = parseCssVars(rootMatch[1]);
  const darkVars = parseCssVars(darkMatch[1]);

  const fgTokens = [
    '--color-ink',
    '--color-ink-muted',
    '--color-accent',
    '--color-accent-sage',
    '--color-accent-rust',
    '--color-persona-rose',
    '--color-persona-sage',
    '--color-persona-slate',
    '--color-persona-ochre',
    '--tint-blue',
    '--tint-orange',
    '--tint-green',
    '--tint-yellow',
    '--tint-pink',
    '--tint-violet',
  ];

  // Light mode checks: against background, surface-2, 12% tinted pills, and white accent-ink on solid fills
  const lightBg = hexToRgb(lightVars['--color-background']);
  const lightSurf2 = hexToRgb(lightVars['--color-surface-2']);
  const lightAccentInk = hexToRgb(lightVars['--color-accent-ink']);

  for (const token of fgTokens) {
    const fg = hexToRgb(lightVars[token]);
    const onBg = contrastRatio(fg, lightBg);
    const onSurf2 = contrastRatio(fg, lightSurf2);
    const onTintedPill = contrastRatio(fg, blendRgbaOver(fg, lightBg, 0.12));
    assert.ok(onBg >= 4.5, `Light ${token} (${lightVars[token]}) on #fff is ${onBg.toFixed(2)}:1 (< 4.5)`);
    assert.ok(onSurf2 >= 4.5, `Light ${token} (${lightVars[token]}) on surface-2 is ${onSurf2.toFixed(2)}:1 (< 4.5)`);
    assert.ok(onTintedPill >= 4.5, `Light ${token} (${lightVars[token]}) on 12% pill is ${onTintedPill.toFixed(2)}:1 (< 4.5)`);

    const solidContrast = contrastRatio(lightAccentInk, fg);
    assert.ok(
      solidContrast >= 4.5,
      `Light accent-ink on solid ${token} (${lightVars[token]}) is ${solidContrast.toFixed(2)}:1 (< 4.5)`
    );
  }

  // Dark mode checks: against background, surface, surface-2, 14% tinted pills, and dark accent-ink on solid fills
  const darkBg = hexToRgb(darkVars['--color-background']);
  const darkSurf = hexToRgb(darkVars['--color-surface']);
  const darkSurf2 = hexToRgb(darkVars['--color-surface-2']);
  const darkAccentInk = hexToRgb(darkVars['--color-accent-ink']);

  for (const token of fgTokens) {
    const fg = hexToRgb(darkVars[token]);
    const onBg = contrastRatio(fg, darkBg);
    const onSurf = contrastRatio(fg, darkSurf);
    const onSurf2 = contrastRatio(fg, darkSurf2);
    const onTintedPill = contrastRatio(fg, blendRgbaOver(fg, darkSurf, 0.14));
    assert.ok(onBg >= 4.5, `Dark ${token} (${darkVars[token]}) on background is ${onBg.toFixed(2)}:1 (< 4.5)`);
    assert.ok(onSurf >= 4.5, `Dark ${token} (${darkVars[token]}) on surface is ${onSurf.toFixed(2)}:1 (< 4.5)`);
    assert.ok(onSurf2 >= 4.5, `Dark ${token} (${darkVars[token]}) on surface-2 is ${onSurf2.toFixed(2)}:1 (< 4.5)`);
    assert.ok(onTintedPill >= 4.5, `Dark ${token} (${darkVars[token]}) on 14% pill is ${onTintedPill.toFixed(2)}:1 (< 4.5)`);

    const solidContrast = contrastRatio(darkAccentInk, fg);
    assert.ok(
      solidContrast >= 4.5,
      `Dark accent-ink on solid ${token} (${darkVars[token]}) is ${solidContrast.toFixed(2)}:1 (< 4.5)`
    );
  }
});

test('localizeAuthError maps Supabase and OAuth errors cleanly in EN and VI', () => {
  const cases = [
    ['Invalid login credentials', copy.en.authErrInvalidCredentials, copy.vi.authErrInvalidCredentials],
    ['Email not confirmed', copy.en.authErrEmailNotConfirmed, copy.vi.authErrEmailNotConfirmed],
    ['User already registered', copy.en.authErrUserAlreadyRegistered, copy.vi.authErrUserAlreadyRegistered],
    ['Password should be at least 8 characters.', copy.en.authErrPasswordTooShort, copy.vi.authErrPasswordTooShort],
    ['New password should be different from the old password.', copy.en.authErrSamePassword, copy.vi.authErrSamePassword],
    ['For security purposes, you can only request this after 42 seconds.', copy.en.authErrRateLimited, copy.vi.authErrRateLimited],
    ['Unable to validate email address: invalid format', copy.en.authErrInvalidEmail, copy.vi.authErrInvalidEmail],
    ['Auth session missing!', copy.en.authErrSessionMissing, copy.vi.authErrSessionMissing],
    ['No authentication code or token was provided.', copy.en.authErrMissingCode, copy.vi.authErrMissingCode],
    ['Token has expired or is invalid', copy.en.authErrTokenExpired, copy.vi.authErrTokenExpired],
    ['access_denied', copy.en.authErrOAuthDenied, copy.vi.authErrOAuthDenied],
  ];

  for (const [raw, expectedEn, expectedVi] of cases) {
    assert.equal(localizeAuthError(raw, 'en'), expectedEn);
    assert.equal(localizeAuthError(raw, 'vi'), expectedVi);
    assert.notEqual(expectedEn, expectedVi);
  }
});

test('attachment readers, attachmentStatus, and conversation defaults localize cleanly in EN and VI', async () => {
  const emptyFile = {
    name: 'notes.txt',
    size: 0,
    arrayBuffer: async () => new ArrayBuffer(0),
  };

  await assert.rejects(
    () => readFileInBrowser(emptyFile),
    (err) => err instanceof UnreadableFileError && err.reason === 'The file is empty.'
  );
  await assert.rejects(
    () => readFileInBrowser(emptyFile, { language: 'vi' }),
    (err) => err instanceof UnreadableFileError && err.reason === 'Tệp đang trống.'
  );

  await assert.rejects(
    () => readLinkInBrowser('ftp://example.com/file'),
    (err) =>
      err instanceof UnreadableLinkError &&
      err.reason === 'Only http and https links can be read.'
  );
  await assert.rejects(
    () => readLinkInBrowser('ftp://example.com/file', { language: 'vi' }),
    (err) =>
      err instanceof UnreadableLinkError &&
      err.reason === 'Chỉ đọc được liên kết http và https.'
  );

  // Bidirectional live translation on already-stored attachment problems
  const storedEnAttachment = {
    id: 'a1',
    kind: 'image',
    name: 'diagram.png',
    href: 'image:diagram.png',
    problem: 'The image was not kept when the page reloaded. Attach it again.',
  };
  assert.match(attachmentStatus(storedEnAttachment, copy.vi), /Ảnh không được giữ lại/);
  assert.match(attachmentStatus(storedEnAttachment, copy.en), /The image was not kept/);

  assert.equal(
    localizeAttachmentProblem('At most 8 images per message.', 'vi'),
    'Tối đa 8 ảnh mỗi tin nhắn.'
  );

  // Conversation default titles remain backwards-compatible in EN and localized in VI
  const groupEn = validateCreateConversation({ kind: 'group', roster: ['bot:1', 'bot:2'] });
  const groupVi = validateCreateConversation({
    kind: 'group',
    roster: ['bot:1', 'bot:2'],
    language: 'vi',
  });
  assert.ok('value' in groupEn && groupEn.value.title === 'Group Chat');
  assert.ok('value' in groupVi && groupVi.value.title === copy.vi.defaultGroupTitle);
});
