import React from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileQuestion,
  GitBranch,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { setCurrentView, t } = useApp();

  const flow = [
    { icon: MessageSquareText, title: t.flow1Title, body: t.flow1Body },
    { icon: ShieldCheck, title: t.flow2Title, body: t.flow2Body },
    { icon: FileQuestion, title: t.flow3Title, body: t.flow3Body },
  ];
  const frameworks = [
    { icon: GitBranch, title: t.framework1Title, body: t.framework1Body },
    { icon: Layers3, title: t.framework2Title, body: t.framework2Body },
    { icon: SlidersHorizontal, title: t.framework3Title, body: t.framework3Body },
  ];
  const available = [t.available1, t.available2, t.available3];
  const unavailable = [t.unavailable1, t.unavailable2, t.unavailable3, t.unavailable4];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 py-6 sm:py-10">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:gap-12">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-3 py-1.5 text-xs font-medium text-brass">
            <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
            {t.overviewEyebrow}
          </p>
          <h1 className="max-w-4xl font-serif text-4xl font-normal leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t.overviewTitle1}
            <span className="mt-2 block text-ink-muted">{t.overviewTitle2}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.overviewBody}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setCurrentView('empty-chamber')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brass px-5 py-3 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {t.overviewPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('privacy')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:border-brass/50 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {t.overviewSecondary}
            </button>
          </div>
        </div>

        <aside
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
          aria-label={t.scopeTitle}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 text-brass">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-serif text-xl text-ink">{t.localBadge}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.boundaryShort}</p>
          <p className="mt-4 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs font-medium text-sage">
            {t.noAi}
          </p>
        </aside>
      </section>

      <section className="space-y-7" aria-labelledby="flow-title">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {t.flowEyebrow}
          </p>
          <h2 id="flow-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
            {t.flowTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.flowBody}</p>
        </header>
        <ol className="grid gap-4 md:grid-cols-3">
          {flow.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-brass">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-serif text-xl text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-7" aria-labelledby="framework-title">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {t.frameworkEyebrow}
          </p>
          <h2 id="framework-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
            {t.frameworkTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.frameworkBody}</p>
        </header>
        <div className="grid gap-4 lg:grid-cols-3">
          {frameworks.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <Icon className="h-5 w-5 text-brass" aria-hidden="true" />
              <h3 className="mt-4 font-serif text-xl text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="scope-title">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {t.accessTitle}
          </p>
          <h2 id="scope-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
            {t.directTitle}
          </h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-sage/40 bg-surface p-5 sm:p-6">
            <h3 className="flex items-center gap-2 font-serif text-xl text-ink">
              <CheckCircle2 className="h-5 w-5 text-sage" aria-hidden="true" />
              {t.availableTitle}
            </h3>
            <ul className="mt-4 space-y-3">
              {available.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="flex items-center gap-2 font-serif text-xl text-ink">
              <CircleDashed className="h-5 w-5 text-terracotta" aria-hidden="true" />
              {t.unavailableTitle}
            </h3>
            <ul className="mt-4 space-y-3">
              {unavailable.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
};
