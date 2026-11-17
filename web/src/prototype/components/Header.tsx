import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import { type ViewType } from '../types';
import { Globe2, Menu, Moon, Sun, X } from 'lucide-react';
import { CouncilOrb } from './CouncilOrb';
import { MARKETING_NAV, WORKSPACE_NAV } from '../navigation';

export const Header: React.FC<{ isWorkspace: boolean }> = ({ isWorkspace }) => {
  const { setCurrentView, language, setLanguage, theme, toggleTheme, authUser, signOut, t } = useApp();
  const router = useRouter();
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
    setMenuOpen(false);
    window.scrollTo(0, 0);
    setCurrentView(view);
  };

  const changeLanguage = () => {
    void setLanguage(language === 'en' ? 'vi' : 'en');
    setMenuOpen(false);
  };

  const links = MARKETING_NAV.map((item) => ({
    key: item.labelKey,
    label: labels.nav[item.labelKey],
    href: item.href,
  }));

  const goToSection = (href: string) => {
    setMenuOpen(false);
    const scroll = () => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      try {
        sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
      } catch {
        // Ignore storage errors
      }
      setCurrentView('overview');
      router.push(`/${href}`);
      return;
    }
    setCurrentView('overview');
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  };

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface-2/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[75px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate('overview')} className="group flex min-h-11 min-w-0 shrink-0 items-center gap-2.5 text-left">
          <span className="brand-mark">
            <CouncilOrb />
          </span>
          <span className="block whitespace-nowrap text-xl font-extrabold tracking-tight text-ink transition-colors group-hover:text-brass">{labels.brand}</span>
        </button>

        {!isWorkspace && (
          <nav className="header-nav hidden min-w-0 items-center gap-1 lg:flex" aria-label={t.primaryNavigation}>
            {links.map((link) => (
              <a key={link.key} href={link.href} onClick={(event) => { event.preventDefault(); goToSection(link.href); }} className="nav-link whitespace-nowrap">
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={changeLanguage} className="icon-button header-compact-control min-w-16 gap-2 px-3" aria-label={`${language === 'en' ? t.switchToVietnamese : t.switchToEnglish} (${language})`} title={language === 'en' ? 'Tiếng Việt' : 'English'}>
            <Globe2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-extrabold uppercase leading-none">{language}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="icon-button min-w-16 gap-2 px-3"
            aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}
            title={theme === 'dark' ? t.themeToLight : t.themeToDark}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>

          {!isWorkspace && !authUser && (
            <button type="button" onClick={() => navigate('sign-in')} className="button-secondary header-cta">{labels.nav.signIn}</button>
          )}
          {!isWorkspace && authUser && (
            <button type="button" onClick={() => navigate('empty-chamber')} className="button-primary header-cta">
              {labels.nav.newDeliberation}
            </button>
          )}
          {authUser && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="button-secondary header-cta max-w-[13rem] truncate"
              title={authUser.email}
            >
              {t.signOut}
            </button>
          )}
          <button ref={menuButtonRef} type="button" className="icon-button header-menu min-w-11" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? t.close : t.menu}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-navigation" ref={mobileNavigationRef} className="mobile-navigation-panel border-t border-border bg-surface p-3 shadow-2xl">
          {isWorkspace ? (
            <WorkspaceMenu onNavigate={navigate} onClose={() => setMenuOpen(false)} />
          ) : (
            <nav className="mx-auto grid max-w-[1600px] gap-1" aria-label={t.mobileNavigation}>
              {links.map((link) => (
                <a key={link.key} href={link.href} onClick={(event) => { event.preventDefault(); goToSection(link.href); }} className="nav-link justify-between">
                  {link.label}
                </a>
              ))}
              {!authUser && (
                <button type="button" onClick={() => navigate('sign-in')} className="nav-link justify-between">
                  {labels.nav.signIn}
                </button>
              )}
              {authUser && (
                <button type="button" onClick={() => navigate('empty-chamber')} className="nav-link justify-between">
                  {labels.nav.newDeliberation}
                </button>
              )}
              {authUser && (
                <button type="button" onClick={() => { setMenuOpen(false); void signOut(); }} className="nav-link justify-between">
                  {t.signOut}
                </button>
              )}
            </nav>
          )}
          <p className="mx-auto mt-3 max-w-[1600px] border-t border-border/70 pt-3 text-[11px] leading-relaxed text-ink-muted">{t.boundaryShort}</p>
        </div>
      )}
    </header>
  );
};

const WorkspaceMenu: React.FC<{ onNavigate: (view: ViewType) => void; onClose: () => void }> = ({ onNavigate, onClose }) => {
  const { currentView, language, openJoinRoom, t } = useApp();
  const labels = translations[language];

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4">
      <button
        type="button"
        onClick={() => {
          onClose();
          openJoinRoom();
        }}
        className="button-primary w-full"
      >
        {labels.nav.newDeliberation}
      </button>
      <nav className="grid gap-1" aria-label={t.mobileNavigation}>
        {WORKSPACE_NAV.map((group) => (
          <div key={group.labelKey}>
            <p className="nav-group-label">{labels.navGroup[group.labelKey]}</p>
            {group.items.map(({ view, labelKey, icon: Icon }) => (
              <button key={view} type="button" onClick={() => onNavigate(view)} aria-current={currentView === view ? 'page' : undefined} className={`sidebar-link ${currentView === view ? 'sidebar-link-active' : ''}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {labels.nav[labelKey]}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
};
