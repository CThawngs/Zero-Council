import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, LockKeyhole } from 'lucide-react';

export const PricingView: React.FC = () => {
  const { setCurrentView, t } = useApp();
  return (
    <div className="content-shell max-w-3xl space-y-7">
      <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3"><ArrowLeft className="h-4 w-4" />{t.back}</button>
      <header className="page-header"><p className="eyebrow"><span className="status-dot" />{t.localBadge}</p><h1>{t.scopeTitle}</h1><p>{t.scopeBody}</p></header>
      <section className="panel flex gap-4 p-5 sm:p-7"><LockKeyhole className="h-6 w-6 shrink-0 text-brass" /><div><h2 className="font-serif text-xl text-ink">{t.scopeUnavailable}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.scopeUnavailableBody}</p></div></section>
      <div className="grid gap-4 md:grid-cols-3"><article className="panel p-5"><h2 className="font-serif text-lg text-ink">{t.scopeIncluded}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.scopeIncludedBody}</p></article><article className="panel p-5"><h2 className="font-serif text-lg text-ink">{t.scopeLocal}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.scopeLocalBody}</p></article><article className="panel p-5"><h2 className="font-serif text-lg text-ink">{t.scopeUnavailable}</h2><p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.scopeUnavailableBody}</p></article></div>
      <button type="button" onClick={() => setCurrentView('overview')} className="button-primary min-h-11">{t.returnOverview}</button>
    </div>
  );
};
