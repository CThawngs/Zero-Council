import { AdvisorPersona, ApiKeyConfig, DeliberationSession, Language, ModelProvider, SupportedModel } from '../types';
import { copy } from '../i18n';

const sessionFixture = (
  id: string,
  title: string,
  framework: DeliberationSession['framework'],
  language: Language = 'en'
): DeliberationSession => {
  const t = copy[language];
  return {
    id,
    title,
    summary: t.sampleSessionSummary,
    framework,
    timestamp: '2026-01-01T00:00:00Z',
    relativeTime: t.sample,
    status: 'Concluded',
    advisors: initialPersonas.map((persona) => localizePersona(persona, language)),
    testimonies: [
      { advisorId: 'pragmatist', heading: t.pragmatistName, stanceBadge: t.pragmatistStance, primaryText: t.pragmatistQuote, secondaryText: t.pragmatistInstructions },
      { advisorId: 'dreamer', heading: t.dreamerName, stanceBadge: t.dreamerStance, primaryText: t.dreamerQuote, secondaryText: t.dreamerInstructions },
      { advisorId: 'skeptic', heading: t.skepticName, stanceBadge: t.skepticStance, primaryText: t.skepticQuote, secondaryText: t.skepticInstructions },
    ],
    synthesis: {
      chairTitle: t.sampleChair,
      chairRole: t.sampleNarrator,
      statusBadge: t.fixtureNotConsensus,
      coreOutput: t.sampleTakeaway,
      stipulations: [t.sampleStipulationOne, t.sampleStipulationTwo],
      nextAction: t.sampleNextAction,
      quote: t.sampleQuote,
    },
    scenarios: {
      good: { title: t.favorableTitle, subtitle: t.illustrativeOnly, description: t.favorableDescription, actions: [t.favorableActionOne, t.favorableActionTwo] },
      normal: { title: t.baselineTitle, subtitle: t.illustrativeOnly, description: t.baselineDescription, actions: [t.baselineActionOne, t.baselineActionTwo] },
      bad: { title: t.difficultTitle, subtitle: t.illustrativeOnly, description: t.difficultDescription, actions: [t.difficultActionOne, t.difficultActionTwo] },
    },
  };
};

export const localizePersona = (persona: AdvisorPersona, language: Language): AdvisorPersona => {
  const t = copy[language];
  const translated: Record<string, Pick<AdvisorPersona, 'name' | 'archetype' | 'stance' | 'instructions' | 'sampleQuote'>> = {
    pragmatist: { name: t.pragmatistName, archetype: t.pragmatistArchetype, stance: t.pragmatistStance, instructions: t.pragmatistInstructions, sampleQuote: t.pragmatistQuote },
    dreamer: { name: t.dreamerName, archetype: t.dreamerArchetype, stance: t.dreamerStance, instructions: t.dreamerInstructions, sampleQuote: t.dreamerQuote },
    skeptic: { name: t.skepticName, archetype: t.skepticArchetype, stance: t.skepticStance, instructions: t.skepticInstructions, sampleQuote: t.skepticQuote },
  };
  const fixture = translated[persona.id];
  if (fixture) return { ...persona, ...fixture };
  if (!persona.generatedName) return persona;
  return {
    ...persona,
    name: t.samplePersonaName.replace('{name}', persona.archetype),
    sampleQuote: t.samplePersonaQuote,
  };
};

export const initialPersonas: AdvisorPersona[] = [
  { id: 'pragmatist', name: copy.en.pragmatistName, archetype: copy.en.pragmatistArchetype, model: 'Model label A', provider: 'Provider label A', colorToken: 'persona-sage', colorHex: '#7C9885', stance: copy.en.pragmatistStance, instructions: copy.en.pragmatistInstructions, sampleQuote: copy.en.pragmatistQuote },
  { id: 'dreamer', name: copy.en.dreamerName, archetype: copy.en.dreamerArchetype, model: 'Model label B', provider: 'Provider label B', colorToken: 'persona-rose', colorHex: '#B98389', stance: copy.en.dreamerStance, instructions: copy.en.dreamerInstructions, sampleQuote: copy.en.dreamerQuote },
  { id: 'skeptic', name: copy.en.skepticName, archetype: copy.en.skepticArchetype, model: 'Model label C', provider: 'Provider label C', colorToken: 'persona-slate', colorHex: '#6E85A6', stance: copy.en.skepticStance, instructions: copy.en.skepticInstructions, sampleQuote: copy.en.skepticQuote },
];

export const initialSessions: DeliberationSession[] = [
  sessionFixture('project-proposal', copy.en.initialProjectTitle, 'Good / Normal / Bad Scenarios'),
  sessionFixture('team-priority', copy.en.initialTeamTitle, 'Six Thinking Hats'),
  sessionFixture('process-change', copy.en.initialProcessTitle, 'Decision Matrix'),
];

export const initialApiKeys: ApiKeyConfig[] = [
  { provider: 'Provider label A', modelName: 'Model label A', connected: false },
  { provider: 'Provider label B', modelName: 'Model label B', connected: false },
  { provider: 'Provider label C', modelName: 'Model label C', connected: false },
];

const modelLabelKeys: Record<SupportedModel, 'modelLabelA' | 'modelLabelB' | 'modelLabelC'> = {
  'Model label A': 'modelLabelA',
  'Model label B': 'modelLabelB',
  'Model label C': 'modelLabelC',
};

const providerLabelKeys: Record<ModelProvider, 'providerLabelA' | 'providerLabelB' | 'providerLabelC'> = {
  'Provider label A': 'providerLabelA',
  'Provider label B': 'providerLabelB',
  'Provider label C': 'providerLabelC',
};

export const modelLabel = (model: SupportedModel, language: Language) =>
  copy[language][modelLabelKeys[model]];

export const providerLabel = (provider: ModelProvider, language: Language) =>
  copy[language][providerLabelKeys[provider]];
