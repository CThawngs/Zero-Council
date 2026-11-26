'use client';

/**
 * Syntax-highlighted code block viewer and clipboard helper for ContentRenderPanel.
 */

import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy } from 'lucide-react';
import { tokenizeCodeLine, type CodeTokenType } from '../../chat/content-render';
import { copy } from '../../i18n';
import { useOptionalApp } from '../../context/AppContext';

const TOKEN_CLASS: Record<CodeTokenType, string> = {
  keyword: 'font-semibold text-brass',
  string: 'text-sage',
  comment: 'italic text-ink-muted',
  number: 'text-terracotta',
  type: 'font-medium text-ink',
  operator: 'text-ink-muted',
  plain: 'text-ink',
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
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
      const copiedOk = document.execCommand('copy');
      document.body.removeChild(scratch);
      return copiedOk;
    } catch {
      return false;
    }
  }
};

export const CodeBlockView: React.FC<{
  code: string;
  language?: string;
  compact?: boolean;
}> = ({ code, language = '', compact = false }) => {
  const app = useOptionalApp();
  const t = app?.t ?? copy.en;
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => code.replace(/\r\n?/g, '\n').split('\n'), [code]);

  const handleCopy = async () => {
    if (await copyTextToClipboard(code)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      app?.showToast('toastCopyFailed');
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/85 text-ink">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/80 px-3 py-1.5 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-wider">
          <Code2 className="h-3.5 w-3.5 text-brass" aria-hidden="true" />
          {language || t.contentPanelCodeLabel}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-7 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition hover:bg-brass/10 hover:text-ink"
          aria-label={t.contentPanelCopyCode}
        >
          {copied ? (
            <Check className="h-3 w-3 text-sage" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{copied ? t.contentPanelCopied : t.contentPanelCopy}</span>
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
