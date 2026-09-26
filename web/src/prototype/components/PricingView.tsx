import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft } from 'lucide-react';

// Plan names, limits and prices are commercial truth owned by the project
// lead (AGENTS.md 28.3) — they are not invented here. Add the plan grid once
// the published table exists.
export const PricingView: React.FC = () => {
  const { setCurrentView, t } = useApp();
  return (
    <div className="content-shell max-w-3xl space-y-7">
      <button type="button" onClick={() => setCurrentView('overview')} className="button-quiet -ml-3"><ArrowLeft className="h-4 w-4" />{t.back}</button>
      <header className="page-header">
        <p className="eyebrow"><span className="status-dot" />{t.whyEyebrow}</p>
        <h1>{t.pricingTitle}</h1>
        <p>{t.pricingBody}</p>
      </header>
    </div>
  );
};
