import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clipboard, Cpu, EyeOff, LockKeyhole } from 'lucide-react';

export const PrivacyView: React.FC = () => {
  const { setCurrentView, t } = useApp();
  const cards = [
    { icon: LockKeyhole, title: t.browserMemory, body: t.browserMemoryBody },
    { icon: Cpu, title: t.noModels, body: t.noModelsBody },
    { icon: EyeOff, title: t.noCredentials, body: t.noCredentialsBody },
  ];
  const boundaries = [
    { icon: LockKeyhole, title: t.noNetworkTitle, body: t.noNetworkBody },
    { icon: EyeOff, title: t.ephemeral, body: t.ephemeralBody },
    { icon: Clipboard, title: t.clipboardTitle, body: t.clipboardBody },
  ];

  return (
    <div className="content-shell space-y-8">
      <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3"><ArrowLeft className="h-4 w-4" />{t.back}</button>
      <header className="page-header">
        <p className="eyebrow"><span className="status-dot" />{t.privacyEyebrow}</p>
        <h1>{t.privacyTitle}</h1>
        <p>{t.privacyBody}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, title, body }) => (
          <article key={title} className="panel p-5">
            <div className="icon-tile"><Icon className="h-4 w-4" aria-hidden="true" /></div>
            <h2 className="mt-4 font-serif text-lg text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
          </article>
        ))}
      </div>

      <section className="panel p-5 sm:p-7" aria-labelledby="boundary-title">
        <h2 id="boundary-title" className="panel-title">{t.currentBoundary}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t.boundaryIntro}</p>
        <div className="mt-5 grid gap-3">
          {boundaries.map(({ icon: Icon, title, body }) => (
            <div key={title} className="boundary-row">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <div><h3 className="text-sm font-medium text-ink">{title}</h3><p className="mt-1 text-xs leading-relaxed text-ink-muted">{body}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
