import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { Globe2, Menu, Settings, X } from 'lucide-react';
import { CouncilOrb } from './CouncilOrb';

const navItems = [
  { view: 'sessions', label: 'sessions' },
  { view: 'personas', label: 'personas' },
  { view: 'api-keys', label: 'apiKeys' },
  { view: 'settings', label: 'settings' },
] as const;

export const Header: React.FC<{ isWorkspace: boolean }> = ({ isWorkspace }) => {
  const { currentView, setCurrentView, language, setLanguage, t } = useApp();
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
    // /auth is a separate route with its own, isolated app state. It only
    // ever renders the sign-in/sign-up views, so switching to any other view
    // there leaves the page blank. Send those clicks back to the real home
    // page instead of changing local state that nothing on this route reads.
    if (view !== 'sign-in' && view !== 'sign-up' && typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
      window.location.href = '/';
      return;
    }
    setCurrentView(view);
    setMenuOpen(false);
    // Without this the scroll offset of the view being left is inherited by the
    // view being entered — arriving half-way down the page — and clicking the
    // brand while already on the target view is a no-op, because setCurrentView
    // to the same value never re-renders.
    window.scrollTo(0, 0);
  };
  const changeLanguage = () => {
    setLanguage(language === 'en' ? 'vi' : 'en');
    setMenuOpen(false);
  };

  // Marketing nav mixes anchors (sections of the landing page) with one real
  // view. Anchors are used for "How it works" / "Why Zero Council" because both
  // sections live on the landing page itself.
  const links: { key: string; label: string; href?: string; view?: ViewType }[] = isWorkspace
    ? navItems.map((item) => ({ key: item.view, label: labels.nav[item.label], view: item.view }))
    : [
        { key: 'how-it-works', label: labels.nav.howItWorks, href: '#how-it-works' },
        { key: 'why-zero-council', label: labels.nav.whyZeroCouncil, href: '#why-zero-council' },
        { key: 'pricing', label: labels.nav.pricing, view: 'pricing' },
      ];

  // Anchors have no "current page" state; reading window.location.hash here
  // would differ between server render and client, so only views get aria-current.
  const isCurrent = (link: { href?: string; view?: ViewType }) => !link.href && link.view === currentView;

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/70 to-transparent" />
      <div className="mx-auto flex h-[75px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate('overview')} className="group flex min-h-11 min-w-0 shrink-0 items-center gap-2.5 text-left">
          <span className="brand-mark">
            <CouncilOrb />
          </span>
          <span className="block whitespace-nowrap font-serif text-xl tracking-tight text-ink transition-colors group-hover:text-brass">{labels.brand}</span>
        </button>

        <nav className="header-nav hidden min-w-0 items-center gap-1 lg:flex" aria-label={t.primaryNavigation}>
          {links.map((link) =>
            link.href ? (
              <a key={link.key} href={link.href} className="nav-link whitespace-nowrap">
                {link.label}
              </a>
            ) : (
              <button
                key={link.key}
                type="button"
                onClick={() => navigate(link.view as ViewType)}
                aria-current={isCurrent(link) ? 'page' : undefined}
                className={`nav-link whitespace-nowrap ${isCurrent(link) ? 'nav-link-active' : ''}`}
              >
                {link.label}
              </button>
            ),
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={changeLanguage} className="icon-button header-compact-control min-w-11" aria-label={`${language === 'en' ? t.switchToVietnamese : t.switchToEnglish} (${language})`} title={language === 'en' ? 'Tiếng Việt' : 'English'}>
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase">{language}</span>
          </button>

          {/* TEMP */}
          <button type='button' onClick={() => setCurrentView('sign-in')} className="button-secondary header-cta">{labels.nav.signIn}</button>

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
            {links.map((link) =>
              link.href ? (
                <a key={link.key} href={link.href} onClick={() => setMenuOpen(false)} className="nav-link justify-between">
                  {link.label}
                </a>
              ) : (
                <button key={link.key} type="button" onClick={() => navigate(link.view as ViewType)} aria-current={isCurrent(link) ? 'page' : undefined} className={`nav-link justify-between ${isCurrent(link) ? 'nav-link-active' : ''}`}>
                  {link.label}
                  {isCurrent(link) && <span aria-hidden="true">•</span>}
                </button>
              ),
            )}
          </nav>
          <p className="mx-auto mt-3 max-w-[1600px] border-t border-border/70 pt-3 text-[11px] leading-relaxed text-ink-muted">{t.boundaryShort}</p>
        </div>
      )}
    </header>
  );
};
