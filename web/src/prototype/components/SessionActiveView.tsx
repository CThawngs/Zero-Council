import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, CheckCircle2 } from 'lucide-react';

export const SessionActiveView: React.FC = () => {
  const { currentSession, setCurrentView, openFrameworkModal } = useApp();
  const [activeRound, setActiveRound] = useState(1);

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6 text-left">
      {/* Session Header Strip */}
      <div className="p-5 rounded-lg bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sage animate-ping" />
            <span className="text-xs font-mono text-sage font-medium">Mock Deliberation Preview</span>
            <span className="text-border">·</span>
            <span className="text-xs font-mono text-ink-muted">Ref: {currentSession.referenceCode}</span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl text-ink font-normal">
            {currentSession.title}
          </h1>
        </div>

        {/* Framework & Conclude CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={openFrameworkModal}
            type="button"
            className="px-3 py-2 rounded-md bg-background border border-border hover:border-brass/60 text-xs text-ink transition-colors flex items-center gap-2"
          >
            <Layers className="w-3.5 h-3.5 text-brass" />
            <span className="font-medium">{currentSession.framework}</span>
          </button>

          <button
            onClick={() => setCurrentView('session-concluded')}
            type="button"
            className="px-4 py-2 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors shadow-xs"
          >
            Preview Consensus
          </button>
        </div>
      </div>

      {/* Sample round selector */}
      <div className="flex items-center justify-between p-3 rounded-md bg-surface/60 border border-border text-xs">
        <div className="flex items-center gap-2">
          <span className="text-ink-muted">Deliberation Stage:</span>
          <span className="font-medium text-ink">
            {activeRound === 1
              ? 'Round 1 of 3: Sample Advisor Testimonies'
              : activeRound === 2
              ? 'Sample Cross-Examination & Friction'
              : 'Sample Convergent Chair Synthesis'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRound(r)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                activeRound === r
                  ? 'bg-brass text-background font-bold'
                  : 'bg-background border border-border text-ink-muted hover:text-ink'
              }`}
            >
              Round {r}
            </button>
          ))}
        </div>
      </div>

      {/* Council Testimonies Stack / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {currentSession.testimonies.map((testimony) => {
          const advisor = currentSession.advisors.find((a) => a.id === testimony.advisorId);
          const colorToken = advisor?.colorToken || 'persona-sage';

          return (
            <div
              key={testimony.advisorId}
              className="p-5 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Advisor Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
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
                    <div>
                      <h3 className="text-sm font-medium text-ink">{testimony.heading}</h3>
                      <p className="text-[10px] text-ink-muted font-mono">
                        {advisor?.model} · {advisor?.provider}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-brass font-medium">
                    {testimony.stanceBadge}
                  </span>
                </div>

                {/* Testimony Text */}
                <div className="space-y-2.5 text-xs text-ink-muted leading-relaxed">
                  <p className="text-ink">{testimony.primaryText}</p>
                  <p>{testimony.secondaryText}</p>
                </div>
              </div>

              {/* Metric Callout */}
              <div className="p-3 rounded-md bg-background border border-border mt-auto space-y-1">
                <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
                  {testimony.metricLabel}
                </span>
                <span className="text-xs font-mono text-ink font-medium">
                  {testimony.metricValue}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Intermediate Convergence Preview */}
      <div className="p-5 rounded-lg bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <h3 className="text-xs font-medium text-ink">Sample Consensus Points</h3>
          </div>
          <span className="text-xs text-ink-muted">Sample consensus rate: 84%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-md bg-background border border-border space-y-1">
            <p className="text-brass font-medium">1. Financial Equivalence</p>
            <p className="text-ink-muted text-[11px]">
              Net spendable disparity is minimal when commuting, wardrobe, and transit fees are removed.
            </p>
          </div>
          <div className="p-3 rounded-md bg-background border border-border space-y-1">
            <p className="text-sage font-medium">2. Reclaimed Time</p>
            <p className="text-ink-muted text-[11px]">
              Autonomy dividend yields ~20 hours per month of recaptured bandwidth for sovereign compounding.
            </p>
          </div>
          <div className="p-3 rounded-md bg-background border border-border space-y-1">
            <p className="text-persona-slate font-medium">3. Stipulated Protection</p>
            <p className="text-ink-muted text-[11px]">
              Protection against proximity bias demands formal 6-month milestone compensation triggers.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setCurrentView('session-concluded')}
            type="button"
            className="px-5 py-2.5 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors shadow-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Review Sample Chair Synthesis</span>
          </button>
        </div>
      </div>
    </div>
  );
};
