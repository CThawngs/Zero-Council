'use client';

/**
 * Multi-mode content renderer (Auto, Markdown, Code, Tree, Raw) and expandable modal shell.
 */

import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, FileText, GitFork, Maximize2, Sparkles } from 'lucide-react';
import {
  detectContentKind,
  parseMarkdownBlocks,
  unwrapSingleFence,
  type ContentMode,
  type ContentPanelPayload,
} from '../chat/content-render';
import { copy } from '../i18n';
import { Modal } from './Modal';
import { useApp, useOptionalApp } from '../context/AppContext';
import { CodeBlockView, copyTextToClipboard } from './content-render/CodeBlockView';
import { MarkdownBlockView } from './content-render/MarkdownBlockView';
import { TreeGraphView } from './content-render/TreeGraphView';

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
  const app = useOptionalApp();
  const t = app?.t ?? copy.en;
  const [modeOverride, setModeOverride] = useState<{
    forInitial: ContentMode;
    value: ContentMode;
  } | null>(null);
  const mode =
    modeOverride && modeOverride.forInitial === initialMode ? modeOverride.value : initialMode;
  const [copied, setCopied] = useState(false);

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
    } else {
      app?.showToast('toastCopyFailed');
    }
  };

  const modeOptions: { id: ContentMode; label: string; icon: React.ReactNode }[] = [
    {
      id: 'auto',
      label: t.contentPanelModeAuto,
      icon: <Sparkles className="h-3 w-3" aria-hidden="true" />,
    },
    {
      id: 'markdown',
      label: t.contentPanelModeMd,
      icon: <FileText className="h-3 w-3" aria-hidden="true" />,
    },
    {
      id: 'code',
      label: t.contentPanelModeCode,
      icon: <Code2 className="h-3 w-3" aria-hidden="true" />,
    },
    {
      id: 'tree',
      label: t.contentPanelModeTree,
      icon: <GitFork className="h-3 w-3" aria-hidden="true" />,
    },
    { id: 'raw', label: t.contentPanelModeRaw, icon: null },
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
      aria-label={title || t.contentPanelTitle}
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
          <div
            role="group"
            aria-label={t.contentPanelRenderMode}
            className="flex flex-wrap items-center rounded-lg border border-border bg-background p-0.5"
          >
            {modeOptions.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setModeOverride({ forInitial: initialMode, value: opt.id })}
                  className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
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
            onClick={() => void handleCopyAll()}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
          >
            {copied ? (
              <Check className="h-3 w-3 text-sage" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{copied ? t.contentPanelCopied : t.contentPanelCopy}</span>
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
              aria-label={t.contentPanelOpen}
              className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
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
