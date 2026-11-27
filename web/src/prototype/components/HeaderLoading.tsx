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
            <div className="h-4 w-20 rounded border border-border/60 bg-surface-2" />
            <div className="h-4 w-16 rounded border border-border/60 bg-surface-2" />
            <div className="h-4 w-24 rounded border border-border/60 bg-surface-2" />
          </nav>
        )}

        {/* Controls skeleton (Language, Theme, CTA / Sign In, Menu) */}
        <div className="flex items-center gap-1.5">
          <div className="icon-button header-compact-control pointer-events-none min-w-16 gap-2 px-3 opacity-80">
            <Globe2 className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <div className="h-4 w-6 rounded border border-border/60 bg-surface-2" />
          </div>

          <div className="icon-button pointer-events-none min-w-16 gap-2 px-3 opacity-80">
            <div className="h-4 w-4 rounded-full border border-border/60 bg-surface-2" />
          </div>

          <div className="button-secondary header-cta pointer-events-none flex min-w-[5rem] max-w-[13rem] items-center justify-center opacity-80">
            <div className="h-4 w-14 rounded border border-border/60 bg-surface-2" />
          </div>

          <div className="icon-button header-menu pointer-events-none flex min-w-11 items-center justify-center opacity-80">
            <Menu className="h-5 w-5 text-ink-muted" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderLoading;
