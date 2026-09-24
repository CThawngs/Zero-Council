import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AdvisorPersona, SupportedModel, ModelProvider } from '../types';
import { PlusCircle, ArrowLeft } from 'lucide-react';

export const NewAdvisorView: React.FC = () => {
  const { addPersona, setCurrentView, showToast, language } = useApp();

  const [archetype, setArchetype] = useState('');
  const [model, setModel] = useState<SupportedModel>('Claude 4.6');
  const [stance, setStance] = useState('');
  const [instructions, setInstructions] = useState('');
  const [colorToken, setColorToken] = useState<
    'persona-rose' | 'persona-sage' | 'persona-slate' | 'persona-ochre'
  >('persona-ochre');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [generateDiagramEnabled, setGenerateDiagramEnabled] = useState(true);

  const getProviderForModel = (m: SupportedModel): ModelProvider => {
    if (m === 'Claude 4.6') return 'Anthropic';
    if (m === 'GPT-5.2') return 'OpenAI';
    return 'Google Gemini';
  };

  const advisorName = archetype.trim()
    ? archetype.toLowerCase().startsWith('the ')
      ? archetype.trim()
      : `The ${archetype.trim()}`
    : 'The Advisor';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!archetype.trim() || !stance.trim() || !instructions.trim()) {
      showToast(language === 'vi' ? 'Vui lòng điền đủ thông tin' : 'Please fill all required fields');
      return;
    }

    const newAdvisor: AdvisorPersona = {
      id: `advisor-${Date.now()}`,
      name: advisorName,
      archetype: archetype.replace(/^the\s+/i, '').trim(),
      model,
      provider: getProviderForModel(model),
      colorToken,
      colorHex:
        colorToken === 'persona-sage'
          ? '#7C9885'
          : colorToken === 'persona-rose'
          ? '#B98389'
          : colorToken === 'persona-ochre'
          ? '#C08A3E'
          : '#6E85A6',
      stance,
      instructions,
      webSearchEnabled,
      generateDiagramEnabled,
    };

    addPersona(newAdvisor);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6 text-left">
      {/* Back button */}
      <button
        onClick={() => setCurrentView('personas')}
        type="button"
        className="text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Sample Personas</span>
      </button>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brass" />
          <span className="text-xs font-mono text-brass font-medium">Sample Persona Setup</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl text-ink font-normal">
          Add Sample Persona to the Chamber
        </h1>
        <p className="text-xs text-ink-muted">
          Create a sample persona configuration for the mock interface. No model is invoked and instructions stay in transient browser state.
        </p>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="p-6 rounded-lg bg-surface border border-border space-y-5 shadow-lg">
        {/* Archetype & Generated Name */}
        <div className="space-y-2">
          <label htmlFor="advisor-archetype" className="block text-xs font-medium text-ink">
            Archetype (name follows the &quot;The [Archetype]&quot; pattern)
          </label>
          <input
            id="advisor-archetype"
            name="advisor-archetype"
            type="text"
            required
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            placeholder="e.g. Stoic, Realist, Contrarian, Ethicist"
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-md text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass transition-colors"
          />
          <p className="text-[11px] text-ink-muted">
            Council designation:{' '}
            <span className="text-brass font-medium">{advisorName}</span>
          </p>
        </div>

        {/* Frontier Model Assignment */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-ink">Model Label Slot</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(['Claude 4.6', 'GPT-5.2', 'Gemini 3 Pro'] as SupportedModel[]).map((m) => {
              const isSelected = model === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  aria-pressed={isSelected}
                  className={`p-3 rounded-md border text-left text-xs transition-all ${
                    isSelected
                      ? 'border-brass bg-background text-ink shadow-xs'
                      : 'border-border bg-background/50 text-ink-muted hover:text-ink'
                  }`}
                >
                  <p className="font-medium">{m}</p>
                  <p className="text-[10px] text-ink-muted mt-0.5">{getProviderForModel(m)}</p>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Stance */}
        <div className="space-y-2">
          <label htmlFor="advisor-stance" className="block text-xs font-medium text-ink">
            Primary Deliberative Stance / Lens
          </label>
          <input
            id="advisor-stance"
            name="advisor-stance"
            type="text"
            required
            value={stance}
            onChange={(e) => setStance(e.target.value)}
            placeholder="e.g. Asymmetric Upside & Convexity, Long-Term Liquidity, Moral Responsibility"
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-md text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass transition-colors"
          />
        </div>

        {/* Color Palette Token */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-ink">Chamber Visual Token</legend>
          <div className="flex items-center gap-3">
            {[
              { token: 'persona-rose', label: 'Rose', bg: 'bg-persona-rose' },
              { token: 'persona-sage', label: 'Sage', bg: 'bg-persona-sage' },
              { token: 'persona-slate', label: 'Slate', bg: 'bg-persona-slate' },
              { token: 'persona-ochre', label: 'Ochre', bg: 'bg-persona-ochre' },
            ].map((col) => (
              <button
                key={col.token}
                type="button"
                aria-pressed={colorToken === col.token}
                onClick={() =>
                  setColorToken(
                    col.token as 'persona-rose' | 'persona-sage' | 'persona-slate' | 'persona-ochre'
                  )
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-colors ${
                  colorToken === col.token
                    ? 'border-brass bg-background text-ink'
                    : 'border-border text-ink-muted hover:text-ink'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${col.bg}`} />
                <span>{col.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Deliberative Directive Instructions */}
        <div className="space-y-2">
          <label htmlFor="advisor-instructions" className="block text-xs font-medium text-ink">
            Sample Persona Instructions
          </label>
          <textarea
            id="advisor-instructions"
            name="advisor-instructions"
            rows={4}
            required
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Explain how this archetype evaluates risk, challenges opposing viewpoints, and calculates trade-offs during deliberation rounds..."
            className="w-full p-3 bg-background border border-border rounded-md text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass resize-none transition-colors"
          />
        </div>

        {/* Capabilities Toggles */}
        <div className="pt-2 border-t border-border flex items-center justify-between gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-ink-muted hover:text-ink">
            <input
              id="mock-web-search"
              name="mock-web-search"
              type="checkbox"
              checked={webSearchEnabled}
              onChange={(e) => setWebSearchEnabled(e.target.checked)}
              className="accent-brass w-3.5 h-3.5 rounded"
            />
            <span>Mock Search Grounding Toggle</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-ink-muted hover:text-ink">
            <input
              id="mock-diagram"
              name="mock-diagram"
              type="checkbox"
              checked={generateDiagramEnabled}
              onChange={(e) => setGenerateDiagramEnabled(e.target.checked)}
              className="accent-brass w-3.5 h-3.5 rounded"
            />
            <span>Mock Diagram Toggle</span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentView('personas')}
            className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors shadow-xs flex items-center gap-2"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Sample Persona</span>
          </button>
        </div>
      </form>
    </div>
  );
};
