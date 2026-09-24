import React from 'react';
import { useApp } from '../context/AppContext';
import { PlusCircle, Globe, GitFork, Cpu } from 'lucide-react';

export const PersonasView: React.FC = () => {
  const { personas, setCurrentView, showToast, language } = useApp();

  const handleToggleTool = (advisorName: string, tool: string) => {
    showToast(
      language === 'vi'
        ? `Đã cập nhật tùy chọn mô phỏng ${tool} cho ${advisorName}`
        : `Updated mock ${tool} preference for ${advisorName}`
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <span className="text-xs font-mono text-brass font-medium">Sample Personas</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-normal mt-1">
            Sample Advisors
          </h1>
          <p className="text-xs text-ink-muted">
            Configure sample advisor personas, model-label slots, and mock deliberation preferences. No model runs.
          </p>
        </div>

        <button
          onClick={() => setCurrentView('new-advisor')}
          type="button"
          className="px-4 py-2 rounded-md bg-brass text-background font-medium text-xs hover:bg-brass/90 transition-colors shadow-xs flex items-center gap-2 self-start"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Sample Persona</span>
        </button>
      </div>

      {/* Model Distribution Banner */}
      <div className="p-4 rounded-lg bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-ink-muted">
          <Cpu className="w-4 h-4 text-brass shrink-0" />
          <span>Sample Model Labels (No Connected Models):</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-background border border-border text-ink font-mono text-[11px]">
            Claude 4.6 (Anthropic)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-background border border-border text-ink font-mono text-[11px]">
            GPT-5.2 (OpenAI)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-background border border-border text-ink font-mono text-[11px]">
            Gemini 3 Pro (Google)
          </span>
        </div>
      </div>

      {/* Persona Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {personas.map((persona) => {
          return (
            <div
              key={persona.id}
              className="p-6 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        persona.colorToken === 'persona-sage'
                          ? 'bg-persona-sage'
                          : persona.colorToken === 'persona-rose'
                          ? 'bg-persona-rose'
                          : persona.colorToken === 'persona-ochre'
                          ? 'bg-persona-ochre'
                          : 'bg-persona-slate'
                      }`}
                    />
                    <div>
                      <h3 className="font-serif text-base text-ink font-normal">{persona.name}</h3>
                      <p className="text-[11px] text-brass font-medium">{persona.stance}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border font-mono text-ink-muted">
                    {persona.archetype}
                  </span>
                </div>

                {/* Assigned Model */}
                <div className="p-2.5 rounded-md bg-background border border-border space-y-1">
                  <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-mono">
                    Model Label Slot
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink font-medium">{persona.model}</span>
                    <span className="text-ink-muted text-[11px]">{persona.provider}</span>
                  </div>
                </div>

                {/* System Prompt / Archetype Instructions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-ink-muted block">Sample Persona Directive</span>
                  <p className="text-xs text-ink-muted leading-relaxed line-clamp-4 bg-background/50 p-3 rounded-md border border-border/60">
                    &quot;{persona.instructions}&quot;
                  </p>
                </div>
              </div>

              {/* Tool Capabilities Toggles */}
              <div className="pt-3 border-t border-border space-y-2">
                <span className="text-[11px] text-ink-muted block">Mock Capability Toggles</span>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Mock Search Grounding</span>
                  </div>
                  <input
                    id={`persona-search-${persona.id}`}
                    name={`persona-search-${persona.id}`}
                    type="checkbox"
                    aria-label={`Mock search grounding for ${persona.name}`}
                    defaultChecked={persona.webSearchEnabled}
                    onChange={() => handleToggleTool(persona.name, 'Mock Search Grounding')}
                    className="accent-brass w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Mock Scenario Modeling</span>
                  </div>
                  <input
                    id={`persona-scenario-${persona.id}`}
                    name={`persona-scenario-${persona.id}`}
                    type="checkbox"
                    aria-label={`Mock scenario modeling for ${persona.name}`}
                    defaultChecked={persona.generateDiagramEnabled}
                    onChange={() => handleToggleTool(persona.name, 'Mock Scenario Modeling')}
                    className="accent-brass w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
