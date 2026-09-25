import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, Globe2, Moon, RotateCcw, Sun } from 'lucide-react';
import { Modal } from './Modal';

export const SettingsView: React.FC = () => {
  const { language, setLanguage, theme, toggleTheme, purgeSessions, revokeAllKeys, t } = useApp();
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);

  return (
    <div className="content-shell space-y-7">
      <header className="page-header">
        <p className="eyebrow"><span className="status-dot" />{t.settingsEyebrow}</p>
        <h1>{t.settingsTitle}</h1>
        <p>{t.settingsBody}</p>
      </header>

      <section className="panel p-5 sm:p-6" aria-labelledby="local-profile-title">
        <h2 id="local-profile-title" className="panel-title">{t.localProfile}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.localProfileBody}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 sm:p-6" aria-labelledby="language-title">
          <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-brass" /><h2 id="language-title" className="panel-title">{t.language}</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label={t.language}>
            <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} className="setting-choice">
              <span>English</span>{language === 'en' && <Check className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setLanguage('vi')} aria-pressed={language === 'vi'} className="setting-choice">
              <span>Tiếng Việt</span>{language === 'vi' && <Check className="h-4 w-4" />}
            </button>
          </div>
        </section>

        <section className="panel p-5 sm:p-6" aria-labelledby="theme-title">
          <div className="flex items-center gap-2"><Moon className="h-4 w-4 text-brass" /><h2 id="theme-title" className="panel-title">{t.theme}</h2></div>
          <button type="button" onClick={toggleTheme} className="button-secondary mt-4 min-h-11 w-full justify-center">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? t.light : t.dark}
          </button>
        </section>
      </div>

      <section className="panel p-5 sm:p-6" aria-labelledby="sample-data-title">
        <h2 id="sample-data-title" className="panel-title">{t.sampleData}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.sampleDataBody}</p>
        <button type="button" onClick={() => setIsPurgeOpen(true)} className="button-danger mt-4 min-h-11"><RotateCcw className="h-4 w-4" />{t.clear}</button>
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="provider-state-title">
        <h2 id="provider-state-title" className="panel-title">{t.providerStates}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.providerStatesBody}</p>
        <button type="button" onClick={() => setIsProviderOpen(true)} className="button-secondary mt-4 min-h-11"><RotateCcw className="h-4 w-4" />{t.clearStates}</button>
      </section>
      <Modal
        isOpen={isPurgeOpen}
        onClose={() => setIsPurgeOpen(false)}
        title={t.clear}
        description={t.clearConfirm}
        closeLabel={t.close}
        footer={<><button type="button" onClick={() => setIsPurgeOpen(false)} className="button-secondary min-h-11 justify-center">{t.cancel}</button><button type="button" onClick={() => { setIsPurgeOpen(false); purgeSessions(); }} className="button-danger min-h-11 justify-center">{t.clear}</button></>}
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearConfirm}</p>
      </Modal>
      <Modal
        isOpen={isProviderOpen}
        onClose={() => setIsProviderOpen(false)}
        title={t.clearStates}
        description={t.clearStatesConfirm}
        closeLabel={t.close}
        footer={<><button type="button" onClick={() => setIsProviderOpen(false)} className="button-secondary min-h-11 justify-center">{t.cancel}</button><button type="button" onClick={() => { setIsProviderOpen(false); revokeAllKeys(); }} className="button-danger min-h-11 justify-center">{t.clearStates}</button></>}
      >
        <p className="text-sm leading-relaxed text-ink-muted">{t.clearStatesConfirm}</p>
      </Modal>
    </div>
  );
};
