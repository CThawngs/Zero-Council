import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, Copy, Check, Mail, FileDown } from 'lucide-react';

export const SessionConcludedView: React.FC = () => {
  const {
    currentSession,
    openFrameworkModal,
    openCounterDraftModal,
    showToast,
    language,
  } = useApp();

  const [copiedQuote, setCopiedQuote] = useState(false);

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(currentSession.synthesis.quote);
    setCopiedQuote(true);
    showToast(language === 'vi' ? 'Đã sao chép nhận định của The Chair' : 'Sample Chair synthesis copied');
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  const handleExportSynthesis = () => {
    const text = `# Deliberation Synthesis: ${currentSession.referenceCode}
Dilemma: ${currentSession.title}
Framework: ${currentSession.framework}

Sample recommendation:
${currentSession.synthesis.coreRecommendation}

Sample stipulations:
${currentSession.synthesis.stipulations.map((s) => `- ${s}`).join('\n')}

Trade-Off Calculus:
- Gross Deficit: ${currentSession.synthesis.tradeOffCalculus.grossDeficit}
- Effective Labor Rate: ${currentSession.synthesis.tradeOffCalculus.effectiveLaborRate}
- Reclaimed Hours: ${currentSession.synthesis.tradeOffCalculus.reclaimedHours}

Scenarios:
- Good: ${currentSession.scenarios.good.title}
- Normal: ${currentSession.scenarios.normal.title}
- Bad: ${currentSession.scenarios.bad.title}
`;
    navigator.clipboard.writeText(text);
    showToast(language === 'vi' ? 'Đã xuất biên bản nghị sự vào bộ nhớ tạm' : 'Sample synthesis exported to clipboard');
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8 text-left">
      {/* Session Title Header Strip */}
      <div className="p-6 rounded-lg bg-surface border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <span className="text-xs font-mono text-brass font-medium">Mock Deliberation Concluded</span>
            <span className="text-border">·</span>
            <span className="text-xs font-mono text-ink-muted">Ref: {currentSession.referenceCode}</span>
            <span className="text-border">·</span>
            <span className="text-xs text-ink-muted">{currentSession.relativeTime}</span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl md:text-3xl text-ink font-normal leading-snug">
            {currentSession.title}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={openFrameworkModal}
            type="button"
            className="px-3 py-2 rounded-md bg-background border border-border hover:border-brass/60 text-xs text-ink transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-brass" />
            <span>{currentSession.framework}</span>
          </button>

          <button
            onClick={openCounterDraftModal}
            type="button"
            className="px-3.5 py-2 rounded-md bg-brass text-background font-medium text-xs hover:bg-brass/90 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Draft Counter-Proposal</span>
          </button>

          <button
            onClick={handleExportSynthesis}
            type="button"
            className="p-2 rounded-md bg-background border border-border text-ink-muted hover:text-ink transition-colors"
            title="Export sample synthesis"
            aria-label="Export sample synthesis"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Baseline Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-md bg-surface border border-border">
          <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
            Baseline Cashflow
          </span>
          <span className="text-sm font-medium text-ink mt-0.5 block">
            {currentSession.baselineMetrics.baselineCashflow}
          </span>
        </div>

        <div className="p-3.5 rounded-md bg-surface border border-border">
          <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
            Base Adjustment
          </span>
          <span className="text-sm font-medium text-terracotta mt-0.5 block">
            {currentSession.baselineMetrics.baseAdjustment}
          </span>
        </div>

        <div className="p-3.5 rounded-md bg-surface border border-border">
          <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
            Location Model
          </span>
          <span className="text-sm font-medium text-sage mt-0.5 block">
            {currentSession.baselineMetrics.locationModel}
          </span>
        </div>

        <div className="p-3.5 rounded-md bg-surface border border-border">
          <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
            Commute Recovery
          </span>
          <span className="text-sm font-medium text-brass mt-0.5 block">
            {currentSession.baselineMetrics.commuteRecovery}
          </span>
        </div>
      </div>

      {/* The Chair's Executive Synthesis (Prominent Hero Card) */}
      <div className="p-6 sm:p-8 rounded-lg bg-surface border-2 border-brass/50 space-y-6 shadow-md relative overflow-hidden">
        {/* Subtle accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-brass" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brass/20 text-brass flex items-center justify-center font-serif text-sm font-semibold border border-brass/40">
              C
            </div>
            <div>
              <h2 className="font-serif text-lg text-ink font-normal">
                {currentSession.synthesis.chairTitle}
              </h2>
              <p className="text-xs text-ink-muted">{currentSession.synthesis.chairRole}</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-background border border-brass/40 text-brass font-medium self-start sm:self-center">
            {currentSession.synthesis.statusBadge}
          </span>
        </div>

        {/* Core Recommendation */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-brass">Sample Recommendation</span>
          <p className="font-serif text-lg sm:text-xl text-ink font-normal leading-relaxed">
            {currentSession.synthesis.coreRecommendation}
          </p>
        </div>

        {/* Stipulations List */}
        <div className="space-y-2.5 pt-2">
          <span className="text-xs font-medium text-ink-muted">Sample Stipulations</span>
          <div className="space-y-2">
            {currentSession.synthesis.stipulations.map((stip, idx) => (
              <div
                key={idx}
                className="p-3 rounded-md bg-background/80 border border-border flex items-start gap-3 text-xs text-ink"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brass mt-1.5 shrink-0" />
                <span className="leading-relaxed">{stip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade-Off Calculus Strip */}
        <div className="p-4 rounded-md bg-background border border-border space-y-3">
          <span className="text-xs font-medium text-ink-muted">Trade-Off Calculus</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[11px] text-ink-muted block">Gross Compensation</span>
              <span className="font-mono text-terracotta font-medium text-sm">
                {currentSession.synthesis.tradeOffCalculus.grossDeficit}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-ink-muted block">Effective Hourly Rate</span>
              <span className="font-mono text-sage font-medium text-sm">
                {currentSession.synthesis.tradeOffCalculus.effectiveLaborRate}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-ink-muted block">Reclaimed Time</span>
              <span className="font-mono text-brass font-medium text-sm">
                {currentSession.synthesis.tradeOffCalculus.reclaimedHours} / annum
              </span>
            </div>
          </div>
        </div>

        {/* Synthesis Quote */}
        <div className="p-4 rounded-md bg-background/50 border border-border/80 flex items-start justify-between gap-4">
          <p className="text-xs text-ink-muted italic leading-relaxed">
            &quot;{currentSession.synthesis.quote}&quot;
          </p>
          <button
            onClick={handleCopyQuote}
            type="button"
            className="p-1.5 rounded-md hover:bg-surface text-ink-muted hover:text-ink transition-colors shrink-0"
            title="Copy sample quote"
            aria-label="Copy sample quote"
          >
            {copiedQuote ? <Check className="w-3.5 h-3.5 text-sage" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Scenario Analysis (Strictly Good / Normal / Bad) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-serif text-lg text-ink font-normal">
              Probabilistic Scenario Matrix
            </h3>
            <p className="text-xs text-ink-muted">
              Illustrative branches from local sample conditions.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-surface border border-border text-ink-muted">
            Framework: Good / Normal / Bad
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Good Scenario */}
          <div className="p-5 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-sage">Good Scenario</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                  {currentSession.scenarios.good.subtitle}
                </span>
              </div>
              <h4 className="text-sm font-medium text-ink">
                {currentSession.scenarios.good.title}
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                {currentSession.scenarios.good.description}
              </p>
            </div>
            <div className="pt-3 border-t border-border space-y-1.5 text-xs">
              <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
                Sample Actions
              </span>
              {currentSession.scenarios.good.actions.map((act, i) => (
                <p key={i} className="text-ink text-[11px] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-sage" />
                  {act}
                </p>
              ))}
            </div>
          </div>

          {/* Normal Scenario */}
          <div className="p-5 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brass">Normal Scenario</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                  {currentSession.scenarios.normal.subtitle}
                </span>
              </div>
              <h4 className="text-sm font-medium text-ink">
                {currentSession.scenarios.normal.title}
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                {currentSession.scenarios.normal.description}
              </p>
            </div>
            <div className="pt-3 border-t border-border space-y-1.5 text-xs">
              <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
                Sample Actions
              </span>
              {currentSession.scenarios.normal.actions.map((act, i) => (
                <p key={i} className="text-ink text-[11px] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-brass" />
                  {act}
                </p>
              ))}
            </div>
          </div>

          {/* Bad Scenario */}
          <div className="p-5 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-terracotta">Bad Scenario</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                  {currentSession.scenarios.bad.subtitle}
                </span>
              </div>
              <h4 className="text-sm font-medium text-ink">
                {currentSession.scenarios.bad.title}
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                {currentSession.scenarios.bad.description}
              </p>
            </div>
            <div className="pt-3 border-t border-border space-y-1.5 text-xs">
              <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
                Sample Triggers
              </span>
              {currentSession.scenarios.bad.actions.map((act, i) => (
                <p key={i} className="text-ink text-[11px] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-terracotta" />
                  {act}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Advisor Testimonies Accordion/Grid */}
      <div className="space-y-4">
        <h3 className="font-serif text-lg text-ink font-normal">
          Sample Council Testimonies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentSession.testimonies.map((testimony) => {
            const advisor = currentSession.advisors.find((a) => a.id === testimony.advisorId);
            const colorToken = advisor?.colorToken || 'persona-sage';
            return (
              <div
                key={testimony.advisorId}
                className="p-5 rounded-lg bg-surface border border-border space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          colorToken === 'persona-sage'
                            ? 'bg-persona-sage'
                            : colorToken === 'persona-rose'
                            ? 'bg-persona-rose'
                            : colorToken === 'persona-ochre'
                            ? 'bg-persona-ochre'
                            : 'bg-persona-slate'
                        }`}
                      />
                      <span className="text-xs font-medium text-ink">{testimony.heading}</span>
                    </div>
                    <span className="text-[10px] text-ink-muted font-mono">{advisor?.model}</span>
                  </div>
                  <p className="text-xs text-ink leading-relaxed">
                    {testimony.primaryText}
                  </p>
                </div>

                <div className="p-2.5 rounded-md bg-background border border-border text-[11px] text-ink-muted">
                  <span className="text-[10px] block text-ink-muted/80 font-mono uppercase">
                    {testimony.metricLabel}
                  </span>
                  <span className="text-ink font-medium mt-0.5 block">{testimony.metricValue}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
