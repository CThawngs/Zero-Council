/**
 * Shared data structures for rich content rendering (Markdown blocks, syntax tokens, tree nodes).
 */

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
