// Theme bootstrap — runs before first paint to avoid FOUC.
// Must stay in sync with THEME_STORAGE_KEY in src/prototype/theme.ts.
try {
  var k = 'zc-theme';
  var s = localStorage.getItem(k);
  var d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'light');
}
