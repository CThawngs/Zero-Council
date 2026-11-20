import { HeaderLoading } from "@/prototype/components/HeaderLoading";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background text-ink animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* Header Skeleton using shared HeaderLoading (Workspace mode) */}
      <HeaderLoading isWorkspace={true} />

      {/* Main Layout Skeleton */}
      <div className="flex min-h-screen flex-1 pt-[76px]">
        {/* Sidebar Skeleton (desktop) */}
        <aside className="sticky top-[76px] hidden h-[calc(100dvh-76px)] w-72 shrink-0 border-r border-border bg-surface-2/50 p-4 lg:flex lg:flex-col gap-4">
          <div className="h-10 w-full rounded-xl bg-surface-2" />
          <div className="space-y-2 pt-2">
            <div className="h-4 w-20 rounded bg-surface-2" />
            <div className="h-9 w-full rounded-lg bg-surface-2" />
            <div className="h-9 w-full rounded-lg bg-surface-2" />
            <div className="h-9 w-full rounded-lg bg-surface-2" />
          </div>
          <div className="mt-auto space-y-2 border-t border-border/50 pt-4">
            <div className="h-9 w-full rounded-lg bg-surface-2" />
            <div className="h-9 w-full rounded-lg bg-surface-2" />
          </div>
        </aside>

        {/* Content Area Skeleton */}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Title / Banner skeleton */}
            <div className="space-y-3">
              <div className="h-8 w-48 rounded-lg bg-surface-2" />
              <div className="h-4 w-96 max-w-full rounded bg-surface-2" />
            </div>

            {/* Input / Question Area Skeleton */}
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-sm">
              <div className="h-5 w-36 rounded bg-surface-2" />
              <div className="h-24 w-full rounded-xl bg-surface-2" />
              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <div className="h-8 w-24 rounded-lg bg-surface-2" />
                  <div className="h-8 w-24 rounded-lg bg-surface-2" />
                </div>
                <div className="h-9 w-28 rounded-lg bg-surface-2" />
              </div>
            </div>

            {/* Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="h-36 rounded-2xl border border-border bg-surface p-4 space-y-3">
                <div className="h-7 w-7 rounded-lg bg-surface-2" />
                <div className="h-5 w-32 rounded bg-surface-2" />
                <div className="h-4 w-full rounded bg-surface-2" />
              </div>
              <div className="h-36 rounded-2xl border border-border bg-surface p-4 space-y-3">
                <div className="h-7 w-7 rounded-lg bg-surface-2" />
                <div className="h-5 w-28 rounded bg-surface-2" />
                <div className="h-4 w-full rounded bg-surface-2" />
              </div>
              <div className="h-36 rounded-2xl border border-border bg-surface p-4 space-y-3">
                <div className="h-7 w-7 rounded-lg bg-surface-2" />
                <div className="h-5 w-36 rounded bg-surface-2" />
                <div className="h-4 w-full rounded bg-surface-2" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
