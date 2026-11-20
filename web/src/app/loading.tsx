import { HeaderLoading } from "@/prototype/components/HeaderLoading";

export { HeaderLoading };

export default function HomeLoading() {
  return (
    <div
      className="min-h-screen bg-background text-ink animate-pulse"
      aria-busy="true"
      aria-label="Loading home"
    >
      {/* Header Loading (Home / Landing mode) */}
      <HeaderLoading isWorkspace={false} />

      {/* Body placeholder */}
      <div className="flex min-h-screen flex-1 pt-[76px]" />
    </div>
  );
}
