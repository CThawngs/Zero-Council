'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CouncilOrb } from './CouncilOrb';
import { Reveal } from './Reveal';
import { PLANS, planPrice } from '../data/plans';
import { getFaqItems } from '@/lib/seo-jsonld';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileQuestion,
  GitBranch,
  HelpCircle,
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
import Link from 'next/link';
import { Modal } from './Modal';

type StoryAct = 'hero' | 'how-it-works' | 'frameworks' | 'why' | 'pricing' | 'faq';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const FrameworkVisual: React.FC<{ index: number; tint: string }> = ({ index, tint }) => {
  if (index === 0) {
    return (
      <div
        className="story-mini-visual"
        style={{ '--visual-tint': tint } as React.CSSProperties}
        aria-hidden="true"
      >
        <svg viewBox="0 0 240 64" className="h-full w-full" fill="none">
          <rect x="14" y="14" width="66" height="8" rx="4" fill="currentColor" opacity="0.24" />
          <rect x="14" y="28" width="52" height="8" rx="4" fill="currentColor" opacity="0.46" />
          <rect x="14" y="42" width="60" height="8" rx="4" fill="currentColor" opacity="0.24" />
          <path
            d="M96 22 C116 22, 118 42, 138 42 M96 42 C116 42, 118 22, 138 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="164" cy="22" r="7" fill="var(--color-persona-rose)" opacity="0.9" />
          <circle cx="164" cy="42" r="7" fill="var(--color-persona-slate)" opacity="0.9" />
          <path
            d="M178 24 L208 32 L178 40"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.45"
          />
          <circle cx="216" cy="32" r="9" fill="currentColor" opacity="0.92" />
        </svg>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div
        className="story-mini-visual"
        style={{ '--visual-tint': tint } as React.CSSProperties}
        aria-hidden="true"
      >
        <svg viewBox="0 0 240 64" className="h-full w-full" fill="none">
          <rect
            x="16"
            y="12"
            width="38"
            height="16"
            rx="6"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.55"
          />
          <rect
            x="16"
            y="36"
            width="38"
            height="16"
            rx="6"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <rect
            x="64"
            y="22"
            width="42"
            height="20"
            rx="7"
            fill="currentColor"
            opacity="0.16"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M54 20 H64 M54 44 H64 M106 32 H146"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.65"
          />
          <circle
            cx="162"
            cy="32"
            r="14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.55"
          />
          <circle cx="162" cy="32" r="6" fill="currentColor" opacity="0.9" />
          <rect x="188" y="20" width="36" height="6" rx="3" fill="currentColor" opacity="0.5" />
          <rect x="188" y="30" width="28" height="6" rx="3" fill="currentColor" opacity="0.32" />
          <rect x="188" y="40" width="32" height="6" rx="3" fill="currentColor" opacity="0.22" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="story-mini-visual"
      style={{ '--visual-tint': tint } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 64" className="h-full w-full" fill="none">
        <circle
          cx="34"
          cy="32"
          r="10"
          fill="currentColor"
          opacity="0.18"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="34" cy="32" r="4" fill="currentColor" />
        <path
          d="M44 32 H88 M88 32 C104 32, 108 16, 128 16 H158 M88 32 H158 M88 32 C104 32, 108 48, 128 48 H158"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.6"
        />
        <rect x="166" y="11" width="58" height="10" rx="5" fill="var(--tint-green)" opacity="0.72" />
        <rect x="166" y="27" width="48" height="10" rx="5" fill="currentColor" opacity="0.42" />
        <rect
          x="166"
          y="43"
          width="40"
          height="10"
          rx="5"
          fill="var(--tint-orange)"
          opacity="0.58"
        />
      </svg>
    </div>
  );
};

export const OverviewView: React.FC = () => {
  const {
    t,
    language,
    authUser,
    authReady,
    requestCheckout,
    currentPlanId,
    cancelPlanToFree,
    downgradeToPro,
    setCurrentView,
  } = useApp();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [downgradeConfirmOpen, setDowngradeConfirmOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const storyRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const flowSectionRef = useRef<HTMLElement>(null);
  const stepNodeRefs = useRef<Array<HTMLElement | null>>([]);

  const handleStepSelect = useCallback((index: number) => {
    setActiveStep(index);
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stepNodeRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleCardPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${Math.round(event.clientX - rect.left)}px`);
    card.style.setProperty('--spot-y', `${Math.round(event.clientY - rect.top)}px`);
  }, []);

  useEffect(() => {
    const root = storyRef.current;
    if (!root || typeof window === 'undefined') return;

    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let rafId = 0;

    const applyScrollFrame = () => {
      rafId = 0;
      const docEl = document.documentElement;
      const scrollable = Math.max(1, docEl.scrollHeight - window.innerHeight);
      const pageProgress = clamp01(window.scrollY / scrollable);
      root.style.setProperty('--story-progress', pageProgress.toFixed(4));

      const enableScrollMotion = desktopQuery.matches && !motionQuery.matches;
      if (!enableScrollMotion) {
        root.style.setProperty('--hero-p', '0');
        root.style.setProperty('--flow-p', '1');
        return;
      }

      const heroEl = heroSectionRef.current;
      if (heroEl) {
        const rect = heroEl.getBoundingClientRect();
        const travel = Math.max(1, rect.height * 0.9);
        const heroProgress = clamp01(-rect.top / travel);
        root.style.setProperty('--hero-p', heroProgress.toFixed(4));
      }

      const flowEl = flowSectionRef.current;
      if (flowEl) {
        const rect = flowEl.getBoundingClientRect();
        const start = window.innerHeight * 0.62;
        const span = Math.max(1, rect.height - window.innerHeight * 0.25);
        const flowProgress = clamp01((start - rect.top) / span);
        root.style.setProperty('--flow-p', Math.max(0.16, flowProgress).toFixed(4));

        // Sync desktop sticky stage smoothly with the step closest to the reading focal line
        const focalY = window.innerHeight * 0.44;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        stepNodeRefs.current.forEach((stepEl, idx) => {
          if (!stepEl) return;
          const stepRect = stepEl.getBoundingClientRect();
          const stepCenter = stepRect.top + stepRect.height * 0.5;
          const distance = Math.abs(stepCenter - focalY);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = idx;
          }
        });
        setActiveStep((prev) => (prev === closestIndex ? prev : closestIndex));
      }
    };

    const scheduleFrame = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(applyScrollFrame);
    };

    scheduleFrame();
    window.addEventListener('scroll', scheduleFrame, { passive: true });
    window.addEventListener('resize', scheduleFrame, { passive: true });
    desktopQuery.addEventListener('change', scheduleFrame);
    motionQuery.addEventListener('change', scheduleFrame);

    let actObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-story-section]'));
      actObserver = new IntersectionObserver(
        (entries) => {
          if (motionQuery.matches) {
            root.dataset.storyAct = 'hero';
            return;
          }
          let bestAct: StoryAct | null = null;
          let bestRatio = 0;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const act = (entry.target as HTMLElement).dataset.storySection as StoryAct | undefined;
            if (act && entry.intersectionRatio >= bestRatio) {
              bestRatio = entry.intersectionRatio;
              bestAct = act;
            }
          }
          if (bestAct) {
            root.dataset.storyAct = bestAct;
          }
        },
        { rootMargin: '-28% 0px -38% 0px', threshold: [0.05, 0.25, 0.5] },
      );
      sections.forEach((section) => actObserver?.observe(section));
    }

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleFrame);
      window.removeEventListener('resize', scheduleFrame);
      desktopQuery.removeEventListener('change', scheduleFrame);
      motionQuery.removeEventListener('change', scheduleFrame);
      actObserver?.disconnect();
    };
  }, []);

  const flow = [
    {
      icon: MessageSquareText,
      title: t.flow1Title,
      body: t.flow1Body,
      badge: t.badgeStep1,
      tint: 'var(--tint-blue)',
    },
    {
      icon: ShieldCheck,
      title: t.flow2Title,
      body: t.flow2Body,
      badge: t.badgeStep2,
      tint: 'var(--tint-violet)',
    },
    {
      icon: FileQuestion,
      title: t.flow3Title,
      body: t.flow3Body,
      badge: t.badgeStep3,
      tint: 'var(--tint-green)',
    },
  ];
  const frameworks = [
    {
      icon: GitBranch,
      title: t.framework1Title,
      body: t.framework1Body,
      tag: t.framework1Tag,
      tint: 'var(--tint-orange)',
    },
    {
      icon: Layers3,
      title: t.framework2Title,
      body: t.framework2Body,
      tag: t.framework2Tag,
      tint: 'var(--tint-pink)',
    },
    {
      icon: SlidersHorizontal,
      title: t.framework3Title,
      body: t.framework3Body,
      tag: t.framework3Tag,
      tint: 'var(--tint-blue)',
    },
  ];
  const reasons = [
    { icon: Tags, title: t.why1Title, body: t.why1Body, tint: 'var(--tint-yellow)' },
    { icon: KeyRound, title: t.why2Title, body: t.why2Body, tint: 'var(--tint-violet)' },
    { icon: Scale, title: t.why3Title, body: t.why3Body, tint: 'var(--tint-green)' },
  ];
  const faqItems = getFaqItems(language);
  const currentStep = flow[activeStep] ?? flow[0];

  return (
    <div
      ref={storyRef}
      data-story-act="hero"
      className="zc-story-root relative isolate mx-auto flex w-full max-w-6xl flex-col gap-24 overflow-x-clip py-8 sm:gap-28 sm:py-12 lg:gap-32"
    >
      {/* Full-bleed atmospheric ambient backdrop — zero rectangular edge clipping */}
      <div className="ambient-field" aria-hidden="true">
        <div className="ambient-field__wash ambient-field__wash--primary" />
        <div className="ambient-field__wash ambient-field__wash--secondary" />
        <div className="ambient-field__wash ambient-field__wash--accent" />
      </div>

      {/* Subtle scroll progress hairline anchored beneath the fixed header */}
      <div className="story-progress-track" aria-hidden="true">
        <div className="story-progress-bar" />
      </div>

      {/* Act 1 — Hero: headline + CTA on the left, seamless volumetric 3D council stage on the right. */}
      <section
        ref={heroSectionRef}
        data-story-section="hero"
        className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.16fr)_minmax(19rem,0.84fr)] lg:gap-14"
      >
        <div className="w-full">
          <div className="hero-enter hero-enter--1 mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/85 px-3.5 py-1.5 text-xs font-bold text-ink backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[var(--tint-violet)]" aria-hidden="true" />
            <span className="text-ink-muted">{t.overviewEyebrow}</span>
          </div>

          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t.overviewTitle}
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.overviewBody}
          </p>

          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <Link
              href={authUser ? '/dashboard' : '/auth?mode=signup'}
              className="button-primary text-base"
            >
              <span>{t.overviewPrimary}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <a href="#how-it-works" className="button-secondary text-base">
              {t.overviewSecondary}
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border/80 pt-6 text-xs font-bold text-ink-muted">
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

        {/* Seamless 3D orbital stage — no boxed container or square blur edges. */}
        <div className="stage relative flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full max-w-[20rem] sm:aspect-square sm:max-w-[26rem]">
            <div className="hero-orb-rig relative mx-auto aspect-square w-full max-w-[14.5rem] sm:h-full sm:max-w-none">
              <CouncilOrb variant="hero" pauseOffscreen className="z-10" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-0 sm:block">
              <div className="float-card float-card--top float-slow flex min-w-0 max-w-full items-center gap-3 px-4 py-2.5 sm:absolute sm:-top-3 sm:left-0">
                <div className="toggle-pill shrink-0" data-on="true">
                  <div className="toggle-pill__knob" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-ink">{t.heroModelsActive}</p>
                  <p className="truncate text-[10px] text-ink-muted">{t.heroModelsList}</p>
                </div>
              </div>

              <div className="float-card float-card--bottom float-slower flex min-w-0 max-w-full items-center gap-3 px-4 py-2.5 sm:absolute sm:-bottom-1 sm:right-0">
                <div
                  className="icon-tile shrink-0 text-[var(--tint-violet)]"
                  style={{ background: 'color-mix(in srgb, var(--tint-violet) 12%, transparent)' }}
                >
                  <Zap className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-ink">{t.heroFrameworkBadge}</p>
                  <p className="text-[10px] font-bold text-[var(--tint-green)]">
                    {t.heroFrameworkPrivacy}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Act 2 — How it works: Desktop sticky split-story + clean vertical cards on mobile. */}
      <section
        id="how-it-works"
        ref={flowSectionRef}
        data-story-section="how-it-works"
        className="scroll-mt-28 space-y-10"
        aria-labelledby="flow-title"
      >
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

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start lg:gap-12">
          {/* Desktop sticky Council Chamber Stage (hidden on <1024px so mobile stays uncluttered) */}
          <div className="hidden lg:sticky lg:top-28 lg:block">
            <div
              className="story-chamber relative overflow-hidden rounded-3xl border border-border p-6"
              data-step={activeStep}
              style={{ '--chamber-tint': currentStep.tint } as React.CSSProperties}
            >
              <div className="story-chamber__glow" aria-hidden="true" />

              <div className="relative z-10 flex items-center justify-between gap-3">
                <span
                  className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider"
                  style={{
                    color: currentStep.tint,
                    background: `color-mix(in srgb, ${currentStep.tint} 12%, transparent)`,
                  }}
                >
                  {currentStep.badge}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: currentStep.tint }}
                    aria-hidden="true"
                  />
                  <span>{`${activeStep + 1} / ${flow.length}`}</span>
                </span>
              </div>

              <h3 className="relative z-10 mt-4 text-xl font-extrabold text-ink">
                {currentStep.title}
              </h3>

              {/* Choreographed 3-state geometric stage */}
              <div className="story-chamber__stage relative z-10 mt-6 h-56 w-full" aria-hidden="true">
                {/* Step 0: BYOK Vault & Providers */}
                <div
                  className="story-chamber__scene"
                  data-active={activeStep === 0 ? 'true' : 'false'}
                >
                  <div className="story-chamber__ring story-chamber__ring--outer" />
                  <div className="story-chamber__ring story-chamber__ring--inner" />
                  <div
                    className="story-chamber__core"
                    style={{ '--core-tint': 'var(--tint-blue)' } as React.CSSProperties}
                  >
                    <KeyRound className="h-7 w-7 text-accent-ink" />
                  </div>
                  <span className="story-chamber__dot story-chamber__dot--1" />
                  <span className="story-chamber__dot story-chamber__dot--2" />
                  <span className="story-chamber__dot story-chamber__dot--3" />
                  <span className="story-chamber__dot story-chamber__dot--4" />
                  <div className="story-chamber__pill">
                    <span>{t.heroFrameworkPrivacy}</span>
                  </div>
                </div>

                {/* Step 1: Multi-Bot Council Formation */}
                <div
                  className="story-chamber__scene"
                  data-active={activeStep === 1 ? 'true' : 'false'}
                >
                  <svg viewBox="0 0 280 180" className="story-chamber__arcs h-full w-full" fill="none">
                    <circle
                      cx="140"
                      cy="84"
                      r="56"
                      stroke="currentColor"
                      strokeOpacity="0.14"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <path
                      d="M78 60 Q140 24 202 60 M78 108 Q140 144 202 108 M78 60 Q112 84 78 108 M202 60 Q168 84 202 108"
                      stroke="var(--tint-violet)"
                      strokeOpacity="0.45"
                      strokeWidth="1.5"
                    />
                    <circle cx="78" cy="60" r="11" fill="var(--color-persona-rose)" />
                    <circle cx="202" cy="60" r="11" fill="var(--color-persona-sage)" />
                    <circle cx="78" cy="108" r="11" fill="var(--color-persona-slate)" />
                    <circle cx="202" cy="108" r="11" fill="var(--color-persona-ochre)" />
                    <circle cx="140" cy="84" r="18" fill="var(--tint-violet)" opacity="0.22" />
                    <circle cx="140" cy="84" r="9" fill="var(--tint-violet)" />
                  </svg>
                  <div className="story-chamber__pill">
                    <span>{t.heroAdvisorsPerSession}</span>
                  </div>
                </div>

                {/* Step 2: Structured Synthesis & Scenario Branches */}
                <div
                  className="story-chamber__scene"
                  data-active={activeStep === 2 ? 'true' : 'false'}
                >
                  <svg viewBox="0 0 280 180" className="story-chamber__arcs h-full w-full" fill="none">
                    <path
                      d="M36 44 C76 44, 92 84, 126 84 M36 84 H126 M36 124 C76 124, 92 84, 126 84"
                      stroke="var(--tint-blue)"
                      strokeOpacity="0.5"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M150 84 C178 84, 186 48, 224 48 M150 84 H224 M150 84 C178 84, 186 120, 224 120"
                      stroke="var(--tint-green)"
                      strokeOpacity="0.65"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <circle cx="36" cy="44" r="6" fill="var(--color-persona-rose)" />
                    <circle cx="36" cy="84" r="6" fill="var(--color-persona-slate)" />
                    <circle cx="36" cy="124" r="6" fill="var(--color-persona-ochre)" />
                    <rect
                      x="122"
                      y="66"
                      width="32"
                      height="36"
                      rx="10"
                      fill="var(--tint-green)"
                      opacity="0.18"
                      stroke="var(--tint-green)"
                      strokeWidth="1.75"
                    />
                    <circle cx="138" cy="84" r="6" fill="var(--tint-green)" />
                    <rect x="224" y="42" width="30" height="12" rx="6" fill="var(--tint-green)" opacity="0.85" />
                    <rect x="224" y="78" width="26" height="12" rx="6" fill="var(--tint-violet)" opacity="0.65" />
                    <rect x="224" y="114" width="22" height="12" rx="6" fill="var(--tint-orange)" opacity="0.7" />
                  </svg>
                  <div className="story-chamber__pill">
                    <span>{t.framework3Tag}</span>
                  </div>
                </div>
              </div>

              {/* Interactive step switcher (also gives reduced-motion & keyboard users full control) */}
              <div className="relative z-10 mt-6 grid grid-cols-3 gap-2 border-t border-border/80 pt-4">
                {flow.map((step, idx) => {
                  const selected = activeStep === idx;
                  return (
                    <button
                      key={step.badge}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleStepSelect(idx)}
                      className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors ${
                        selected
                          ? 'border-[var(--color-accent)] bg-accent-soft text-ink'
                          : 'border-border bg-surface text-ink-muted hover:text-ink'
                      }`}
                    >
                      {step.badge}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: Scroll-synced timeline steps (stacks cleanly on mobile/tablet) */}
          <div className="relative">
            <div className="story-rail hidden lg:block" aria-hidden="true">
              <div className="story-rail__fill" />
            </div>

            <ol className="grid gap-6 md:grid-cols-3 lg:grid-cols-1 lg:gap-8 lg:pl-8">
              {flow.map(({ icon: Icon, title, body, badge, tint }, index) => {
                const isActive = activeStep === index;
                return (
                  <Reveal key={title} as="li" delayMs={index * 75} className="list-none">
                    <article
                      ref={(el) => {
                        stepNodeRefs.current[index] = el;
                      }}
                      data-flow-step={index}
                      data-active={isActive ? 'true' : 'false'}
                      onPointerMove={handleCardPointerMove}
                      onMouseEnter={() => setActiveStep(index)}
                      onFocus={() => setActiveStep(index)}
                      className="story-card story-step-card persona-card relative flex h-full flex-col justify-between overflow-hidden p-6 sm:p-7 lg:min-h-[14.5rem]"
                      style={{ '--card-tint': tint } as React.CSSProperties}
                    >
                      <div className="story-card__accent-line" aria-hidden="true" />
                      <div>
                        <div className="flex items-center justify-between gap-4">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-2xl text-accent-ink shadow-md"
                            style={{ background: tint }}
                          >
                            <Icon className="h-6 w-6" aria-hidden="true" />
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider"
                            style={{
                              color: tint,
                              background: `color-mix(in srgb, ${tint} 12%, transparent)`,
                            }}
                          >
                            {badge}
                          </span>
                        </div>
                        <h3 className="mt-6 text-xl font-extrabold text-ink">{title}</h3>
                        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* Act 3 — Frameworks: 3-column feature grid with custom geometric diagrams. */}
      <section data-story-section="frameworks" className="space-y-8" aria-labelledby="framework-title">
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
            <Reveal key={title} delayMs={index * 80}>
              <article
                onPointerMove={handleCardPointerMove}
                className="story-card persona-card relative flex h-full flex-col justify-between overflow-hidden p-6 sm:p-7"
                style={{ '--card-tint': tint } as React.CSSProperties}
              >
                <div>
                  <FrameworkVisual index={index} tint={tint} />
                  <div className="mt-5 flex items-center justify-between gap-2">
                    <Icon className="h-6 w-6 shrink-0" style={{ color: tint }} aria-hidden="true" />
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{
                        color: tint,
                        background: `color-mix(in srgb, ${tint} 12%, transparent)`,
                      }}
                    >
                      {tag}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-ink">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Act 4 — Why Zero Council: multi-colour editorial cards. */}
      <section
        id="why-zero-council"
        data-story-section="why"
        className="scroll-mt-28 space-y-8"
        aria-labelledby="why-title"
      >
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
            <Reveal key={title} delayMs={index * 80}>
              <article
                onPointerMove={handleCardPointerMove}
                className="story-card persona-card relative flex h-full flex-col justify-between overflow-hidden p-6 sm:p-7"
                style={{ '--card-tint': tint } as React.CSSProperties}
              >
                <div className="story-card__accent-line" aria-hidden="true" />
                <div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      color: tint,
                      background: `color-mix(in srgb, ${tint} 12%, transparent)`,
                    }}
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

      {/* Act 5 — Pricing teaser: 3 cards (exact one-time 30-day pricing & handlers preserved). */}
      <section
        id="pricing"
        data-story-section="pricing"
        className="scroll-mt-28 space-y-8"
        aria-labelledby="pricing-teaser-title"
      >
        <Reveal>
          <header className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-pink)]/10 px-3 py-1 text-xs font-extrabold text-[var(--tint-pink)]">
              {t.pricingTeaserEyebrow}
            </span>
            <h2
              id="pricing-teaser-title"
              className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl"
            >
              {t.pricingTitle}
            </h2>
            <p className="mt-3 text-base text-ink-muted">{t.pricingTeaserBody}</p>
          </header>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan, index) => {
            const isCurrent = Boolean(authUser) && plan.id === currentPlanId;
            const isDowngradeToPro =
              Boolean(authUser) && currentPlanId === 'ultra' && plan.id === 'pro';
            const ctaLabel =
              plan.priceVnd <= 0
                ? !authUser
                  ? t.planStartFree
                  : currentPlanId !== 'free'
                    ? t.planCancelToFree
                    : t.planCurrent
                : isCurrent
                  ? t.planCurrent
                  : isDowngradeToPro
                    ? t.planDowngradeToPro
                    : authUser
                      ? t.planChoose.replace('{plan}', plan.name)
                      : t.planSignInToBuy;

            return (
              <Reveal key={plan.id} delayMs={index * 80}>
                <article
                  onPointerMove={handleCardPointerMove}
                  className={`story-card persona-card relative flex h-full flex-col justify-between p-6 sm:p-7 ${
                    plan.popular ? 'pricing-card--popular border-2 border-[var(--tint-violet)] shadow-xl' : ''
                  }`}
                  style={
                    {
                      '--card-tint': plan.popular ? 'var(--tint-violet)' : 'var(--color-accent)',
                    } as React.CSSProperties
                  }
                >
                  <div>
                    {plan.popular && (
                      <span className="absolute -top-3 right-6 rounded-full bg-[var(--tint-violet)] px-3 py-0.5 text-[11px] font-black uppercase text-accent-ink shadow-md">
                        {t.badgePopular}
                      </span>
                    )}
                    <h3 className="text-lg font-extrabold text-ink">{plan.name}</h3>
                    <p className="mt-3 text-3xl font-extrabold text-ink">
                      {planPrice(plan, language)}
                    </p>
                    {plan.priceVnd > 0 && (
                      <p className="mt-1 text-xs font-medium text-ink-muted">{t.planPerMonth}</p>
                    )}
                    <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                      {t.planAdvisors.replace('{count}', String(plan.maxActiveAdvisors))} ·{' '}
                      {t.planBots.replace('{count}', String(plan.maxBots))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (plan.priceVnd <= 0) {
                        if (!authUser) {
                          setCurrentView('sign-up');
                          return;
                        }
                        if (currentPlanId !== 'free') {
                          setCancelConfirmOpen(true);
                        }
                        return;
                      }
                      if (isDowngradeToPro) {
                        setDowngradeConfirmOpen(true);
                        return;
                      }
                      requestCheckout(plan);
                    }}
                    disabled={!authReady || isCurrent}
                    className={`mt-6 min-h-11 w-full justify-center ${
                      isCurrent
                        ? 'button-secondary cursor-default opacity-60'
                        : plan.popular
                          ? 'button-primary'
                          : 'button-secondary'
                    }`}
                  >
                    {ctaLabel}
                  </button>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Act 6 — Semantic FAQ section (1:1 parity with FAQPage JSON-LD) */}
      <section
        id="faq"
        data-story-section="faq"
        className="scroll-mt-28 space-y-8"
        aria-labelledby="faq-title"
      >
        <Reveal>
          <header className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-violet)]/10 px-3 py-1 text-xs font-extrabold text-[var(--tint-violet)]">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t.faqEyebrow}
            </span>
            <h2 id="faq-title" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              {t.faqTitle}
            </h2>
            <p className="mt-3 text-base text-ink-muted">{t.faqBody}</p>
          </header>
        </Reveal>

        <div className="grid gap-3.5">
          {faqItems.map((item, idx) => (
            <details
              key={item.question}
              open={idx === 0}
              className="faq-item group rounded-2xl border border-border bg-surface/90 p-5 shadow-sm backdrop-blur-sm transition-colors hover:border-brass/50 sm:p-6"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-extrabold text-ink [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 break-words">{item.question}</span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="faq-item__answer mt-3 border-t border-border/70 pt-3 text-sm leading-relaxed text-ink-muted break-words">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2/85 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm font-semibold text-ink">{t.faqGuidePrompt}</p>
          <Link href="/guide" className="button-secondary min-h-11 w-full justify-center sm:w-auto">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>{t.faqGuideCta}</span>
          </Link>
        </div>
      </section>

      {/* Cancel-to-free confirmation */}
      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title={t.planCancelToFree}
        description={t.planCancelConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setCancelConfirmOpen(false);
                void cancelPlanToFree();
              }}
              className="button-danger min-h-11 justify-center"
            >
              {t.planCancelToFree}
            </button>
          </>
        }
      />

      {/* Downgrade Ultra -> Pro confirmation */}
      <Modal
        isOpen={downgradeConfirmOpen}
        onClose={() => setDowngradeConfirmOpen(false)}
        title={t.planDowngradeToPro}
        description={t.planDowngradeConfirm}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDowngradeConfirmOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setDowngradeConfirmOpen(false);
                void downgradeToPro();
              }}
              className="button-primary min-h-11 justify-center"
            >
              {t.planDowngradeToPro}
            </button>
          </>
        }
      />
    </div>
  );
};
