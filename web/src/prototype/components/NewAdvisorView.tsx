import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AdvisorPersona, ModelProvider, SupportedModel } from '../types';
import { modelLabel, providerLabel } from '../data/mockData';
import { ArrowLeft, LockKeyhole, PlusCircle } from 'lucide-react';

const modelLabels: { model: SupportedModel; provider: ModelProvider }[] = [
  { model: 'Model label A', provider: 'Provider label A' },
  { model: 'Model label B', provider: 'Provider label B' },
  { model: 'Model label C', provider: 'Provider label C' },
];

export const NewAdvisorView: React.FC = () => {
  const { addPersona, setCurrentView, showToast, t, language } = useApp();
  const [archetype, setArchetype] = useState('');
  const [model, setModel] = useState<SupportedModel>('Model label A');
  const [stance, setStance] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showRequiredError, setShowRequiredError] = useState(false);
  const [invalidFields, setInvalidFields] = useState({ archetype: false, stance: false, instructions: false });
  const archetypeRef = useRef<HTMLInputElement>(null);
  const stanceRef = useRef<HTMLInputElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextInvalidFields = {
      archetype: !archetype.trim(),
      stance: !stance.trim(),
      instructions: !instructions.trim(),
    };
    setInvalidFields(nextInvalidFields);
    if (nextInvalidFields.archetype || nextInvalidFields.stance || nextInvalidFields.instructions) {
      setShowRequiredError(true);
      showToast('requiredFields');
      const firstInvalid = nextInvalidFields.archetype ? archetypeRef.current : nextInvalidFields.stance ? stanceRef.current : instructionsRef.current;
      requestAnimationFrame(() => firstInvalid?.focus());
      return;
    }
    setShowRequiredError(false);
    setInvalidFields({ archetype: false, stance: false, instructions: false });
    const cleanArchetype = archetype.trim();
    const provider = modelLabels.find((item) => item.model === model)?.provider ?? 'Provider label A';
    const persona: AdvisorPersona = {
      id: `advisor-${crypto.randomUUID()}`,
      name: t.samplePersonaName.replace('{name}', cleanArchetype),
      archetype: cleanArchetype,
      model,
      provider,
      colorToken: 'persona-ochre',
      colorHex: '#C08A3E',
      stance: stance.trim(),
      instructions: instructions.trim(),
      sampleQuote: t.samplePersonaQuote,
      generatedName: true,
    };
    addPersona(persona);
  };

  return (
    <div className="content-shell max-w-3xl space-y-7">
      <button type="button" onClick={() => setCurrentView('personas')} className="button-quiet -ml-3"><ArrowLeft className="h-4 w-4" />{t.personasTitle}</button>
      <header className="page-header"><p className="eyebrow"><span className="status-dot" />{t.advisorEyebrow}</p><h1>{t.advisorTitle}</h1><p>{t.advisorBody}</p></header>
      <form onSubmit={handleSubmit} className="panel space-y-6 p-5 sm:p-7" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field"><span className="field-label">{t.archetype}</span><input ref={archetypeRef} value={archetype} onChange={(event) => { setArchetype(event.target.value); setShowRequiredError(false); setInvalidFields((value) => ({ ...value, archetype: false })); }} placeholder={t.archetypePlaceholder} required aria-invalid={invalidFields.archetype} aria-describedby={invalidFields.archetype ? 'advisor-form-error' : undefined} /></label>
          <label className="field"><span className="field-label">{t.modelLabel}</span><select value={model} onChange={(event) => setModel(event.target.value as SupportedModel)}>{modelLabels.map((item) => <option key={item.model} value={item.model}>{modelLabel(item.model, language)} · {providerLabel(item.provider, language)}</option>)}</select></label>
        </div>
        <label className="field"><span className="field-label">{t.stance}</span><input ref={stanceRef} value={stance} onChange={(event) => { setStance(event.target.value); setShowRequiredError(false); setInvalidFields((value) => ({ ...value, stance: false })); }} placeholder={t.stancePlaceholder} required aria-invalid={invalidFields.stance} aria-describedby={invalidFields.stance ? 'advisor-form-error' : undefined} /></label>
        <label className="field"><span className="field-label">{t.instructions}</span><textarea ref={instructionsRef} value={instructions} onChange={(event) => { setInstructions(event.target.value); setShowRequiredError(false); setInvalidFields((value) => ({ ...value, instructions: false })); }} placeholder={t.instructionsPlaceholder} rows={5} required aria-invalid={invalidFields.instructions} aria-describedby={invalidFields.instructions ? 'advisor-form-error' : undefined} /></label>
        {showRequiredError && <p id="advisor-form-error" className="field-error" role="alert">{t.requiredFields}</p>}
        <div className="flex gap-3 rounded-lg border border-border bg-background/60 p-4 text-xs leading-relaxed text-ink-muted"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brass" /><span>{t.capabilitiesDisabled}</span></div>
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCurrentView('personas')} className="button-secondary min-h-11 w-full justify-center sm:w-auto">{t.cancel}</button><button type="submit" className="button-primary min-h-11 w-full justify-center sm:w-auto"><PlusCircle className="h-4 w-4" />{t.addPersona}</button></div>
      </form>
    </div>
  );
};
