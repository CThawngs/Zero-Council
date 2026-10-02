import React from 'react';
import { useApp } from '../context/AppContext';
import { CouncilOrb } from './CouncilOrb';
import { Reveal } from './Reveal';
import { PLANS, planPrice } from '../data/plans';
import {
  ArrowRight,
  FileQuestion,
  GitBranch,
  KeyRound,
  Layers3,
  MessageSquareText,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { setCurrentView, t, language } = useApp();

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
  const reasons = [
    { icon: Tags, title: t.why1Title, body: t.why1Body },
    { icon: KeyRound, title: t.why2Title, body: t.why2Body },
    { icon: Scale, title: t.why3Title, body: t.why3Body },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 py-6 sm:py-10">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:gap-12">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-3 py-1.5 text-xs font-medium text-brass">
            <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
            {t.overviewEyebrow}
          </p>
          <h1 className="max-w-4xl font-serif text-4xl font-normal leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t.overviewTitle}
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
            <a
              href="#how-it-works"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:border-brass/50 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {t.overviewSecondary}
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <CouncilOrb />
          <aside
            className="w-full rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
            aria-label={t.overviewPrimary}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 text-brass">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-serif text-xl leading-snug text-ink">{t.heroTrustTitle}</h2>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 space-y-7" aria-labelledby="flow-title">
        <Reveal>
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              {t.flowEyebrow}
            </p>
            <h2 id="flow-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
              {t.flowTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.flowBody}</p>
          </header>
        </Reveal>
        <ol className="grid gap-4 md:grid-cols-3">
          {flow.map(({ icon: Icon, title, body }, index) => (
            <Reveal
              key={title}
              as="li"
              delayMs={index * 90}
              className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-brass">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-serif text-xl text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="space-y-7" aria-labelledby="framework-title">
        <Reveal>
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              {t.frameworkEyebrow}
            </p>
            <h2 id="framework-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
              {t.frameworkTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.frameworkBody}</p>
          </header>
        </Reveal>
        <div className="grid gap-4 lg:grid-cols-3">
          {frameworks.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delayMs={index * 90}>
              <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <Icon className="h-5 w-5 text-brass" aria-hidden="true" />
                <h3 className="mt-4 font-serif text-xl text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="why-zero-council" className="scroll-mt-24 space-y-7" aria-labelledby="why-title">
        <Reveal>
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              {t.whyEyebrow}
            </p>
            <h2 id="why-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
              {t.whyTitle}
            </h2>
          </header>
        </Reveal>
        <div className="grid gap-4 lg:grid-cols-3">
          {reasons.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delayMs={index * 90}>
              <article className="h-full rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-brass">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-serif text-xl text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 space-y-6" aria-labelledby="pricing-teaser-title">
        <Reveal>
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              {t.pricingTeaserEyebrow}
            </p>
            <h2 id="pricing-teaser-title" className="mt-2 font-serif text-3xl text-ink sm:text-4xl">
              {t.pricingTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.pricingTeaserBody}</p>
          </header>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.id} delayMs={index * 90}>
              <article
                className={`flex h-full flex-col gap-2 rounded-2xl border bg-surface p-5 ${
                  plan.popular ? 'border-brass/60' : 'border-border'
                }`}
              >
                <h3 className="text-sm font-semibold text-ink">{plan.name}</h3>
                <p className="font-serif text-xl text-ink">{planPrice(plan, language)}</p>
                <p className="text-xs leading-relaxed text-ink-muted">
                  {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('pricing')}
          className="button-primary"
        >
          {t.pricingTitle}
        </button>
      </section>
    </div>
  );
};
