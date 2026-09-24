import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  isWorkspace?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isWorkspace = false }) => {
  const { currentView, setCurrentView, language, setLanguage, theme, toggleTheme, t, startNewSession } =
    useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPublicPage =
    currentView === 'overview' || currentView === 'sign-in' || currentView === 'pricing' || currentView === 'privacy';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-border transition-colors">
      <div className="h-6 md:h-5 bg-brass text-background flex items-center justify-center px-4 text-center text-[9px] sm:text-[10px] font-semibold tracking-wide">
        UI PROTOTYPE · NO AI, AUTH, PAYMENT, OR KEY TRANSMISSION
      </div>
      <div className={`h-16 md:h-20 ${isWorkspace ? 'px-4 sm:px-6 md:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 md:px-12'} flex items-center justify-between gap-4`}>
        {/* Left: Brand or Workspace Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Logo Mark */}
          <button
            onClick={() => setCurrentView('overview')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            type="button"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-brass shadow-[0_0_8px_rgba(201,162,75,0.4)] transition-transform group-hover:scale-110"></div>
            <span className="font-serif text-lg md:text-xl font-normal tracking-tight text-ink">
              {t.brand}
            </span>
          </button>

          {/* Breadcrumb separator if in workspace */}
          {isWorkspace && (
            <div className="hidden sm:flex items-center gap-2 text-xs md:text-sm text-ink-muted pl-2 border-l border-border">
              <span>{t.nav.deliberationBreadcrumb}</span>
              <span className="text-border">/</span>
              <span className="text-ink font-medium">
                {currentView === 'sessions'
                  ? t.nav.sessions
                  : currentView === 'personas' || currentView === 'new-advisor'
                  ? t.nav.personas
                  : currentView === 'api-keys'
                  ? t.nav.apiKeys
                  : currentView === 'settings'
                  ? t.nav.settings
                  : currentView === 'billing-history'
                  ? 'Billing History'
                  : t.nav.currentSession}
              </span>
            </div>
          )}
        </div>

        {/* Center: Clean Public Navigation (4-6 links, text only, no pills) */}
        {!isWorkspace && (
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-muted">
            <button
              onClick={() => setCurrentView('overview')}
              className={`hover:text-ink transition-colors pb-0.5 ${
                currentView === 'overview' ? 'text-ink border-b border-brass' : ''
              }`}
              type="button"
            >
              {t.nav.howItWorks}
            </button>
            <button
              onClick={() => setCurrentView('overview')}
              className="hover:text-ink transition-colors pb-0.5"
              type="button"
            >
              {t.nav.whyZeroCouncil}
            </button>
            <button
              onClick={() => setCurrentView('pricing')}
              className={`hover:text-ink transition-colors pb-0.5 ${
                currentView === 'pricing' ? 'text-ink border-b border-brass' : ''
              }`}
              type="button"
            >
              {t.nav.pricing}
            </button>
          </nav>
        )}

        {/* Right: Actions, Language Switcher, Theme Switcher, CTAs */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher Button */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
            className="px-1.5 sm:px-2.5 py-1.5 rounded-md border border-border bg-surface hover:bg-surface/80 text-xs font-medium text-ink transition-colors flex items-center gap-1.5"
            title={language === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'}
            type="button"
          >
            <span className="text-brass font-serif font-bold text-[11px]">
              {language === 'en' ? 'EN' : 'VI'}
            </span>
            <span className="text-ink-muted hidden sm:inline text-[11px]">
              {language === 'en' ? 'English' : 'Tiếng Việt'}
            </span>
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md border border-border bg-surface hover:bg-surface/80 text-ink-muted hover:text-ink transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            type="button"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-brass" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-brass" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Public CTAs */}
          {isPublicPage ? (
            <>
              <button
                onClick={() => setCurrentView('sign-in')}
                className="hidden sm:inline-flex px-3 py-1.5 text-xs sm:text-sm font-medium text-ink-muted hover:text-ink transition-colors"
                type="button"
              >
                {t.nav.signIn}
              </button>
              <button
                onClick={() => setCurrentView('empty-chamber')}
                className="hidden sm:inline-flex px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md bg-brass hover:bg-brass/90 text-background transition-colors shadow-sm"
                type="button"
              >
                {t.nav.getStarted}
              </button>
            </>
          ) : (
            /* Workspace CTAs */
            <>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-md border border-border bg-surface text-[11px] font-medium text-ink-muted">
                {t.nav.freeBadge}
              </span>
              <button
                onClick={() => startNewSession()}
                className="px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md bg-brass hover:bg-brass/90 text-background transition-colors flex items-center gap-1.5 shadow-sm"
                type="button"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="whitespace-nowrap">{t.nav.startNewSession}</span>
              </button>
              {/* User Avatar Circle */}
              <button
                onClick={() => setCurrentView('settings')}
                className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-ink-muted hover:text-ink transition-colors shrink-0"
                title="Sample Operator · Settings"
                type="button"
              >
                <svg className="w-4 h-4 text-brass" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
            </>
          )}

          {/* Mobile Menu Hamburger (for public screens) */}
          {!isWorkspace && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-ink-muted hover:text-ink"
              type="button"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {!isWorkspace && mobileMenuOpen && (
        <div className="md:hidden bg-surface border-b border-border px-6 py-4 flex flex-col gap-3">
          <button
            onClick={() => {
              setCurrentView('overview');
              setMobileMenuOpen(false);
            }}
            className="text-left text-sm font-medium text-ink py-1.5"
            type="button"
          >
            {t.nav.howItWorks}
          </button>
          <button
            onClick={() => {
              setCurrentView('overview');
              setMobileMenuOpen(false);
            }}
            className="text-left text-sm font-medium text-ink py-1.5"
            type="button"
          >
            {t.nav.whyZeroCouncil}
          </button>
          <button
            onClick={() => {
              setCurrentView('pricing');
              setMobileMenuOpen(false);
            }}
            className="text-left text-sm font-medium text-ink py-1.5"
            type="button"
          >
            {t.nav.pricing}
          </button>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentView('sign-in');
                setMobileMenuOpen(false);
              }}
              className="text-xs font-medium text-ink-muted hover:text-ink"
              type="button"
            >
              {t.nav.signIn}
            </button>
            <button
              onClick={() => {
                setCurrentView('empty-chamber');
                setMobileMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-md bg-brass text-background text-xs font-medium"
              type="button"
            >
              {t.nav.getStarted}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
