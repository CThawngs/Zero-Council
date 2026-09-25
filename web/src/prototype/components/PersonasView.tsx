import React from 'react';
import { useApp } from '../context/AppContext';
import { Cpu, LockKeyhole, PlusCircle } from 'lucide-react';
import { modelLabel, providerLabel } from '../data/mockData';

export const PersonasView: React.FC = () => {
  const { personas, setCurrentView, t, language } = useApp();

  return (
    <div className="content-shell space-y-7">
      <header className="page-header flex-col items-start sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow"><span className="status-dot" />{t.personasEyebrow}</p>
          <h1>{t.personasTitle}</h1>
          <p>{t.personasBody}</p>
        </div>
        <button type="button" onClick={() => setCurrentView('new-advisor')} className="button-primary min-h-11 shrink-0"><PlusCircle className="h-4 w-4" />{t.addPersona}</button>
      </header>

      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-ink"><Cpu className="h-4 w-4 text-brass" />{t.modelLabel}</div>
        <span className="badge-neutral"><LockKeyhole className="h-3 w-3" />{t.notImplemented}</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {personas.map((persona) => (
          <article key={persona.id} className="panel persona-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="persona-dot" style={{ backgroundColor: persona.colorHex }} aria-hidden="true" />
                <div><h2 className="font-serif text-lg text-ink">{persona.name}</h2><p className="text-xs text-brass">{persona.stance}</p></div>
              </div>
              <span className="badge-neutral">{persona.archetype}</span>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="field-label">{t.modelLabel}</dt><dd className="mt-1 text-ink">{modelLabel(persona.model, language)} · {providerLabel(persona.provider, language)}</dd></div>
              <div><dt className="field-label">{t.primaryLens}</dt><dd className="mt-1 text-ink">{persona.stance}</dd></div>
              <div><dt className="field-label">{t.fixtureInstructions}</dt><dd className="mt-1 rounded-lg border border-border bg-background/60 p-3 text-xs leading-relaxed text-ink-muted">{persona.instructions}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
};
