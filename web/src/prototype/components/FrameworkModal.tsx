import React from 'react';
import { useApp } from '../context/AppContext';
import { DecisionFramework } from '../types';
import { X, Check, Layers, Sliders, GitBranch } from 'lucide-react';

export const FrameworkModal: React.FC = () => {
  const {
    isFrameworkModalOpen,
    closeFrameworkModal,
    currentSession,
    setCurrentFramework,
    showToast,
    language,
  } = useApp();

  if (!isFrameworkModalOpen) return null;

  const frameworks: {
    id: DecisionFramework;
    title: string;
    description: string;
    icon: React.ReactNode;
    tag: string;
  }[] = [
    {
      id: 'Good / Normal / Bad Scenarios',
      title: 'Good / Normal / Bad Scenarios',
      description:
        'Projects outcome probabilities across optimistic compounding, baseline equilibrium, and downside boundary erosion scenarios with associated tactical counter-actions.',
      icon: <GitBranch className="w-4 h-4 text-brass" />,
      tag: 'Sample lens for life & career transitions',
    },
    {
      id: 'Six Thinking Hats',
      title: 'Six Thinking Hats',
      description:
        'Deconstructs arguments into structured modal facets: objective facts (White), emotion (Red), cautionary risk (Black), optimism (Yellow), creative growth (Green), and procedural synthesis (Blue).',
      icon: <Layers className="w-4 h-4 text-sage" />,
      tag: 'Best for multi-faceted dilemmas',
    },
    {
      id: 'Decision Matrix',
      title: 'Decision Matrix',
      description:
        'Quantifies trade-offs through weighted multi-attribute scoring across compensation, autonomy, stress index, and career leverage.',
      icon: <Sliders className="w-4 h-4 text-persona-slate" />,
      tag: 'Best for numerical offer comparisons',
    },
  ];

  const handleSelect = (framework: DecisionFramework) => {
    setCurrentFramework(framework);
    showToast(
      language === 'vi'
        ? `Đã áp dụng khung phân tích: ${framework}`
        : `Applied framework: ${framework}`
    );
    closeFrameworkModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-serif text-lg text-ink font-normal">Select Decision Framework</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Mock decision framework labels for this UI preview. No framework is executed.
            </p>
          </div>
          <button
            onClick={closeFrameworkModal}
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-background transition-colors"
            type="button"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close framework comparison</span>
          </button>
        </div>

        {/* Framework Options */}
        <div className="p-5 space-y-3">
          {frameworks.map((fw) => {
            const isSelected = currentSession.framework === fw.id;
            return (
              <button
                key={fw.id}
                onClick={() => handleSelect(fw.id)}
                type="button"
                aria-pressed={isSelected}
                className={`w-full text-left p-4 rounded-md border transition-all ${
                  isSelected
                    ? 'border-brass bg-background/80 shadow-xs'
                    : 'border-border bg-surface hover:bg-background/40 hover:border-border/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-md bg-background border border-border">
                      {fw.icon}
                    </span>
                    <span className="text-sm font-medium text-ink">{fw.title}</span>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-xs text-brass font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Selected sample
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed pl-8">
                  {fw.description}
                </p>
                <div className="mt-2 pl-8">
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                    {fw.tag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background/50 flex justify-end">
          <button
            onClick={closeFrameworkModal}
            type="button"
            className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
