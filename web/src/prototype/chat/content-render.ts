/**
 * Zero-dependency content detection, syntax tokenization, and Markdown/tree parsing entrypoint
 * powering inline rich message bodies and the Content Render side panel.
 *
 * Submodules under `./content-render/`:
 * - `types.ts`: shared content, token, inline, block, and tree interfaces
 * - `tree.ts`: ASCII box-drawing, Mermaid, JSON, and indented outline tree parsers
 */

import type {
  CodeToken,
  InlineSegment,
  MarkdownBlock,
  ResolvedContentKind,
} from './content-render/types.ts';
import {
  TREE_FENCE_LANGS,
  TREE_LINE_RE,
  isTreeLike,
  normalizeNewlines,
  parseTree,
} from './content-render/tree.ts';

export type {
  ContentMode,
  ResolvedContentKind,
  ContentPanelPayload,
  TreeNode,
  CodeTokenType,
  CodeToken,
  InlineSegment,
  MarkdownBlock,
} from './content-render/types.ts';

export {
  normalizeNewlines,
  unwrapSingleFence,
  isTreeLike,
  parseTree,
  countTreeNodes,
} from './content-render/tree.ts';

const CODE_HINT_RE =
  /^\s*(?:#!\/|import\s+.+\s+from\s+['"]|export\s+(?:default|const|function|class|interface|type)\s+|(?:async\s+)?function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=|def\s+\w+\s*\(|class\s+\w+\s*[:({]|SELECT\s+.+\s+FROM\s+|<\?php|<![Dd][Oo][Cc][Tt][Yy][Pp][Ee]|<\/?[a-zA-Z][\w-]*[\s>])/;

const MARKDOWN_HINT_RE =
  /(?:^|\n)\s*(?:#{1,6}\s+\S|```|>\s+\S|[-*+]\s+\S|\d+\.\s+\S|---+\s*$)|(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:|\/|#)[^)\s]+\))/;

/** Checks whether a URL is safe to render as an interactive anchor. */
export const isSafeUrl = (href: string): boolean => {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  return /^(?:https?:|mailto:)/i.test(trimmed);
};

/** Detects whether text is best rendered as tree, code, markdown, or plain prose. */
export const detectContentKind = (raw: string, languageHint?: string): ResolvedContentKind => {
  const text = normalizeNewlines(raw).trim();
  if (!text) return 'plain';

  if (languageHint) {
    const lang = languageHint.trim().toLowerCase();
    if (TREE_FENCE_LANGS.has(lang)) return 'tree';
    if (lang === 'md' || lang === 'markdown') return 'markdown';
    return 'code';
  }

  const singleFence = text.match(/^```([A-Za-z0-9_+-]*)\n([\s\S]*?)\n```\s*$/);
  if (singleFence && !singleFence[2].includes('\n```')) {
    const lang = singleFence[1].trim().toLowerCase();
    if (TREE_FENCE_LANGS.has(lang)) return 'tree';
    if (lang === 'md' || lang === 'markdown') return 'markdown';
    if (lang) return 'code';
  }

  if (isTreeLike(text)) return 'tree';

  if (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  ) {
    try {
      JSON.parse(text);
      return 'code';
    } catch {
      // Not valid JSON; continue checking.
    }
  }

  if (MARKDOWN_HINT_RE.test(text) || TREE_LINE_RE.test(text)) {
    return 'markdown';
  }

  if (CODE_HINT_RE.test(text)) {
    return 'code';
  }

  return 'plain';
};

/** Returns true if the message contains markdown, code blocks, or tree graphs worth rich rendering. */
export const hasRichContent = (raw: string): boolean => detectContentKind(raw) !== 'plain';

const KEYWORDS_BY_LANG: Record<string, Set<string>> = {
  common: new Set([
    'import', 'export', 'from', 'default', 'const', 'let', 'var', 'function', 'return',
    'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'async', 'await',
    'try', 'catch', 'finally', 'throw', 'new', 'class', 'extends', 'implements', 'interface',
    'type', 'enum', 'public', 'private', 'protected', 'readonly', 'true', 'false', 'null',
    'undefined', 'def', 'elif', 'lambda', 'with', 'as', 'in', 'not', 'and', 'or', 'None',
    'True', 'False', 'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
    'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'ORDER', 'BY', 'LIMIT',
  ]),
};

const TYPE_HINT_RE = /^[A-Z][A-Za-z0-9_]*$/;

/** Tokenizes a single line of code into lightweight syntax-highlight tokens. */
export const tokenizeCodeLine = (line: string, lang = ''): CodeToken[] => {
  if (!line) return [{ type: 'plain', text: '' }];
  const tokens: CodeToken[] = [];
  const lowerLang = lang.toLowerCase();
  const isPythonOrShell =
    lowerLang === 'py' ||
    lowerLang === 'python' ||
    lowerLang === 'bash' ||
    lowerLang === 'sh' ||
    lowerLang === 'yaml' ||
    lowerLang === 'yml';
  const isSql = lowerLang === 'sql';

  let i = 0;
  const pushPlain = (text: string) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === 'plain') {
      last.text += text;
    } else {
      tokens.push({ type: 'plain', text });
    }
  };

  while (i < line.length) {
    const rest = line.slice(i);

    if (
      rest.startsWith('//') ||
      (isPythonOrShell && rest.startsWith('#')) ||
      (isSql && rest.startsWith('--'))
    ) {
      tokens.push({ type: 'comment', text: rest });
      break;
    }

    const quote = line[i];
    if (quote === '"' || quote === "'" || quote === '`') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ type: 'string', text: line.slice(i, j) });
      i = j;
      continue;
    }

    const numMatch = rest.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b/);
    if (numMatch && (i === 0 || !/[A-Za-z0-9_$]/.test(line[i - 1]))) {
      tokens.push({ type: 'number', text: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    const idMatch = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
    if (idMatch) {
      const word = idMatch[0];
      if (KEYWORDS_BY_LANG.common.has(word) || (isSql && KEYWORDS_BY_LANG.common.has(word.toUpperCase()))) {
        tokens.push({ type: 'keyword', text: word });
      } else if (TYPE_HINT_RE.test(word)) {
        tokens.push({ type: 'type', text: word });
      } else {
        pushPlain(word);
      }
      i += word.length;
      continue;
    }

    const opMatch = rest.match(/^(?:=>|===|!==|==|!=|<=|>=|&&|\|\||[=+\-*/<>!&|?:]+)/);
    if (opMatch) {
      tokens.push({ type: 'operator', text: opMatch[0] });
      i += opMatch[0].length;
      continue;
    }

    pushPlain(line[i]);
    i += 1;
  }

  return tokens;
};

const TABLE_SEP_RE = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;

const splitTableRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
};

/** Parses markdown text into structured blocks (headings, code, trees, tables, lists, blockquotes, paragraphs). */
export const parseMarkdownBlocks = (raw: string): MarkdownBlock[] => {
  const lines = normalizeNewlines(raw).split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fenceMatch = line.match(/^\s*```([A-Za-z0-9_+-]*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1].trim().toLowerCase();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const code = codeLines.join('\n');
      if (TREE_FENCE_LANGS.has(lang) || (!lang && isTreeLike(code))) {
        blocks.push({ kind: 'tree', raw: code, nodes: parseTree(code) });
      } else {
        blocks.push({ kind: 'code', lang, code });
      }
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: 'heading', level, text: headingMatch[2] });
      i += 1;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'blockquote', lines: quoteLines });
      continue;
    }

    const ulMatch = line.match(/^\s*[-*+]\s+(?:\[([ xX])\]\s+)?(.+)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = Boolean(olMatch);
      const items: { text: string; checked?: boolean }[] = [];
      while (i < lines.length) {
        const current = lines[i];
        if (ordered) {
          const m = current.match(/^\s*\d+\.\s+(.+)$/);
          if (!m) break;
          items.push({ text: m[1] });
        } else {
          const m = current.match(/^\s*[-*+]\s+(?:\[([ xX])\]\s+)?(.+)$/);
          if (!m) break;
          items.push({
            text: m[2],
            checked: m[1] !== undefined ? m[1].toLowerCase() === 'x' : undefined,
          });
        }
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    if (/[├└][─━]{1,3}\s+\S/.test(line) || (i + 1 < lines.length && /[├└][─━]{1,3}\s+\S/.test(lines[i + 1]))) {
      const treeLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        (treeLines.length === 0 || /[│|├└┌─━]/.test(lines[i]))
      ) {
        treeLines.push(lines[i]);
        i += 1;
      }
      const rawTree = treeLines.join('\n');
      if (isTreeLike(rawTree)) {
        blocks.push({ kind: 'tree', raw: rawTree, nodes: parseTree(rawTree) });
        continue;
      }
      blocks.push({ kind: 'paragraph', text: rawTree });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*(?:```|#{1,6}\s|>\s?|[-*+]\s|\d+\.\s|(?:---+|\*\*\*+|___+)\s*$)/.test(lines[i])
    ) {
      if (lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
        break;
      }
      paraLines.push(lines[i]);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
};

const INLINE_RE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\))/g;

/** Parses inline markdown tokens (code, bold, italic, strikethrough, and safe links). */
export const parseInlineMarkdown = (text: string): InlineSegment[] => {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, idx) });
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      segments.push({ kind: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      segments.push({ kind: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      segments.push({ kind: 'strike', text: token.slice(2, -2) });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      segments.push({ kind: 'italic', text: token.slice(1, -1) });
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch && isSafeUrl(linkMatch[2])) {
        segments.push({ kind: 'link', label: linkMatch[1], href: linkMatch[2] });
      } else {
        segments.push({ kind: 'text', text: token });
      }
    }
    lastIndex = idx + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments;
};
