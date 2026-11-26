import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from '../web/node_modules/typescript/lib/typescript.js';

function loadQrModule() {
  const filePath = path.resolve('web/src/lib/qr-svg.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const exportsObj = {};
  const moduleObj = { exports: exportsObj };
  const context = vm.createContext({
    exports: exportsObj,
    module: moduleObj,
    TextEncoder,
    Uint8Array,
    encodeURIComponent,
    Math,
    Number,
    Array,
    Error,
  });
  vm.runInContext(transpiled, context);
  return moduleObj.exports;
}

const { encodeQrMatrix, encodeQrSvg, encodeQrDataUri } = loadQrModule();

function readComponentTree(entryRel, dirRel) {
  const parts = [fs.readFileSync(path.resolve(entryRel), 'utf8')];
  const fullDir = path.resolve(dirRel);
  if (fs.existsSync(fullDir)) {
    for (const file of fs.readdirSync(fullDir).sort()) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        parts.push(fs.readFileSync(path.join(fullDir, file), 'utf8'));
      }
    }
  }
  return parts.join('\n');
}

function assertFinderPattern(matrix, topRow, leftCol) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const dist = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      const expectedDark = dist !== 2;
      assert.equal(
        matrix[topRow + r][leftCol + c],
        expectedDark,
        `Finder mismatch at (${topRow + r}, ${leftCol + c})`
      );
    }
  }
}

test('encodeQrMatrix encodes short payload into Version 1 (21x21) with valid finders & dark module', () => {
  const matrix = encodeQrMatrix('HELLO');
  assert.equal(matrix.length, 21);
  assert.equal(matrix[0].length, 21);

  assertFinderPattern(matrix, 0, 0);
  assertFinderPattern(matrix, 0, 14);
  assertFinderPattern(matrix, 14, 0);

  // Dark module at (4*V + 9, 8) = (13, 8)
  assert.equal(matrix[13][8], true);
});

test('encodeQrSvg & encodeQrDataUri render VietQR EMVCo payload locally without external URLs', () => {
  const emvPayload =
    '00020101021238570010A00000072701270006970422011319036891234560208QRIBFTTA530370454061990005802VN62190815ZC987654321ABCD6304A1B2';
  const matrix = encodeQrMatrix(emvPayload);
  // 128 bytes fits in Version 6-L (41x41)
  assert.equal(matrix.length, 41);
  assertFinderPattern(matrix, 0, 0);
  assertFinderPattern(matrix, 0, 41 - 7);
  assertFinderPattern(matrix, 41 - 7, 0);

  const svg = encodeQrSvg(emvPayload);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 49 49"'));
  assert.ok(!svg.includes('qrserver.com'));

  const dataUri = encodeQrDataUri(emvPayload);
  assert.ok(dataUri.startsWith('data:image/svg+xml;utf8,'));
  assert.ok(!dataUri.startsWith('http'));
  assert.ok(!dataUri.includes('qrserver.com'));
});

test('encodeQrMatrix handles multi-block Version 10+ payloads cleanly', () => {
  const longPayload = '000201010212' + 'X'.repeat(280) + '6304FFFF';
  const matrix = encodeQrMatrix(longPayload);
  // 296 bytes fits in Version 11-L (321 byte capacity -> size = 11*4 + 17 = 61)
  assert.equal(matrix.length, 61);
  assertFinderPattern(matrix, 0, 0);
  assertFinderPattern(matrix, 0, 61 - 7);
  assertFinderPattern(matrix, 61 - 7, 0);
});

test('Phase 2A Commit 8 UI/UX & security guardrails hold across source files', () => {
  const checkoutSrc = readComponentTree(
    'web/src/prototype/components/CheckoutDrawer.tsx',
    'web/src/prototype/components/checkout'
  );
  assert.ok(!checkoutSrc.includes('qrserver.com'), 'CheckoutDrawer must not leak QR to qrserver.com');
  assert.ok(!checkoutSrc.includes('isDevSimulation'), 'CheckoutDrawer must not render dev simulation UI');
  assert.ok(checkoutSrc.includes('encodeQrDataUri'), 'CheckoutDrawer must use local encodeQrDataUri');

  const globalsCss = fs.readFileSync(path.resolve('web/src/app/globals.css'), 'utf8');
  const reducedMotionIdx = globalsCss.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(reducedMotionIdx !== -1, 'globals.css must include prefers-reduced-motion media query');
  const reducedMotionBlock = globalsCss.slice(reducedMotionIdx, reducedMotionIdx + 450);
  const universalRuleMatch = reducedMotionBlock.match(/\*,?\s*\*::before,\s*\*::after\s*\{([^}]*)\}/);
  assert.ok(universalRuleMatch, 'prefers-reduced-motion must include universal transition/animation reset');
  assert.ok(
    !universalRuleMatch[1].includes('transform:'),
    'prefers-reduced-motion universal selector must not nuke fixed positioning via transform: none !important'
  );

  const chatRoomSrc = readComponentTree(
    'web/src/prototype/components/ChatRoomView.tsx',
    'web/src/prototype/components/chat-room'
  );
  assert.ok(chatRoomSrc.includes('id="chat-turn-error-card"'), 'ChatRoomView must render inline turn error card');
  assert.ok(chatRoomSrc.includes('id="confirm-clear-room-btn"'), 'ChatRoomView must confirm before clearing room');

  const sessionConcludedBuf = fs.readFileSync(
    path.resolve('web/src/prototype/components/SessionConcludedView.tsx')
  );
  assert.notEqual(
    sessionConcludedBuf[0] === 0xef && sessionConcludedBuf[1] === 0xbb && sessionConcludedBuf[2] === 0xbf,
    true,
    'SessionConcludedView.tsx must not start with UTF-8 BOM'
  );
});
