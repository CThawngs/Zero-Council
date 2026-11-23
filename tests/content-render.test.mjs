import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countTreeNodes,
  detectContentKind,
  hasRichContent,
  isSafeUrl,
  parseInlineMarkdown,
  parseMarkdownBlocks,
  parseTree,
  tokenizeCodeLine,
  unwrapSingleFence,
} from '../web/src/prototype/chat/content-render.ts';

test('detectContentKind distinguishes plain prose, markdown, code, and tree', () => {
  assert.equal(detectContentKind('Let us align on the Q4 roadmap first.'), 'plain');
  assert.equal(hasRichContent('Plain message with @Strategist mention.'), false);

  assert.equal(detectContentKind('# Heading\n\n- item 1\n- item 2'), 'markdown');
  assert.equal(detectContentKind('Use `const x = 1` for **safety**.'), 'markdown');
  assert.equal(hasRichContent('## Summary\nEverything looks solid.'), true);

  assert.equal(
    detectContentKind('```ts\nconst answer = 42;\nexport default answer;\n```'),
    'code'
  );
  assert.equal(detectContentKind('import React from "react";\nexport const x = 1;'), 'code');
  assert.equal(detectContentKind('{"status":"ok","count":3}'), 'code');

  assert.equal(
    detectContentKind('root/\n├── src/\n│   └── index.ts\n└── README.md'),
    'tree'
  );
  assert.equal(
    detectContentKind('graph TD\n  A[Start] --> B[Review]\n  B --> C[Ship]'),
    'tree'
  );
  assert.equal(
    detectContentKind('{"name":"root","children":[{"name":"leaf"}]}'),
    'tree'
  );
});

test('unwrapSingleFence extracts language and inner body', () => {
  const unwrapped = unwrapSingleFence('```python\nprint("hi")\n```');
  assert.equal(unwrapped.lang, 'python');
  assert.equal(unwrapped.body, 'print("hi")');

  const multi = unwrapSingleFence('Intro\n```js\n1\n```\nOutro');
  assert.equal(multi.lang, '');
});

test('parseTree parses Unicode box-drawing directory trees', () => {
  const input = [
    'project/',
    '├── src/',
    '│   ├── app.ts',
    '│   └── utils.ts',
    '└── package.json',
  ].join('\n');

  const nodes = parseTree(input);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].label, 'project/');
  assert.equal(nodes[0].children.length, 2);
  assert.equal(nodes[0].children[0].label, 'src/');
  assert.equal(nodes[0].children[0].children.map((c) => c.label).join(','), 'app.ts,utils.ts');
  assert.equal(nodes[0].children[1].label, 'package.json');
  assert.equal(countTreeNodes(nodes), 5);
});

test('parseTree parses Mermaid flowchart graphs and guards against cycles', () => {
  const mermaid = [
    'graph TD',
    '  A[User Prompt] -->|routes| B(Council)',
    '  B --> C{Decision}',
    '  C -->|retry| B',
  ].join('\n');

  const nodes = parseTree(mermaid);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].label, 'User Prompt');
  assert.equal(nodes[0].children[0].label, 'Council');
  assert.equal(nodes[0].children[0].meta, 'routes');
  const decision = nodes[0].children[0].children[0];
  assert.equal(decision.label, 'Decision');
  assert.equal(decision.children[0].meta, 'retry (cycle)');
});

test('parseTree parses JSON trees and indented outlines', () => {
  const jsonTree = parseTree('{"name":"Council","children":[{"name":"Risk"},{"name":"Growth"}]}');
  assert.equal(jsonTree[0].label, 'Council');
  assert.equal(jsonTree[0].children.length, 2);

  const outline = parseTree('- Phase 1\n  - Spec\n  - Build\n- Phase 2');
  assert.equal(outline.length, 2);
  assert.equal(outline[0].label, 'Phase 1');
  assert.equal(outline[0].children.length, 2);
  assert.equal(outline[1].label, 'Phase 2');
});

test('parseMarkdownBlocks parses headings, tables, lists, blockquotes, code, and embedded trees', () => {
  const md = [
    '# Architecture',
    '',
    '> Keep it simple.',
    '',
    '- [x] Parser',
    '- [ ] Panel',
    '',
    '| Mode | Status |',
    '| --- | --- |',
    '| Code | Ready |',
    '',
    '```ts',
    'const ok = true;',
    '```',
    '',
    '```tree',
    'web/',
    '├── src/',
    '└── tests/',
    '```',
  ].join('\n');

  const blocks = parseMarkdownBlocks(md);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ['heading', 'blockquote', 'list', 'table', 'code', 'tree']
  );

  const list = blocks[2];
  assert.equal(list.kind, 'list');
  if (list.kind === 'list') {
    assert.equal(list.items[0].checked, true);
    assert.equal(list.items[1].checked, false);
  }

  const table = blocks[3];
  assert.equal(table.kind, 'table');
  if (table.kind === 'table') {
    assert.deepEqual(table.headers, ['Mode', 'Status']);
    assert.deepEqual(table.rows, [['Code', 'Ready']]);
  }
});

test('parseInlineMarkdown handles formatting and blocks unsafe URLs', () => {
  assert.equal(isSafeUrl('https://example.com'), true);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);

  const segs = parseInlineMarkdown('See **bold**, `code`, [ok](https://example.com), and [bad](javascript:alert(1))');
  assert.equal(segs.some((s) => s.kind === 'bold' && s.text === 'bold'), true);
  assert.equal(segs.some((s) => s.kind === 'code' && s.text === 'code'), true);
  assert.equal(segs.some((s) => s.kind === 'link' && s.href === 'https://example.com'), true);
  assert.equal(segs.some((s) => s.kind === 'link' && s.href.startsWith('javascript:')), false);
});

test('tokenizeCodeLine highlights keywords, strings, numbers, types, and comments', () => {
  const tokens = tokenizeCodeLine('const count: number = 42; // answer', 'ts');
  assert.equal(tokens.some((t) => t.type === 'keyword' && t.text === 'const'), true);
  assert.equal(tokens.some((t) => t.type === 'number' && t.text === '42'), true);
  assert.equal(tokens.some((t) => t.type === 'comment' && t.text === '// answer'), true);
});
