export type ContentMode = 'auto' | 'markdown' | 'code' | 'tree' | 'raw';

export type ResolvedContentKind = 'markdown' | 'code' | 'tree' | 'plain';

export interface ContentPanelPayload {
  title?: string;
  content: string;
  mode?: ContentMode;
  language?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  meta?: string;
  children: TreeNode[];
}

export type CodeTokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'type'
  | 'operator'
  | 'plain';

export interface CodeToken {
  type: CodeTokenType;
  text: string;
}

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'strike'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; label: string; href: string };

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'tree'; raw: string; nodes: TreeNode[] }
  | { kind: 'blockquote'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: { text: string; checked?: boolean }[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'hr' }
  | { kind: 'paragraph'; text: string };

const TREE_LINE_RE = /(?:^|\n)\s*(?:[│|]\s*)*[├└┌][─━]{1,3}\s+\S/;
const MERMAID_HEADER_RE = /^\s*(?:graph|flowchart)\s+(?:TD|TB|BT|RL|LR)\b|^\s*mindmap\b/i;
const MERMAID_EDGE_RE = /^\s*([A-Za-z0-9_.-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?\s*(?:-->|==>|-.->|---)\s*(?:\|([^|]+)\|\s*)?([A-Za-z0-9_.-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?\s*;?\s*$/;

const CODE_HINT_RE =
  /^\s*(?:#!\/|import\s+.+\s+from\s+['"]|export\s+(?:default|const|function|class|interface|type)\s+|(?:async\s+)?function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=|def\s+\w+\s*\(|class\s+\w+\s*[:({]|SELECT\s+.+\s+FROM\s+|<\?php|<![Dd][Oo][Cc][Tt][Yy][Pp][Ee]|<\/?[a-zA-Z][\w-]*[\s>])/;

const MARKDOWN_HINT_RE =
  /(?:^|\n)\s*(?:#{1,6}\s+\S|```|>\s+\S|[-*+]\s+\S|\d+\.\s+\S|---+\s*$)|(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:|\/|#)[^)\s]+\))/;

const TREE_FENCE_LANGS = new Set(['tree', 'ascii-tree', 'dir', 'directory', 'mermaid']);

/** Normalizes CRLF/CR line endings to LF. */
export const normalizeNewlines = (input: string): string => input.replace(/\r\n?/g, '\n');

/** Checks whether a URL is safe to render as an interactive anchor. */
export const isSafeUrl = (href: string): boolean => {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  return /^(?:https?:|mailto:)/i.test(trimmed);
};

/** Returns true when content appears to be a standalone box-drawing, Mermaid, or JSON tree. */
export const isTreeLike = (raw: string): boolean => {
  const text = normalizeNewlines(raw).trim();
  if (!text) return false;
  const boxLines = text.split('\n').filter((line) => /[├└][─━]{1,3}\s+\S/.test(line));
  if (boxLines.length >= 2) return true;
  if (MERMAID_HEADER_RE.test(text)) return true;
  if (
    (text.startsWith('{') || text.startsWith('[')) &&
    /"children"\s*:/.test(text)
  ) {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
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

  // Single fenced block wrapping the entire payload
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

/** Unwraps a single outer fenced block when rendering in explicit Code or Tree mode. */
export const unwrapSingleFence = (raw: string): { lang: string; body: string } => {
  const text = normalizeNewlines(raw).trim();
  const match = text.match(/^```([A-Za-z0-9_+-]*)\n([\s\S]*?)\n```\s*$/);
  if (match && !match[2].includes('\n```')) {
    return { lang: match[1].trim().toLowerCase(), body: match[2] };
  }
  return { lang: '', body: normalizeNewlines(raw) };
};

// ---------------------------------------------------------------------------
// Tree Graph Parser (Box-drawing, JSON, Mermaid, Indented Outline)
// ---------------------------------------------------------------------------

const parseBoxDrawingTree = (lines: string[]): TreeNode[] => {
  const roots: TreeNode[] = [];
  const stack: { depth: number; node: TreeNode }[] = [];
  let seq = 0;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const branchMatch = rawLine.match(/^([│|\s]*)(?:[├└┌][─━]{1,3}\s*)(.+)$/);
    const depth = branchMatch
      ? Math.floor(branchMatch[1].replace(/│|\|/g, ' ').length / 2) + 1
      : 0;
    const label = (branchMatch ? branchMatch[2] : rawLine.trim()).trim();
    if (!label) continue;

    const node: TreeNode = { id: `tree-${seq++}`, label, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ depth, node });
  }

  return roots;
};

const jsonToTree = (value: unknown, label: string, counter: { n: number }): TreeNode => {
  const id = `tree-${counter.n++}`;
  if (value === null || typeof value !== 'object') {
    return { id, label, meta: String(value), children: [] };
  }

  if (Array.isArray(value)) {
    return {
      id,
      label,
      meta: `[${value.length}]`,
      children: value.map((item, idx) => jsonToTree(item, `[${idx}]`, counter)),
    };
  }

  const record = value as Record<string, unknown>;
  const explicitLabel =
    typeof record.label === 'string'
      ? record.label
      : typeof record.name === 'string'
        ? record.name
        : typeof record.title === 'string'
          ? record.title
          : null;

  if (explicitLabel && Array.isArray(record.children)) {
    const meta = typeof record.type === 'string' ? record.type : typeof record.meta === 'string' ? record.meta : undefined;
    return {
      id,
      label: explicitLabel,
      meta,
      children: record.children.map((child, idx) =>
        jsonToTree(child, `item-${idx}`, counter)
      ),
    };
  }

  return {
    id,
    label,
    children: Object.entries(record).map(([key, val]) => jsonToTree(val, key, counter)),
  };
};

const parseMermaidTree = (lines: string[]): TreeNode[] => {
  const labels = new Map<string, string>();
  const childrenMap = new Map<string, { target: string; edgeLabel?: string }[]>();
  const inDegree = new Map<string, number>();
  const order: string[] = [];

  const ensureNode = (id: string, lbl?: string) => {
    if (!labels.has(id)) {
      labels.set(id, lbl || id);
      order.push(id);
    } else if (lbl) {
      labels.set(id, lbl);
    }
    if (!inDegree.has(id)) inDegree.set(id, 0);
  };

  for (const line of lines) {
    const match = line.match(MERMAID_EDGE_RE);
    if (!match) continue;
    const fromId = match[1];
    const fromLabel = match[2] ?? match[3] ?? match[4];
    const edgeLabel = match[5]?.trim();
    const toId = match[6];
    const toLabel = match[7] ?? match[8] ?? match[9];

    ensureNode(fromId, fromLabel);
    ensureNode(toId, toLabel);
    inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1);
    const list = childrenMap.get(fromId) ?? [];
    list.push({ target: toId, edgeLabel });
    childrenMap.set(fromId, list);
  }

  if (order.length === 0) return [];

  const rootIds = order.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const starts = rootIds.length > 0 ? rootIds : [order[0]];
  let seq = 0;

  const build = (id: string, meta: string | undefined, ancestors: Set<string>): TreeNode => {
    const node: TreeNode = {
      id: `tree-${seq++}-${id}`,
      label: labels.get(id) ?? id,
      meta,
      children: [],
    };
    if (ancestors.has(id)) {
      node.meta = meta ? `${meta} (cycle)` : 'cycle';
      return node;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(id);
    for (const edge of childrenMap.get(id) ?? []) {
      node.children.push(build(edge.target, edge.edgeLabel, nextAncestors));
    }
    return node;
  };

  return starts.map((id) => build(id, undefined, new Set()));
};

const parseIndentedTree = (lines: string[]): TreeNode[] => {
  const roots: TreeNode[] = [];
  const stack: { indent: number; node: TreeNode }[] = [];
  let seq = 0;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const expanded = rawLine.replace(/\t/g, '  ');
    const indent = expanded.length - expanded.trimStart().length;
    const label = expanded.trim().replace(/^[-*+]\s+/, '');
    if (!label) continue;

    const node: TreeNode = { id: `tree-${seq++}`, label, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ indent, node });
  }

  return roots;
};

/** Parses ASCII/Unicode box trees, JSON objects, Mermaid graphs, or indented outlines into TreeNode[]. */
export const parseTree = (raw: string): TreeNode[] => {
  const { lang, body } = unwrapSingleFence(raw);
  const text = body.trim();
  if (!text) return [];

  if (lang === 'json' || text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const counter = { n: 0 };
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => jsonToTree(item, `[${idx}]`, counter));
      }
      return [jsonToTree(parsed, 'root', counter)];
    } catch {
      // Fall through to line-based tree parsing.
    }
  }

  const lines = text.split('\n');
  if (MERMAID_HEADER_RE.test(text) || lines.some((l) => MERMAID_EDGE_RE.test(l))) {
    const mermaidNodes = parseMermaidTree(lines);
    if (mermaidNodes.length > 0) return mermaidNodes;
  }

  if (lines.some((l) => /[├└┌][─━]{1,3}\s+\S/.test(l))) {
    return parseBoxDrawingTree(lines);
  }

  return parseIndentedTree(lines);
};

/** Counts total nodes in a tree forest. */
export const countTreeNodes = (nodes: TreeNode[]): number =>
  nodes.reduce((sum, node) => sum + 1 + countTreeNodes(node.children), 0);

// ---------------------------------------------------------------------------
// Syntax Tokenizer (Zero-Dependency)
// ---------------------------------------------------------------------------

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
  const isPythonOrShell = lowerLang === 'py' || lowerLang === 'python' || lowerLang === 'bash' || lowerLang === 'sh' || lowerLang === 'yaml' || lowerLang === 'yml';
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

    // Line comments
    if (
      rest.startsWith('//') ||
      (isPythonOrShell && rest.startsWith('#')) ||
      (isSql && rest.startsWith('--'))
    ) {
      tokens.push({ type: 'comment', text: rest });
      break;
    }

    // Strings ('...', "...", `...`)
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

    // Numbers
    const numMatch = rest.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b/);
    if (numMatch && (i === 0 || !/[A-Za-z0-9_$]/.test(line[i - 1]))) {
      tokens.push({ type: 'number', text: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    // Identifiers / Keywords / Types
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

    // Operators & punctuation
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

// ---------------------------------------------------------------------------
// Markdown Block & Inline Parser (Zero-Dependency)
// ---------------------------------------------------------------------------

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

    // Skip blank lines
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code block
    const fenceMatch = line.match(/^\s*```([A-Za-z0-9_+-]*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1].trim().toLowerCase();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // consume closing ```
      const code = codeLines.join('\n');
      if (TREE_FENCE_LANGS.has(lang) || (!lang && isTreeLike(code))) {
        blocks.push({ kind: 'tree', raw: code, nodes: parseTree(code) });
      } else {
        blocks.push({ kind: 'code', lang, code });
      }
      continue;
    }

    // Horizontal rule
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: 'heading', level, text: headingMatch[2] });
      i += 1;
      continue;
    }

    // Markdown table
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

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'blockquote', lines: quoteLines });
      continue;
    }

    // Unordered or ordered list
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

    // Standalone ASCII tree block embedded in markdown
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

    // Paragraph (collect contiguous plain lines)
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

/** Parses inline markdown tokens (code, bold, italic, strike, safe links). */
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
