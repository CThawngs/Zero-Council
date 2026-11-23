'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  GitFork,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import {
  countTreeNodes,
  detectContentKind,
  parseInlineMarkdown,
  parseMarkdownBlocks,
  parseTree,
  tokenizeCodeLine,
  unwrapSingleFence,
  type CodeTokenType,
  type ContentMode,
  type ContentPanelPayload,
  type MarkdownBlock,
  type TreeNode,
} from '../chat/content-render';
import { Modal } from './Modal';
import { useApp } from '../context/AppContext';

export interface ContentRenderPanelProps {
  content: string;
  title?: string;
  mode?: ContentMode;
  language?: string;
  compact?: boolean;
  showHeader?: boolean;
  onOpenModal?: (payload: ContentPanelPayload) => void;
  renderMentionText?: (plain: string) => React.ReactNode;
  className?: string;
}

const TOKEN_CLASS: Record<CodeTokenType, string> = {
  keyword: 'font-semibold text-brass',
  string: 'text-sage',
  comment: 'italic text-ink-muted',
  number: 'text-terracotta',
  type: 'font-medium text-ink',
  operator: 'text-ink-muted',
  plain: 'text-ink',
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const scratch = document.createElement('textarea');
      scratch.value = text;
      scratch.style.position = 'fixed';
      scratch.style.opacity = '0';
      document.body.appendChild(scratch);
      scratch.select();
      document.execCommand('copy');
      document.body.removeChild(scratch);
      return true;
    } catch {
      return false;
    }
  }
};

const InlineContent: React.FC<{
  text: string;
  renderMentionText?: (plain: string) => React.ReactNode;
}> = ({ text, renderMentionText }) => {
  const segments = parseInlineMarkdown(text);
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === 'bold') {
          return (
            <strong key={idx} className="font-semibold">
              {renderMentionText ? renderMentionText(seg.text) : seg.text}
            </strong>
          );
        }
        if (seg.kind === 'italic') {
          return (
            <em key={idx} className="italic">
              {renderMentionText ? renderMentionText(seg.text) : seg.text}
            </em>
          );
        }
        if (seg.kind === 'strike') {
          return (
            <del key={idx} className="opacity-70">
              {seg.text}
            </del>
          );
        }
        if (seg.kind === 'code') {
          return (
            <code
              key={idx}
              className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.86em] text-ink"
            >
              {seg.text}
            </code>
          );
        }
        if (seg.kind === 'link') {
          return (
            <a
              key={idx}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-current/45 underline-offset-2 hover:decoration-current"
            >
              {seg.label}
            </a>
          );
        }
        return (
          <React.Fragment key={idx}>
            {renderMentionText ? renderMentionText(seg.text) : seg.text}
          </React.Fragment>
        );
      })}
    </>
  );
};

const CodeBlockView: React.FC<{
  code: string;
  language?: string;
  compact?: boolean;
}> = ({ code, language = '', compact = false }) => {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => code.replace(/\r\n?/g, '\n').split('\n'), [code]);

  const handleCopy = async () => {
    if (await copyTextToClipboard(code)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/85 text-ink">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/80 px-3 py-1.5 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-wider">
          <Code2 className="h-3.5 w-3.5 text-brass" aria-hidden="true" />
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition hover:bg-brass/10 hover:text-ink"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-sage" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className={`overflow-x-auto ${compact ? 'max-h-72' : 'max-h-[32rem]'}`}>
        <pre className="p-3 font-mono text-xs leading-relaxed">
          <code>
            {lines.map((line, idx) => {
              const tokens = tokenizeCodeLine(line, language);
              return (
                <div key={idx} className="flex min-w-0">
                  <span
                    aria-hidden="true"
                    className="mr-3 w-7 shrink-0 select-none text-right text-[11px] text-ink-muted/60"
                  >
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre">
                    {tokens.map((tok, tIdx) => (
                      <span key={tIdx} className={TOKEN_CLASS[tok.type]}>
                        {tok.text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
};

const collectBranchIds = (nodes: TreeNode[]): string[] => {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id);
      ids.push(...collectBranchIds(node.children));
    }
  }
  return ids;
};

const TreeNodeItem: React.FC<{
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}> = ({ node, depth, collapsed, onToggle }) => {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);

  return (
    <li className="relative">
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={!isCollapsed}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-surface text-ink-muted transition hover:border-brass hover:text-ink"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brass/70" />
          </span>
        )}
        <span className="rounded-md border border-border/80 bg-surface px-2 py-0.5 font-mono text-xs text-ink">
          {node.label}
        </span>
        {node.meta && (
          <span className="rounded-full bg-brass/10 px-2 py-0.5 text-[11px] font-medium text-brass">
            {node.meta}
          </span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="ml-2.5 border-l border-border/80 pl-3.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const TreeGraphView: React.FC<{
  raw: string;
  nodes?: TreeNode[];
  compact?: boolean;
}> = ({ raw, nodes: preParsed, compact = false }) => {
  const nodes = useMemo(() => preParsed ?? parseTree(raw), [preParsed, raw]);
  const branchIds = useMemo(() => collectBranchIds(nodes), [nodes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const totalCount = useMemo(() => countTreeNodes(nodes), [nodes]);

  const toggleNode = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nodes.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs text-ink-muted">
        No tree structure detected.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/85">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/80 px-3 py-1.5 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <GitFork className="h-3.5 w-3.5 text-brass" aria-hidden="true" />
          Tree ({totalCount})
        </span>
        {branchIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed(new Set())}
              className="rounded px-2 py-0.5 transition hover:bg-brass/10 hover:text-ink"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(new Set(branchIds))}
              className="rounded px-2 py-0.5 transition hover:bg-brass/10 hover:text-ink"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>
      <div className={`overflow-x-auto p-3 ${compact ? 'max-h-72' : 'max-h-[32rem]'}`}>
        <ul className="space-y-0.5">
          {nodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              collapsed={collapsed}
              onToggle={toggleNode}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

const MarkdownBlockView: React.FC<{
  block: MarkdownBlock;
  compact?: boolean;
  renderMentionText?: (plain: string) => React.ReactNode;
}> = ({ block, compact, renderMentionText }) => {
  switch (block.kind) {
    case 'heading': {
      const sizeClass =
        block.level === 1
          ? 'text-lg sm:text-xl'
          : block.level === 2
            ? 'text-base sm:text-lg'
            : 'text-sm sm:text-base';
      return (
        <h4 className={`font-serif font-bold tracking-tight ${sizeClass}`}>
          <InlineContent text={block.text} renderMentionText={renderMentionText} />
        </h4>
      );
    }
    case 'code':
      return <CodeBlockView code={block.code} language={block.lang} compact={compact} />;
    case 'tree':
      return <TreeGraphView raw={block.raw} nodes={block.nodes} compact={compact} />;
    case 'blockquote':
      return (
        <blockquote className="space-y-1 border-l-2 border-brass/60 pl-3 text-sm italic text-ink-muted">
          {block.lines.map((line, i) => (
            <p key={i}>
              <InlineContent text={line} renderMentionText={renderMentionText} />
            </p>
          ))}
        </blockquote>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={`space-y-1 pl-5 text-sm leading-relaxed ${
            block.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {block.items.map((item, i) => (
            <li key={i} className={item.checked !== undefined ? 'list-none -ml-4 flex items-start gap-2' : ''}>
              {item.checked !== undefined && (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  aria-label={item.text}
                  className="mt-1 h-3.5 w-3.5 accent-brass"
                />
              )}
              <span>
                <InlineContent text={item.text} renderMentionText={renderMentionText} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-border bg-background/70">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2/80">
                {block.headers.map((header, i) => (
                  <th key={i} className="px-3 py-2 font-semibold text-ink">
                    <InlineContent text={header} renderMentionText={renderMentionText} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-border/60 last:border-b-0">
                  {block.headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-ink-muted">
                      <InlineContent
                        text={row[cIdx] ?? ''}
                        renderMentionText={renderMentionText}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'hr':
      return <hr className="border-border" />;
    case 'paragraph':
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          <InlineContent text={block.text} renderMentionText={renderMentionText} />
        </p>
      );
  }
};

export const ContentRenderPanel: React.FC<ContentRenderPanelProps> = ({
  content,
  title,
  mode: initialMode = 'auto',
  language,
  compact = false,
  showHeader = true,
  onOpenModal,
  renderMentionText,
  className = '',
}) => {
  const [mode, setMode] = useState<ContentMode>(initialMode);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const detectedKind = useMemo(
    () => detectContentKind(content, language),
    [content, language]
  );

  const effectiveMode: Exclude<ContentMode, 'auto'> =
    mode === 'auto'
      ? detectedKind === 'plain'
        ? 'markdown'
        : detectedKind
      : mode;

  const unwrapped = useMemo(() => unwrapSingleFence(content), [content]);
  const markdownBlocks = useMemo(
    () => (effectiveMode === 'markdown' ? parseMarkdownBlocks(content) : []),
    [content, effectiveMode]
  );

  const handleCopyAll = async () => {
    if (await copyTextToClipboard(content)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const modeOptions: { id: ContentMode; label: string; icon: React.ReactNode }[] = [
    { id: 'auto', label: 'Auto', icon: <Sparkles className="h-3 w-3" aria-hidden="true" /> },
    { id: 'markdown', label: 'MD', icon: <FileText className="h-3 w-3" aria-hidden="true" /> },
    { id: 'code', label: 'Code', icon: <Code2 className="h-3 w-3" aria-hidden="true" /> },
    { id: 'tree', label: 'Tree', icon: <GitFork className="h-3 w-3" aria-hidden="true" /> },
    { id: 'raw', label: 'Raw', icon: null },
  ];

  const body = (
    <div className="space-y-3">
      {effectiveMode === 'code' && (
        <CodeBlockView
          code={unwrapped.body}
          language={language || unwrapped.lang}
          compact={compact}
        />
      )}
      {effectiveMode === 'tree' && <TreeGraphView raw={content} compact={compact} />}
      {effectiveMode === 'raw' && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background/85 p-3 font-mono text-xs leading-relaxed text-ink">
          {content}
        </pre>
      )}
      {effectiveMode === 'markdown' && (
        <div className="space-y-3">
          {markdownBlocks.map((block, idx) => (
            <MarkdownBlockView
              key={idx}
              block={block}
              compact={compact}
              renderMentionText={renderMentionText}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (!showHeader) {
    return <div className={className}>{body}</div>;
  }

  return (
    <section
      aria-label={title || 'Content panel'}
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/70 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {title && <h3 className="truncate font-serif text-sm font-bold text-ink">{title}</h3>}
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {detectedKind}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="Render mode" className="flex items-center rounded-lg border border-border bg-background p-0.5">
            {modeOptions.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(opt.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'bg-brass text-[var(--color-accent-ink)]'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
          >
            {copied ? <Check className="h-3 w-3 text-sage" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {onOpenModal && (
            <button
              type="button"
              onClick={() =>
                onOpenModal({
                  title,
                  content,
                  mode: effectiveMode,
                  language: language || unwrapped.lang,
                })
              }
              aria-label="Open in panel"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
            >
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <div className="p-4">{body}</div>
    </section>
  );
};

export const ContentPanelModal: React.FC = () => {
  const { contentPanel, closeContentPanel, t } = useApp();

  return (
    <Modal
      isOpen={contentPanel !== null}
      onClose={closeContentPanel}
      title={contentPanel?.title || t.contentPanelTitle}
      closeLabel={t.contentPanelClose}
      className="max-w-4xl"
    >
      {contentPanel && (
        <ContentRenderPanel
          content={contentPanel.content}
          title={contentPanel.title}
          mode={contentPanel.mode ?? 'auto'}
          language={contentPanel.language}
        />
      )}
    </Modal>
  );
};
