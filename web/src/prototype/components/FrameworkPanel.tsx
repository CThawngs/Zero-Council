import React from 'react';
import type { Copy } from '../i18n';
import type { DeliberationSession, ScenarioBranch } from '../types';
import type { Round } from '@/lib/deliberation/types';

interface Props {
  round: Round;
  session: DeliberationSession;
  t: Copy;
}

const ScenariosPanel: React.FC<Props> = ({ session }) => {
  const branches: {
    id: 'good' | 'normal' | 'bad';
    branch: ScenarioBranch;
    borderClass: string;
    dotClass: string;
  }[] = [
    {
      id: 'good',
      branch: session.scenarios.good,
      borderClass: 'border-sage/45 bg-surface',
      dotClass: 'bg-sage',
    },
    {
      id: 'normal',
      branch: session.scenarios.normal,
      borderClass: 'border-brass/45 bg-surface',
      dotClass: 'bg-brass',
    },
    {
      id: 'bad',
      branch: session.scenarios.bad,
      borderClass: 'border-terracotta/45 bg-surface',
      dotClass: 'bg-terracotta',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {branches.map(({ id, branch, borderClass, dotClass }) => (
        <div key={id} className={`rounded-2xl border p-5 ${borderClass}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
            <h4 className="font-serif text-lg text-ink">{branch.title}</h4>
          </div>
          <p className="mt-1 text-xs text-ink-muted">{branch.subtitle}</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
            {branch.description}
          </p>
          <ul className="mt-4 space-y-2">
            {branch.actions.map((action, idx) => (
              <li
                key={`${idx}-${action}`}
                className="border-l-2 border-brass/40 pl-3 text-sm text-ink-muted"
              >
                {action}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const FrameworkPanel: React.FC<Props> = (props) => {
  const { t } = props;
  return (
    <section aria-labelledby="framework-panel-heading" className="rounded-2xl border border-border p-6">
      <h3 id="framework-panel-heading" className="font-serif text-xl text-ink">
        {t.scenariosLabel}
      </h3>
      <div className="mt-4">
        <ScenariosPanel {...props} />
      </div>
    </section>
  );
};

export default FrameworkPanel;
