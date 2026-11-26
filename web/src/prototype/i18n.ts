/**
 * Bilingual i18n entrypoint (English & Vietnamese) for Zero Council.\n *
 * Re-exports modular translation tables, legal copy, type contracts, and runtime error localizers
 * from `./i18n/*` so all existing callers continue importing `@/prototype/i18n`.
 */

import type { Language } from './types.ts';
import { copyEn, translationsEn } from './i18n/en.ts';
import { copyVi, translationsVi } from './i18n/vi.ts';
import {
  MODE_LABEL_KEYS,
  type Copy,
  type CopyStringKey,
  type ModeLabelKey,
} from './i18n/types.ts';

export type { Copy, CopyStringKey, Language, ModeLabelKey };
export { localizeAttachmentProblem, localizeAuthError } from './i18n/localize.ts';

export const translations = {
  en: translationsEn,
  vi: translationsVi,
} as const;

export const copy = {
  en: copyEn,
  vi: copyVi,
} as const;

export const modeLabel = (mode: ModeLabelKey, language: Language): string =>
  copy[language][MODE_LABEL_KEYS[mode]];

/** Runtime key-parity check complementing static TypeScript dictionary typing. */
export const missingCopyKeys = (language: Language): string[] => {
  const source = Object.keys(copy.en) as (keyof typeof copy.en)[];
  return source.filter((key) => !(key in copy[language]));
};

export const t = (language: Language, key: CopyStringKey): string => copy[language][key];
