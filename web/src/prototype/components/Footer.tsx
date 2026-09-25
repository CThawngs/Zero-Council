import React from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n';

export const Footer: React.FC = () => {
  const { setCurrentView, language, t } = useApp();
  const labels = translations[language];
  return (
    <footer className="border-t border-border/70 bg-surface/25">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-6 text-[11px] text-ink-muted sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>© 2026 {labels.brand}. {t.footerNote}</p>
        <nav className="flex flex-wrap gap-4" aria-label={t.footerNavigation}>
          <button type="button" onClick={() => setCurrentView('privacy')} className="footer-link">{t.privacyEyebrow}</button>
          <button type="button" onClick={() => setCurrentView('privacy')} className="footer-link">{labels.nav.scope}</button>
        </nav>
      </div>
    </footer>
  );
};
