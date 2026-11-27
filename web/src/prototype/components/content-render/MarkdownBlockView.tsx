'use client';

/**
 * Safe structured Markdown block and inline segment renderer for ContentRenderPanel.
 */

import React from 'react';
import { parseInlineMarkdown, type MarkdownBlock } from '../../chat/content-render';
import { CodeBlockView } from './CodeBlockView';
import { TreeGraphView } from './TreeGraphView';

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

export const MarkdownBlockView: React.FC<{
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
            <li
              key={i}
              className={item.checked !== undefined ? 'list-none -ml-4 flex items-start gap-2' : ''}
            >
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
