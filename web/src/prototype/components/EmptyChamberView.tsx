import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DecisionFramework } from '../types';
import { Compass, ShieldCheck } from 'lucide-react';

export const EmptyChamberView: React.FC = () => {
  const { startNewSession, personas, setCurrentView, openFrameworkModal } = useApp();
  const [dilemma, setDilemma] = useState('');
  const [selectedFramework, setSelectedFramework] =
    useState<DecisionFramework>('Good / Normal / Bad Scenarios');

  const frameworks: DecisionFramework[] = [
    'Good / Normal / Bad Scenarios',
    'Six Thinking Hats',
    'Decision Matrix',
  ];

  const suggestedPrompts = [
    {
      title: 'Should I accept a remote job offer that pays less but gives more flexibility?',
      tag: 'Career & Autonomy',
    },
    {
      title: 'Should I bootstrap our AI product or raise $500k in pre-seed funding?',
      tag: 'Founder Dilemma',
    },
    {
      title: 'Relocating to Da Nang vs staying in Ho Chi Minh City for remote work',
      tag: 'Location & Lifestyle',
    },
    {
      title: 'Should I quit my senior engineering role to build full-time open source tools?',
      tag: 'Risk & Purpose',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dilemma.trim()) return;
    startNewSession(dilemma, selectedFramework);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 space-y-8 text-left">
      {/* Chamber Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs text-brass font-medium">
          <span className="w-2 h-2 rounded-full bg-brass" />
          <span>Sample Council Workspace</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl text-ink font-normal">
          The Chamber is Silent
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted max-w-2xl leading-relaxed">
          Enter a sample dilemma to preview how opposing advisor personas might frame a decision. No model runs in this build.
        </p>
      </div>

      {/* Main Dilemma Input Container */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-7 rounded-lg bg-surface border border-border shadow-lg space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="dilemma" className="text-xs font-medium text-ink">
              Dilemma Statement & Context
            </label>
            <span className="text-[11px] text-ink-muted">
              Include numbers, timelines, or emotional stakes
            </span>
          </div>
          <textarea
            id="dilemma"
            name="dilemma"
            rows={4}
            autoComplete="off"
            value={dilemma}
            onChange={(e) => setDilemma(e.target.value)}
            placeholder="e.g. I have an offer from a remote US studio offering $110k/yr with full schedule autonomy, while my current enterprise role pays $135k/yr with mandatory 3 days on-site in district 1. Should I make the transition?"
            className="w-full p-4 rounded-md bg-background border border-border text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass leading-relaxed resize-none transition-colors"
          />
        </div>

        {/* Framework Selector Pills (Strictly the 3 allowed) */}
        <fieldset className="space-y-2.5">
          <div className="flex items-center justify-between">
            <legend className="text-xs font-medium text-ink-muted">
              Select Analytical Framework
            </legend>
            <button
              type="button"
              onClick={openFrameworkModal}
              className="text-[11px] text-brass hover:underline"
            >
              Compare framework methodologies
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {frameworks.map((fw) => {
              const isSelected = selectedFramework === fw;
              return (
                <button
                  key={fw}
                  type="button"
                  onClick={() => setSelectedFramework(fw)}
                  aria-pressed={isSelected}
                  className={`p-3 rounded-md border text-left text-xs transition-all ${
                    isSelected
                      ? 'border-brass bg-background text-ink shadow-xs'
                      : 'border-border bg-background/50 text-ink-muted hover:text-ink hover:border-border/80'
                  }`}
                >
                  <p className="font-medium truncate">{fw}</p>
                  <p className="text-[10px] text-ink-muted mt-1 line-clamp-1">
                    {fw === 'Good / Normal / Bad Scenarios'
                      ? 'Compounding, baseline & erosion paths'
                      : fw === 'Six Thinking Hats'
                      ? 'Fact, emotion, risk, logic & synthesis'
                      : 'Weighted multi-factor score calculus'}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Council Chamber Roster (Each advisor has a DISTINCT model) */}
        <div className="space-y-2.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              Sample Advisor Slots
            </span>
            <button
              type="button"
              onClick={() => setCurrentView('personas')}
              className="text-[11px] text-brass hover:underline"
            >
              Preview persona configuration
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="p-3 rounded-md bg-background border border-border flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      persona.colorToken === 'persona-sage'
                        ? 'bg-persona-sage'
                        : persona.colorToken === 'persona-rose'
                        ? 'bg-persona-rose'
                        : persona.colorToken === 'persona-ochre'
                        ? 'bg-persona-ochre'
                        : 'bg-persona-slate'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{persona.name}</p>
                    <p className="text-[10px] text-ink-muted truncate font-mono">
                      {persona.model} · {persona.provider}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface border border-border text-ink-muted shrink-0">
                  Mock Ready
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="w-4 h-4 text-sage" />
            <span>Local mock flow · no AI or provider call</span>
          </div>

          <button
            type="submit"
            disabled={!dilemma.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-40"
          >
            <Compass className="w-4 h-4" />
            <span>Preview Council Deliberation</span>
          </button>
        </div>
      </form>

      {/* Recommended Case Dilemmas */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-ink-muted">
          Sample Dilemmas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestedPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setDilemma(item.title);
                startNewSession(item.title, selectedFramework);
              }}
              className="p-4 rounded-md bg-surface border border-border hover:border-brass/50 text-left transition-all group flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-ink leading-relaxed group-hover:text-brass transition-colors">
                {item.title}
              </p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50 text-[11px] text-ink-muted">
                <span>{item.tag}</span>
                <span className="text-brass">Preview</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
