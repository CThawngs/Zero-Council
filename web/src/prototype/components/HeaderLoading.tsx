import React from 'react';
import { CouncilOrb } from './CouncilOrb';
import { Globe2, Menu } from 'lucide-react';

export interface HeaderLoadingProps {
  isWorkspace?: boolean;
}

export const HeaderLoading: React.FC<HeaderLoadingProps> = ({ isWorkspace = false }) => {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface-2/80 backdrop-blur-xl"
      aria-hidden="true"
    >
      <div className="mx-auto flex h-[75px] max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        {/* Brand logo & title */}
        <div className="group flex min-h-11 min-w-0 shrink items-center gap-2 text-left sm:gap-2.5">
          <span className="brand-mark">
            <CouncilOrb />
          </span>
          <span className="hidden min-[360px]:block truncate text-lg font-extrabold tracking-tight text-ink transition-colors group-hover:text-brass sm:text-xl">
            Zero Council
          </span>
        </div>

        {/* Navigation skeleton only for Home / Landing page */}
        {!isWorkspace && (
          <nav className="header-nav hidden min-w-0 items-center gap-6 lg:flex">
            <div className="h-4 w-20 rounded bg-surface-2" />
            <div className="h-4 w-16 rounded bg-surface-2" />
            <div className="h-4 w-24 rounded bg-surface-2" />
          </nav>
        )}

        {/* Controls skeleton (Language, Theme, CTA / Sign In, Menu) */}
        <div className="flex items-center gap-1.5">
          {/* Language button skeleton */}
          <div className="icon-button header-compact-control min-w-16 gap-2 px-3 opacity-80 pointer-events-none">
            <Globe2 className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <div className="h-4 w-6 rounded bg-surface-2" />
          </div>

          {/* Theme button skeleton */}
          <div className="icon-button min-w-16 gap-2 px-3 opacity-80 pointer-events-none">
            <div className="h-4 w-4 rounded-full bg-surface-2" />
          </div>

          {/* CTA / Action button skeleton */}
          <div className="button-secondary header-cta min-w-[5rem] max-w-[13rem] opacity-80 pointer-events-none flex items-center justify-center">
            <div className="h-4 w-14 rounded bg-surface-2" />
          </div>

          {/* Mobile menu button skeleton */}
          <div className="icon-button header-menu min-w-11 opacity-80 pointer-events-none flex items-center justify-center">
            <Menu className="h-5 w-5 text-ink-muted" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderLoading;
