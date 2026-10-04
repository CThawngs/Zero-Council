import React from 'react';
import { GitBranch, KeyRound, Users } from 'lucide-react';
import { CouncilOrb } from './CouncilOrb';

const FEATURES = [
  {
    icon: Users,
    title: 'Multiple advisors, one conversation',
    body: 'Each model argues its own corner — parallel takes or a live back-and-forth, your call.',
  },
  {
    icon: KeyRound,
    title: 'Your own API keys',
    body: 'Bring keys from any provider. You pick the models, you see the cost.',
  },
  {
    icon: GitBranch,
    title: 'Good / baseline / risk, mapped out',
    body: 'Every recommendation branches into the scenarios behind it, not just a verdict.',
  },
];

/**
 * Decorative left-hand panel for the sign-in / sign-up pages. Purely
 * presentational — carries no auth state or logic of its own.
 */
export const AuthShowcase: React.FC = () => {
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
          A council, not a single opinion
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
          Convene a handful of AI advisors, each with its own model and point of view, before you commit to a decision.
        </p>

        <ul className="mt-10 max-w-sm space-y-6">
          {FEATURES.map(({ icon: Icon, title, body }) => (
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
