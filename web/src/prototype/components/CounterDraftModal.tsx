import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Copy, Check, Mail } from 'lucide-react';

export const CounterDraftModal: React.FC = () => {
  const { isCounterDraftModalOpen, closeCounterDraftModal, currentSession, showToast, language } = useApp();
  const [copied, setCopied] = useState(false);

  if (!isCounterDraftModalOpen) return null;

  const defaultDraft = `Subject: Reflecting on the Remote Offer — Alignment on Benchmarks & Setup

Dear Hiring Team,

Thank you for extending this offer. I have carefully reviewed the scope and am very excited about the collaborative potential and mission of the team.

To ensure long-term mutual success and clarity of execution under a remote arrangement, I would like to propose two structured stipulations:

1. Performance & Compensation Benchmark: A formal 6-month performance review to benchmark deliverables against pre-agreed impact milestones, with the intent of realigning baseline compensation to metropolitan parity.

2. Infrastructure & Home Office Stipend: A one-time allowance of $2,500 to guarantee dedicated ergonomic equipment and redundant connectivity.

With these parameters confirmed, I am fully prepared to sign and establish our start date.

Warm regards,
[Your Name]`;

  const handleCopy = () => {
    navigator.clipboard.writeText(defaultDraft);
    setCopied(true);
    showToast(language === 'vi' ? 'Đã sao chép thư đề xuất vào bộ nhớ tạm' : 'Counter-proposal copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-md bg-brass/10 border border-brass/20 text-brass">
              <Mail className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-serif text-lg text-ink font-normal">Executive Counter-Draft</h3>
              <p className="text-xs text-ink-muted">
                Sample draft generated from local fixture {currentSession.referenceCode}; no advisor or model ran.
              </p>
            </div>
          </div>
          <button
            onClick={closeCounterDraftModal}
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-background transition-colors"
            type="button"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close sample counter-draft preview</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3 rounded-md bg-background border border-border flex items-center justify-between text-xs">
            <span className="text-ink-muted">Negotiation Strategy:</span>
            <span className="text-brass font-medium">Asymmetric Value Preservation</span>
          </div>

          <div>
            <label htmlFor="counter-draft-preview" className="block text-xs font-medium text-ink-muted mb-1.5">
              Draft Dispatch Preview
            </label>
            <textarea
              id="counter-draft-preview"
              name="counter-draft-preview"
              readOnly
              rows={12}
              value={defaultDraft}
              className="w-full p-4 rounded-md bg-background border border-border text-xs text-ink font-mono leading-relaxed focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-background/50 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted">
            Local sample draft only. No advisor or model generated these clauses.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={closeCounterDraftModal}
              type="button"
              className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={handleCopy}
              type="button"
              className="px-4 py-2 rounded-md bg-brass text-background font-medium text-xs hover:bg-brass/90 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy to Clipboard'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
