'use client';

import { HeaderLoading } from '@/prototype/components/HeaderLoading';
import { useOptionalApp } from '@/prototype/context/AppContext';
import { copy } from '@/prototype/i18n';

export { HeaderLoading };

export default function HomeLoading() {
  const app = useOptionalApp();
  const label = app?.t.loadingHome ?? copy.en.loadingHome;

  return (
    <div
      className="min-h-screen bg-background text-ink animate-pulse"
      aria-busy="true"
      aria-label={label}
    >
      {/* Header Loading (Home / Landing mode) */}
      <HeaderLoading isWorkspace={false} />

      {/* Body placeholder */}
      <div className="flex min-h-screen flex-1 pt-[76px]" />
    </div>
  );
}
