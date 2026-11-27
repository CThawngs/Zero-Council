/**
 * Shared TypeScript contracts and mode key mappings for bilingual i18n copy.
 *
 * Separated from dictionary literals so helpers and components can import types cleanly.
 */

import type { copyEn } from './en.ts';
import type { copyVi } from './vi.ts';

export type Copy = typeof copyEn | typeof copyVi;

/**
 * Copy keys whose value is a flat string. `keyof Copy` alone would also include `legal`,
 * which is a nested tree of policy documents rather than a single display label.
 */
export type CopyStringKey = {
  [K in keyof Copy]: Copy[K] extends string ? K : never;
}[keyof Copy];

export const MODE_LABEL_KEYS = {
  independent: 'modeIndependentTitle',
  debate: 'modeDebateTitle',
  chain: 'modeChainTitle',
} as const;

export type ModeLabelKey = keyof typeof MODE_LABEL_KEYS;
