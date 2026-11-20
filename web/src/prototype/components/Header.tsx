import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';
import type { ViewType } from '../types';
import { Globe2, Lock, Menu, Moon, Plus, Sun, Users, X } from 'lucide-react';
import { CouncilOrb } from './CouncilOrb';
import { MARKETING_NAV, WORKSPACE_NAV } from '../navigation';
import { MobileSidebar } from './MobileSidebar';

interface HeaderProps {
  isWorkspace: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isWorkspace }) => {
  const {
    language,
    setLanguage,
    setCurrentView,
    theme,
    toggleTheme,
    t,
    authUser,
    signOut,
  } = useApp();
  const router = useRouter();
  const labels = translations[language];
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !headerRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };

    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    desktopQuery.addEventListener('change', closeOnDesktop);
    mobileNavigationRef.current
      ?.querySelector<HTMLElement>('a[href], button:not(:disabled)')
      ?.focus();

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
    const scroll = () =>
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      try {
        sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
      } catch {}
      setCurrentView('overview');
      router.push(`/${href}`);
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.replace('/');
    }
    setCurrentView('overview');
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  };

  return (
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-40 border-b border-border bg-surface-2/80 ${menuOpen ? '' : 'backdrop-blur-xl'}`}
    >
      <div className="mx-auto flex h-[75px] max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('overview')}
          className="group flex min-h-11 min-w-0 shrink-0 items-center gap-2 text-left sm:gap-2.5"
        >
          <span className="brand-mark">
            <CouncilOrb />
          </span>
          <span className="block truncate text-lg font-extrabold tracking-tight text-ink transition-colors group-hover:text-brass sm:text-xl">
            {labels.brand}
          </span>
        </button>

        {!isWorkspace && (
          <nav
            className="header-nav hidden min-w-0 items-center gap-1 lg:flex"
            aria-label={t.primaryNavigation}
          >
            {links.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  goToSection(link.href);
                }}
                className="nav-link whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* MỤC PHẢI */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={changeLanguage}
            className="icon-button header-compact-control min-w-12 gap-1.5 px-2.5 sm:min-w-16 sm:gap-2 sm:px-3"
            aria-label={`${
              language === 'en' ? t.switchToVietnamese : t.switchToEnglish
            } (${language})`}
            title={language === 'en' ? 'Tiếng Việt' : 'English'}
          >
            <Globe2 className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="text-xs font-extrabold uppercase leading-none sm:text-sm">
              {language}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="icon-button min-w-11 px-2.5 sm:min-w-14 sm:px-3"
            aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}
            title={theme === 'dark' ? t.themeToLight : t.themeToDark}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {!isWorkspace && !authUser && (
            <button
              type="button"
              onClick={() => navigate('sign-in')}
              className="button-secondary header-cta"
            >
              {labels.nav.signIn}
            </button>
          )}
          {!isWorkspace && authUser && (
            <button
              type="button"
              onClick={() => navigate('empty-chamber')}
              className="button-primary header-cta"
            >
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
          {/* MENU MOBILE */}
          <button
            ref={menuButtonRef}
            type="button"
            id="mobile-menu-toggle"
            className="icon-button header-menu min-w-11"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? t.close : t.menu}
          >
            {!isWorkspace
              ? menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />
              : <Menu className="h-5 w-5" />
            }
          </button>
        </div>
      </div>

      {/* Workspace Mobile Sidebar */}
      {isWorkspace && (
        <MobileSidebar
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Marketing Mobile Menu */}
      {menuOpen && !isWorkspace && (
        <div
          id="mobile-navigation"
          ref={mobileNavigationRef}
          className="mobile-navigation-panel max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-border bg-surface p-3 shadow-2xl"
        >
          <nav
            className="mx-auto grid max-w-[1600px] gap-1"
            aria-label={t.mobileNavigation}
          >
            {links.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  goToSection(link.href);
                }}
                className="nav-link justify-between"
              >
                {link.label}
              </a>
            ))}

            {!authUser && (
              <button
                type="button"
                onClick={() => navigate('sign-in')}
                className="nav-link justify-between"
              >
                {labels.nav.signIn}
              </button>
            )}

            {authUser && (
              <button
                type="button"
                onClick={() => navigate('empty-chamber')}
                className="nav-link justify-between"
              >
                {labels.nav.newDeliberation}
              </button>
            )}

            {authUser && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="nav-link justify-between"
              >
                {t.signOut}
              </button>
            )}
          </nav>

          <p className="mx-auto mt-3 max-w-[1600px] border-t border-border/70 pt-3 text-[11px] leading-relaxed text-ink-muted">
            {t.boundaryShort}
          </p>
        </div>
      )}
    </header>
  );
};
