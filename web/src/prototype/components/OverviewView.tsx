import React from 'react';
import { useApp } from '../context/AppContext';
import { CouncilOrb } from './CouncilOrb';
import { Reveal } from './Reveal';
import { PLANS, planPrice } from '../data/plans';
import {
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  GitBranch,
  KeyRound,
  Layers3,
  MessageSquareText,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Users2,
  Zap,
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { setCurrentView, t, language, authUser, authReady, requestCheckout } = useApp();

  const flow = [
    { icon: MessageSquareText, title: t.flow1Title, body: t.flow1Body, badge: t.badgeStep1, tint: 'var(--tint-blue)' },
    { icon: ShieldCheck, title: t.flow2Title, body: t.flow2Body, badge: t.badgeStep2, tint: 'var(--tint-violet)' },
    { icon: FileQuestion, title: t.flow3Title, body: t.flow3Body, badge: t.badgeStep3, tint: 'var(--tint-green)' },
  ];
  const frameworks = [
    { icon: GitBranch, title: t.framework1Title, body: t.framework1Body, tag: t.framework1Tag, tint: 'var(--tint-orange)' },
    { icon: Layers3, title: t.framework2Title, body: t.framework2Body, tag: t.framework2Tag, tint: 'var(--tint-pink)' },
    { icon: SlidersHorizontal, title: t.framework3Title, body: t.framework3Body, tag: t.framework3Tag, tint: 'var(--tint-blue)' },
  ];
  const reasons = [
    { icon: Tags, title: t.why1Title, body: t.why1Body, tint: 'var(--tint-yellow)' },
    { icon: KeyRound, title: t.why2Title, body: t.why2Body, tint: 'var(--tint-violet)' },
    { icon: Scale, title: t.why3Title, body: t.why3Body, tint: 'var(--tint-green)' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-20 py-8 sm:py-12">
      {/* Hero: headline + CTA on the left, 3D council stage on the right. */}
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:gap-14">
        <div className="w-full">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-bold text-ink">
            <Sparkles className="h-3.5 w-3.5 text-[var(--tint-violet)]" aria-hidden="true" />
            <span className="text-ink-muted">{t.overviewEyebrow}</span>
          </div>

          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t.overviewTitle}
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">{t.overviewBody}</p>

          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setCurrentView('empty-chamber')} className="button-primary text-base">
              <span>{t.overviewPrimary}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a href="#how-it-works" className="button-secondary text-base">
              {t.overviewSecondary}
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-6 text-xs font-bold text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--tint-green)]" aria-hidden="true" />
              <span>{t.localBadge}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Users2 className="h-4 w-4 text-[var(--tint-blue)]" aria-hidden="true" />
              <span>{t.heroAdvisorsPerSession}</span>
            </span>
          </div>
        </div>

        {/* The 3D stage. Ambient blur blobs sit behind the orbit and floating cards. */}
        <div className="stage relative flex items-center justify-center p-4">
          <div className="blob blob--blue -top-6 -left-6 h-48 w-48" aria-hidden="true" />
          <div className="blob blob--orange -bottom-6 -right-6 h-48 w-48" aria-hidden="true" />

          <div className="relative w-full max-w-[20rem] sm:max-w-[26rem] aspect-square">
            <CouncilOrb className="z-10" />

            {/* Floating pill 1: live state indicator. */}
            <div
              className="float-card lift float-slow absolute -top-4 left-0 flex items-center gap-3 px-4 py-2.5 shadow-xl"
              style={{ '--tilt-x': '-4deg', '--tilt-y': '6deg' } as React.CSSProperties}
            >
              <div className="toggle-pill" data-on="true">
                <div className="toggle-pill__knob" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-ink">{t.heroModelsActive}</p>
                <p className="text-[10px] text-ink-muted">{t.heroModelsList}</p>
              </div>
            </div>

            {/* Floating pill 2: decision framework badge. */}
            <div
              className="float-card lift float-slower absolute bottom-0 right-0 flex items-center gap-3 px-4 py-2.5 shadow-xl"
              style={{ '--tilt-x': '5deg', '--tilt-y': '-6deg' } as React.CSSProperties}
            >
              <div
                className="icon-tile text-[var(--tint-violet)]"
                style={{ background: 'color-mix(in srgb, var(--tint-violet) 12%, transparent)' }}
              >
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-ink">{t.heroFrameworkBadge}</p>
                <p className="text-[10px] font-bold text-[var(--tint-green)]">{t.heroFrameworkPrivacy}</p>
              </div>
            </div>

            {/* Floating trust card at the bottom-left. */}
          </div>
        </div>
      </section>

      {/* How it works: 3-step timeline. */}
      <section id="how-it-works" className="scroll-mt-28 space-y-8" aria-labelledby="flow-title">
        <Reveal>
          <header className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-blue)]/10 px-3 py-1 text-xs font-extrabold text-[var(--tint-blue)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t.flowEyebrow}
            </span>
            <h2 id="flow-title" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              {t.flowTitle}
            </h2>
            <p className="mt-3 text-base text-ink-muted">{t.flowBody}</p>
          </header>
        </Reveal>

        <ol className="grid gap-6 md:grid-cols-3">
          {flow.map(({ icon: Icon, title, body, badge, tint }, index) => (
            <Reveal key={title} as="li" delayMs={index * 100} className="lift persona-card relative flex flex-col justify-between p-6 sm:p-7">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: tint }}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider"
                    style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
                  >
                    {badge}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-extrabold text-ink">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Frameworks: 3-column feature grid. */}
      <section className="space-y-8" aria-labelledby="framework-title">
        <Reveal>
          <header className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-orange)]/10 px-3 py-1 text-xs font-extrabold text-[var(--tint-orange)]">
              {t.frameworkEyebrow}
            </span>
            <h2 id="framework-title" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              {t.frameworkTitle}
            </h2>
            <p className="mt-3 text-base text-ink-muted">{t.frameworkBody}</p>
          </header>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          {frameworks.map(({ icon: Icon, title, body, tag, tint }, index) => (
            <Reveal key={title} delayMs={index * 100}>
              <article className="lift persona-card flex h-full flex-col justify-between p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between">
                    <Icon className="h-7 w-7" style={{ color: tint }} aria-hidden="true" />
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
                    >
                      {tag}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold text-ink">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Why Zero Council: multi-colour cards. */}
      <section id="why-zero-council" className="scroll-mt-28 space-y-8" aria-labelledby="why-title">
        <Reveal>
          <header className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-green)]/10 px-3 py-1 text-xs font-extrabold text-[var(--tint-green)]">
              {t.whyEyebrow}
            </span>
            <h2 id="why-title" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              {t.whyTitle}
            </h2>
          </header>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          {reasons.map(({ icon: Icon, title, body, tint }, index) => (
            <Reveal key={title} delayMs={index * 100}>
              <article className="lift persona-card flex h-full flex-col justify-between p-6 sm:p-7">
                <div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold text-ink">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing teaser: 3 cards. */}
      <section id="pricing" className="scroll-mt-28 space-y-8" aria-labelledby="pricing-teaser-title">
        <Reveal>
          <header className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-pink)]/10 px-3 py-1 text-xs font-extrabold text-[var(--tint-pink)]">
              {t.pricingTeaserEyebrow}
            </span>
            <h2 id="pricing-teaser-title" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              {t.pricingTitle}
            </h2>
            <p className="mt-3 text-base text-ink-muted">{t.pricingTeaserBody}</p>
          </header>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.id} delayMs={index * 100}>
              <article
                className={`lift persona-card relative flex h-full flex-col justify-between p-6 sm:p-7 ${
                  plan.popular ? 'border-2 border-[var(--tint-violet)] shadow-xl' : ''
                }`}
              >
                <div>
                  {plan.popular && (
                    <span className="absolute -top-3 right-6 rounded-full bg-[var(--tint-violet)] px-3 py-0.5 text-[11px] font-black uppercase text-white shadow-md">
                      {t.badgePopular}
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold text-ink">{plan.name}</h3>
                  <p className="mt-3 text-3xl font-extrabold text-ink">{planPrice(plan, language)}</p>
                  <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                    {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => requestCheckout(plan)}
                  disabled={!authReady}
                  className={`mt-6 w-full ${plan.popular ? 'button-primary' : 'button-secondary'}`}
                >
                  {plan.priceVnd <= 0
                    ? t.planCurrent
                    : authUser
                      ? t.planChoose.replace('{plan}', plan.name)
                      : t.planSignInToBuy}
                </button>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
};
