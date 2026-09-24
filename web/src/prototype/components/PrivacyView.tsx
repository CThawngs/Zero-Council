import React from 'react';
import { useApp } from '../context/AppContext';
import { Lock, Cpu, EyeOff, ArrowLeft } from 'lucide-react';

export const PrivacyView: React.FC = () => {
  const { setCurrentView } = useApp();

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10 text-left">
      {/* Back button */}
      <button
        onClick={() => setCurrentView('overview')}
        type="button"
        className="text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Chamber Overview</span>
      </button>

      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs text-brass font-medium">
          <span className="w-2 h-2 rounded-full bg-brass" />
          <span>Mock Privacy & Data Boundaries</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-ink font-normal">
          Sample Deliberation Boundary
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Prototype boundaries for sample career, financial, and personal dilemmas. Production privacy controls are not implemented.
        </p>
      </div>

      {/* Principles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-lg bg-surface border border-border space-y-3">
          <div className="w-8 h-8 rounded-md bg-brass/10 border border-brass/20 flex items-center justify-center text-brass">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="font-serif text-base text-ink font-normal">Local Mock State</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            This UI prototype keeps sample sessions in transient React state. Reloading resets state; no production data is stored.
          </p>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-border space-y-3">
          <div className="w-8 h-8 rounded-md bg-sage/10 border border-sage/20 flex items-center justify-center text-sage">
            <EyeOff className="w-4 h-4" />
          </div>
          <h3 className="font-serif text-base text-ink font-normal">No Model Calls</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            This build does not call OpenAI, Anthropic, Google Gemini, or any other AI provider. All displayed synthesis is fixture content.
          </p>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-border space-y-3">
          <div className="w-8 h-8 rounded-md bg-persona-slate/10 border border-persona-slate/20 flex items-center justify-center text-persona-slate">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="font-serif text-base text-ink font-normal">No Credential Storage</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            This build has no API-key field, credential store, provider request, or secure vault.
          </p>
        </div>
      </div>

      {/* Policy Details */}
      <div className="p-6 rounded-lg bg-surface border border-border space-y-6 text-xs text-ink-muted leading-relaxed">
        <h3 className="font-serif text-lg text-ink font-normal">
          Prototype Confidentiality Boundary
        </h3>
        <p>
          Future product decisions must account for sensitive inputs such as compensation, contracts, workplace issues, equity, and family considerations.
        </p>
        <p>
          Current prototype boundaries:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-ink">
          <li>
            <strong className="text-ink">No server processing:</strong> deliberations never leave this browser because no model, auth, or API integration is enabled.
          </li>
          <li>
            <strong className="text-ink">Ephemeral sample state:</strong> reloading or closing the page resets the prototype. No production deletion workflow is connected.
          </li>
          <li>
            <strong className="text-ink">Provider calls disabled:</strong> displayed provider and model names are interface fixtures, not connected services.
          </li>
        </ul>
      </div>
    </div>
  );
};
