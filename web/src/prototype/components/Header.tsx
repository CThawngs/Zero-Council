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
  const headerRef = useRef<HTMLElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const labels = translations[language];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(mobileNavigationRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.getClientRects().length > 0);
      const menuButton = menuButtonRef.current;
      if (!focusable.length || !menuButton) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === menuButton)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const desktopQuery = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    desktopQuery.addEventListener('change', closeOnDesktop);
    requestAnimationFrame(() => mobileNavigationRef.current?.querySelector<HTMLElement>('button')?.focus());
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
      desktopQuery.removeEventListener('change', closeOnDesktop);
    };
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
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/70 to-transparent" />
      <div className="mx-auto flex h-[75px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate('overview')} className="group min-h-11 min-w-0 shrink-0 text-left">
          <span className="block whitespace-nowrap font-serif text-xl tracking-tight text-ink transition-colors group-hover:text-brass">{labels.brand}</span>
          <span className="hidden text-[9px] uppercase tracking-[0.24em] text-ink-muted sm:block">{t.localBadge}</span>
        </button>

        <nav className="header-nav hidden min-w-0 items-center gap-1 lg:flex" aria-label={t.primaryNavigation}>
          {isWorkspace
            ? navItems.map((item) => (
                <button key={item.view} type="button" onClick={() => navigate(item.view)} aria-current={currentView === item.view ? 'page' : undefined} className={`nav-link whitespace-nowrap ${currentView === item.view ? 'nav-link-active' : ''}`}>
                  {labels.nav[item.label]}
                </button>
              ))
            : mobileItems.slice(0, 3).map((item) => (
                <button key={item.view} type="button" onClick={() => navigate(item.view)} aria-current={currentView === item.view ? 'page' : undefined} className={`nav-link whitespace-nowrap ${currentView === item.view ? 'nav-link-active' : ''}`}>
                  {item.label}
                </button>
              ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={changeLanguage} className="icon-button header-compact-control min-w-11" aria-label={`${language === 'en' ? t.switchToVietnamese : t.switchToEnglish} (${language})`} title={language === 'en' ? 'Tiếng Việt' : 'English'}>
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase">{language}</span>
          </button>
          <button type="button" onClick={toggleTheme} className="icon-button header-compact-control min-w-11" aria-label={theme === 'dark' ? t.light : t.dark} title={`${t.theme}: ${theme === 'dark' ? t.dark : t.light}`}>
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          {isWorkspace && (
            <button type="button" onClick={() => navigate('settings')} className="icon-button header-settings min-w-11" aria-label={labels.nav.settings}>
              <Settings className="h-4 w-4" />
            </button>
          )}
          {!isWorkspace && (
            <button type="button" onClick={() => navigate('empty-chamber')} className="button-primary header-cta">{labels.nav.getStarted}</button>
          )}
          <button ref={menuButtonRef} type="button" className="icon-button header-menu min-w-11" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? t.close : t.menu}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-navigation" ref={mobileNavigationRef} className="mobile-navigation-panel border-t border-border bg-surface p-3 shadow-2xl">
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
