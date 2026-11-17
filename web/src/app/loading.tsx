import { CouncilOrb } from "@/prototype/components/CouncilOrb";
import { Globe2, Menu } from "lucide-react";

export function HeaderLoading() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface-2/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[75px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="group flex min-h-11 min-w-0 shrink-0 items-center gap-2.5 text-left">
          <span className="brand-mark">
            <CouncilOrb />
          </span>
          <span className="block whitespace-nowrap text-xl font-extrabold tracking-tight text-ink transition-colors group-hover:text-brass">Zero Council</span>          
        </div>

        <div className="flex items-center gap-1.5">
            <button type="button" className="icon-button header-compact-control min-w-16 gap-2 px-3">
                <Globe2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="text-sm font-extrabold uppercase leading-none">
                    <div className="h-5 w-8 rounded bg-surface-2" />
                </span>
            </button>

            <button
                type="button"
                className="icon-button min-w-16 gap-2 px-3"
            >
                <div className="h-5 w-5 rounded bg-surface-2" />
            </button>
            <button
                type="button"
                className="button-secondary header-cta max-w-[13rem] truncate"
            >
                <div className="h-5 w-15 rounded bg-surface-2" />
            </button>
            <button type="button" className="icon-button header-menu min-w-11" aria-controls="mobile-navigation">
                <Menu className="h-5 w-5" />
            </button>
        </div>
      </div>
    </header>
  );

/**
 * Mobile panel for signed-in screens. Renders the SAME grouped array the
 * desktop sidebar renders, so the two can never drift — the failure that left
 * the old mobile menu without `Council room` and `Billing`.
 */
  return (
    <div className="mx-auto grid max-w-[1600px] gap-4">
      <button
        type="button"
        className="button-primary w-full"
      >
      </button>
    </div>
  );
};

export default function HomeLoading() {
    return (
        <div className="min-h-screen bg-background text-ink animate-pulse" aria-busy="true" aria-label="Loading home">
            <div className="fixed top-0 inset-x-0 h-[76px] border-b border-border bg-surface/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between z-40">
                <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-surface-2" />
                <div className="h-6 w-32 rounded-md bg-surface-2" />
                </div>
                <div className="flex items-center gap-3">
                <div className="h-9 w-24 rounded-lg bg-surface-2 hidden sm:block" />
                <div className="h-9 w-9 rounded-full bg-surface-2" />
                </div>
            </div>
            <div className="flex min-h-screen flex-1 pt-[76px]" />
        </div>
        
    );
}