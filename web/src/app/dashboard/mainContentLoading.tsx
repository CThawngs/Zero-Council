export default function MainContentLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      className="min-w-0 flex-1 animate-pulse px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Title / Banner skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-48 rounded-lg border border-border/60 bg-surface-2" />
          <div className="h-4 w-96 max-w-full rounded border border-border/60 bg-surface-2" />
        </div>

        {/* Input / Question Area Skeleton */}
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="h-5 w-36 rounded border border-border/60 bg-surface-2" />
          <div className="h-24 w-full rounded-xl border border-border/60 bg-surface-2" />
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-lg border border-border/60 bg-surface-2" />
              <div className="h-8 w-24 rounded-lg border border-border/60 bg-surface-2" />
            </div>
            <div className="h-9 w-28 rounded-lg border border-border/60 bg-surface-2" />
          </div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-3">
          <div className="h-36 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="h-7 w-7 rounded-lg border border-border/60 bg-surface-2" />
            <div className="h-5 w-32 rounded border border-border/60 bg-surface-2" />
            <div className="h-4 w-full rounded border border-border/60 bg-surface-2" />
          </div>
          <div className="h-36 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="h-7 w-7 rounded-lg border border-border/60 bg-surface-2" />
            <div className="h-5 w-28 rounded border border-border/60 bg-surface-2" />
            <div className="h-4 w-full rounded border border-border/60 bg-surface-2" />
          </div>
          <div className="h-36 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="h-7 w-7 rounded-lg border border-border/60 bg-surface-2" />
            <div className="h-5 w-36 rounded border border-border/60 bg-surface-2" />
            <div className="h-4 w-full rounded border border-border/60 bg-surface-2" />
          </div>
        </div>
      </div>
    </main>
  );
}
