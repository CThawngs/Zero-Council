export type Theme = 'light' | 'dark';

/**
 * Key read by BOTH the pre-paint script in layout.tsx and this module. The
 * script is a plain string on purpose: it runs before React exists, so it
 * cannot import from a module that pulls the app context.
 */
export const THEME_STORAGE_KEY = 'zc-theme';

/** Inline script body. Kept in sync with `applyTheme` below by design, not by import. */
export const THEME_BOOTSTRAP_SCRIPT = `try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}`;

export const readTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
};

/**
 * Server render must match the first client render, and this provider renders
 * on the server. `resolveInitialTheme` is therefore always 'light' on the
 * server; the real choice is applied by the bootstrap script before paint, and
 * the effect below adopts it on mount. Reading `matchMedia` here would hydrate
 * with the wrong toggle icon.
 */
export const resolveInitialTheme = (): Theme => 'light';

/** Applies a theme to the document. Called from the effect after mount. */
export const applyTheme = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
};