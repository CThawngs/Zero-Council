import React from 'react';
import { GitBranch, KeyRound, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CouncilOrb } from './CouncilOrb';

/**
 * Decorative left-hand panel for the sign-in / sign-up pages. Purely presentational — carries no
 * auth state or logic of its own.
 */
export const AuthShowcase: React.FC = () => {
  const { t } = useApp();

  const features = [
    { icon: Users, title: t.authShowcaseFeature1Title, body: t.authShowcaseFeature1Body },
    { icon: KeyRound, title: t.authShowcaseFeature2Title, body: t.authShowcaseFeature2Body },
    { icon: GitBranch, title: t.authShowcaseFeature3Title, body: t.authShowcaseFeature3Body },
  ];

  return (
    <div className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 28%, color-mix(in srgb, var(--color-brass) 16%, transparent), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-1 flex-col justify-center px-10 py-16 xl:px-14">
        <CouncilOrb />
        <h2 className="mt-8 max-w-xs font-serif text-3xl leading-tight text-ink xl:text-4xl">
          {t.authShowcaseTitle}
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">{t.authShowcaseBody}</p>

        <ul className="mt-10 max-w-sm space-y-6">
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-brass">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};