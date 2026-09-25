import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { Globe2, Menu, Moon, Settings, Sun, X } from 'lucide-react';

const navItems = [
  { view: 'sessions', label: 'sessions' },
  { view: 'personas', label: 'personas' },
  { view: 'api-keys', label: 'apiKeys' },
  { view: 'settings', label: 'settings' },
] as const;

export const Header: React.FC<{ isWorkspace: boolean }> = ({ isWorkspace }) => {
  const { currentView, setCurrentView, language, setLanguage, theme, toggleTheme, t } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const labels = translations[language];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const navigate = (view: ViewType) => {
    setCurrentView(view);
    setMenuOpen(false);
  };
  const changeLanguage = () => {
    setLanguage(language === 'en' ? 'vi' : 'en');
    setMenuOpen(false);
  };
  const mobileItems: { view: ViewType; label: string }[] = isWorkspace
    ? navItems.map((item) => ({ view: item.view, label: labels.nav[item.label] }))
    : [
        { view: 'overview', label: labels.nav.overview },
        { view: 'empty-chamber', label: labels.nav.newDeliberation },
        { view: 'privacy', label: t.privacyEyebrow },
      ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/70 to-transparent" />
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate('overview')} className="group min-h-11 min-w-0 text-left">
          <span className="block font-serif text-xl tracking-tight text-ink transition-colors group-hover:text-brass">{labels.brand}</span>
          <span className="hidden text-[9px] uppercase tracking-[0.24em] text-ink-muted sm:block">{t.localBadge}</span>
        </button>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t.primaryNavigation}>
          {isWorkspace
            ? navItems.map((item) => (
                <button key={item.view} type="button" onClick={() => navigate(item.view)} aria-current={currentView === item.view ? 'page' : undefined} className={`nav-link ${currentView === item.view ? 'nav-link-active' : ''}`}>
                  {labels.nav[item.label]}
                </button>
              ))
            : mobileItems.slice(0, 3).map((item) => (
                <button key={item.view} type="button" onClick={() => navigate(item.view)} aria-current={currentView === item.view ? 'page' : undefined} className={`nav-link ${currentView === item.view ? 'nav-link-active' : ''}`}>
                  {item.label}
                </button>
              ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={changeLanguage} className="icon-button min-w-11" aria-label={`${language === 'en' ? t.switchToVietnamese : t.switchToEnglish} (${language})`} title={language === 'en' ? 'Tiếng Việt' : 'English'}>
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase">{language}</span>
          </button>
          <button type="button" onClick={toggleTheme} className="icon-button min-w-11" aria-label={theme === 'dark' ? t.light : t.dark} title={`${t.theme}: ${theme === 'dark' ? t.dark : t.light}`}>
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          {isWorkspace && (
            <button type="button" onClick={() => navigate('settings')} className="icon-button hidden min-w-11 sm:inline-flex" aria-label={labels.nav.settings}>
              <Settings className="h-4 w-4" />
            </button>
          )}
          {!isWorkspace && (
            <button type="button" onClick={() => navigate('empty-chamber')} className="button-primary hidden sm:inline-flex">{labels.nav.getStarted}</button>
          )}
          <button ref={menuButtonRef} type="button" className="icon-button min-w-11 lg:hidden" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? t.close : t.menu}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-navigation" className="border-t border-border bg-surface p-3 shadow-2xl lg:hidden">
          <nav className="mx-auto grid max-w-[1600px] gap-1" aria-label={t.mobileNavigation}>
            {mobileItems.map((item) => (
              <button key={item.view} type="button" onClick={() => navigate(item.view)} aria-current={currentView === item.view ? 'page' : undefined} className={`nav-link justify-between ${currentView === item.view ? 'nav-link-active' : ''}`}>
                {item.label}
                {currentView === item.view && <span aria-hidden="true">•</span>}
              </button>
            ))}
          </nav>
          <p className="mx-auto mt-3 max-w-[1600px] border-t border-border/70 pt-3 text-[11px] leading-relaxed text-ink-muted">{t.boundaryShort}</p>
        </div>
      )}
    </header>
  );
};
