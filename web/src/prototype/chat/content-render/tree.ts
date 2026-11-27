/**
 * Zero-dependency tree parser supporting ASCII/Unicode box-drawing trees, Mermaid graphs,
 * hierarchical JSON objects, and indented outlines.
 */

import type { TreeNode } from './types.ts';

export const TREE_LINE_RE = /(?:^|\n)\s*(?:[│|]\s*)*[├└┌][─━]{1,3}\s+\S/;
export const MERMAID_HEADER_RE = /^\s*(?:graph|flowchart)\s+(?:TD|TB|BT|RL|LR)\b|^\s*mindmap\b/i;
const MERMAID_EDGE_RE =
  /^\s*([A-Za-z0-9_.-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?\s*(?:-->|==>|-.->|---)\s*(?:\|([^|]+)\|\s*)?([A-Za-z0-9_.-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?\s*;?\s*$/;

export const TREE_FENCE_LANGS = new Set(['tree', 'ascii-tree', 'dir', 'directory', 'mermaid']);

/** Normalizes CRLF/CR line endings to LF. */
export const normalizeNewlines = (input: string): string => input.replace(/\r\n?/g, '\n');

/** Unwraps a single outer fenced block when rendering in explicit Code or Tree mode. */
export const unwrapSingleFence = (raw: string): { lang: string; body: string } => {
  const text = normalizeNewlines(raw).trim();
  const match = text.match(/^```([A-Za-z0-9_+-]*)\n([\s\S]*?)\n```\s*$/);
  if (match && !match[2].includes('\n```')) {
    return { lang: match[1].trim().toLowerCase(), body: match[2] };
  }
  return { lang: '', body: normalizeNewlines(raw) };
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
    const meta =
      typeof record.type === 'string'
        ? record.type
        : typeof record.meta === 'string'
          ? record.meta
          : undefined;
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

/** Parses ASCII/Unicode box trees, JSON objects, Mermaid graphs, or indented outlines into `TreeNode[]`. */
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
