import { cookies } from 'next/headers';
import Link from 'next/link';
import { cookieLanguage } from '@/prototype/types';

const NOT_FOUND_COPY = {
  en: {
    badge: '404 \u00b7 Page Not Found',
    title: 'This council chamber does not exist.',
    description:
      'The page you requested may have moved, expired, or never existed. Return to the home page or jump back into your workspace.',
    homeCta: 'Back to Home',
    dashboardCta: 'Open Dashboard',
  },
  vi: {
    badge: '404 \u00b7 Kh\u00f4ng t\u00ecm th\u1ea5y trang',
    title: 'Ph\u00f2ng h\u1ed9i \u0111\u1ed3ng n\u00e0y kh\u00f4ng t\u1ed3n t\u1ea1i.',
    description:
      'Trang b\u1ea1n y\u00eau c\u1ea7u c\u00f3 th\u1ec3 \u0111\u00e3 \u0111\u01b0\u1ee3c di chuy\u1ec3n, h\u1ebft h\u1ea1n ho\u1eb7c kh\u00f4ng t\u1ed3n t\u1ea1i. H\u00e3y quay v\u1ec1 trang ch\u1ee7 ho\u1eb7c m\u1edf kh\u00f4ng gian l\u00e0m vi\u1ec7c.',
    homeCta: 'V\u1ec1 trang ch\u1ee7',
    dashboardCta: 'M\u1edf b\u1ea3ng \u0111i\u1ec1u khi\u1ec3n',
  },
} as const;

export default async function NotFound() {
  const cookieStore = await cookies();
  const lang = cookieStore.get(cookieLanguage)?.value === 'vi' ? 'vi' : 'en';
  const text = NOT_FOUND_COPY[lang];

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-12 text-ink">
      <section
        aria-labelledby="zc-not-found-title"
        className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          <span>Zero Council</span>
          <span aria-hidden="true">&middot;</span>
          <span>{text.badge}</span>
        </div>

        <h1
          id="zc-not-found-title"
          className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
        >
          {text.title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
          {text.description}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-center text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
          >
            {text.homeCta}
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface-2 px-5 py-2.5 text-center text-sm font-semibold text-ink transition-colors hover:bg-background"
          >
            {text.dashboardCta}
          </Link>
        </div>
      </section>
    </main>
  );
}