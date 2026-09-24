import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Compass, Layers, Check, ChevronDown, GitBranch, Sliders } from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { setCurrentView, startNewSession, t, openCheckoutDrawer } = useApp();
  const [dilemmaInput, setDilemmaInput] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const starterDilemmas = [
    'Should I accept a remote job offer that pays less but gives more flexibility?',
    'Should I bootstrap our AI product or raise $500k in pre-seed funding?',
    'Relocating to Da Nang vs staying in Ho Chi Minh City for remote work',
  ];

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dilemmaInput.trim()) return;
    startNewSession(dilemmaInput);
  };

  const faqs = [
    {
      q: 'How does Zero Council differ from asking a single AI chatbot?',
      a: 'A single model can mirror your preferred framing. This prototype previews a council with opposing personas—Pragmatist, Dreamer, and Skeptic—then a Chair synthesis. Responses shown now are sample content, not live model output.',
    },
    {
      q: 'Which model labels appear in the sample council?',
      a: 'No model is called in this build. Claude, GPT, and Gemini labels are interface fixtures showing where connected providers may appear after security, quota, and legal review.',
    },
    {
      q: 'Is my dilemma stored or used to train AI models?',
      a: 'This UI-only build makes no AI or storage request. Sample sessions exist in transient browser state and reset on reload. Production retention and provider terms remain open.',
    },
    {
      q: 'Can I connect my own API keys (BYOK)?',
      a: 'The screen is a visual mock only. Do not enter a real key. A future BYOK design needs encrypted server-side or client-side handling, explicit user consent, revocation, and provider-specific data terms before launch.',
    },
  ];

  return (
    <div className="space-y-24 py-8 md:py-16">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 text-left space-y-8">
        {/* Subtle pill / tag (Sentence case, no ALL-CAPS) */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-surface border border-border text-xs text-ink-muted">
          <span className="w-2 h-2 rounded-full bg-brass" />
          <span>{t.deliberativeSubtitle}</span>
        </div>

        {/* Heading */}
        <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-ink font-normal tracking-tight leading-[1.15] max-w-4xl">
          {t.tagline}
        </h1>

        <p className="text-base sm:text-lg text-ink-muted max-w-2xl leading-relaxed">
          Preview how opposing advisor personas can frame one dilemma from multiple angles. Every response in this build is local sample content; no model is called.
        </p>

        {/* Interactive Dilemma Input Box */}
        <div className="p-4 sm:p-6 rounded-lg bg-surface border border-border shadow-lg space-y-4">
          <form onSubmit={handleStart} className="space-y-3">
            <label htmlFor="dilemma" className="block text-xs font-medium text-ink-muted">
              Submit a dilemma to preview a mocked council deliberation
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="dilemma"
                name="dilemma"
                type="text"
                value={dilemmaInput}
                onChange={(e) => setDilemmaInput(e.target.value)}
                placeholder="e.g. Should I leave my stable corporate role to co-found a fintech startup?"
                className="flex-1 px-4 py-3 text-sm bg-background border border-border rounded-md text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass transition-colors"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-sm transition-colors shrink-0 shadow-xs flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4" />
                <span>Preview Council Flow</span>
              </button>
            </div>
          </form>

          {/* Quick Starters */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-ink-muted block">Or select a sample case:</span>
            <div className="flex flex-wrap gap-2">
              {starterDilemmas.map((dilemma, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setDilemmaInput(dilemma);
                    startNewSession(dilemma);
                  }}
                  className="text-xs px-3 py-1.5 rounded-md bg-background border border-border text-ink-muted hover:text-ink hover:border-brass/50 text-left transition-colors"
                >
                  {dilemma}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sample council persona strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-md bg-surface/70 border border-border flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-persona-sage mt-1 shrink-0" />
            <div>
              <p className="text-sm font-medium text-ink">The Pragmatist</p>
              <p className="text-xs text-ink-muted mt-0.5">Sample label: GPT-5.2</p>
              <p className="text-[11px] text-ink-muted mt-1">
                Cashflow runway & operational solvency calculus
              </p>
            </div>
          </div>

          <div className="p-4 rounded-md bg-surface/70 border border-border flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-persona-rose mt-1 shrink-0" />
            <div>
              <p className="text-sm font-medium text-ink">The Dreamer</p>
              <p className="text-xs text-ink-muted mt-0.5">Sample label: Claude 4.6</p>
              <p className="text-[11px] text-ink-muted mt-1">
                Autonomy dividend, life hours & vitality upside
              </p>
            </div>
          </div>

          <div className="p-4 rounded-md bg-surface/70 border border-border flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-persona-slate mt-1 shrink-0" />
            <div>
              <p className="text-sm font-medium text-ink">The Skeptic</p>
              <p className="text-xs text-ink-muted mt-0.5">Sample label: Gemini 3 Pro</p>
              <p className="text-[11px] text-ink-muted mt-1">
                Proximity bias, boundary friction & anchor risk
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section (Strict numbered sequence 1, 2, 3) */}
      <section className="max-w-5xl mx-auto px-4 space-y-12">
        <div className="space-y-3">
          <span className="text-xs text-brass font-medium">Deliberative Architecture</span>
          <h2 className="font-serif text-2xl sm:text-4xl text-ink font-normal">
            How the Chamber Resolves Dilemmas
          </h2>
          <p className="text-sm text-ink-muted max-w-xl">
            Three-stage interface concept designed to surface assumptions and trade-offs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-lg bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-serif text-2xl text-brass font-normal">1</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                Input Phase
              </span>
            </div>
            <h3 className="font-serif text-lg text-ink font-normal">Articulate Your Dilemma</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Frame your choice, monetary numbers, location factors, or competing opportunities. Select from three formal decision frameworks to guide the analytical lens.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-lg bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-serif text-2xl text-brass font-normal">2</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                Adversarial Phase
              </span>
            </div>
            <h3 className="font-serif text-lg text-ink font-normal">Chamber Deliberation</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Sample advisor cards represent how future models could defend assigned archetypes across multiple rounds. This prototype runs no inference.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-lg bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-serif text-2xl text-brass font-normal">3</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-border text-ink-muted">
                Synthesis Phase
              </span>
            </div>
            <h3 className="font-serif text-lg text-ink font-normal">Synthesized Clarity</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              A sample Chair response previews how future synthesis could combine agreements, trade-offs, scenarios, and counter-draft text.
            </p>
          </div>
        </div>
      </section>

      {/* Decision Frameworks Spotlight (Strictly the 3 allowed) */}
      <section className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="space-y-2">
          <span className="text-xs text-brass font-medium">Analytical Rigor</span>
          <h2 className="font-serif text-2xl sm:text-3xl text-ink font-normal">
            Three Governed Decision Frameworks
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted">
            These are interface concepts, not live analysis engines or proven decision frameworks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 rounded-md bg-surface border border-border space-y-3">
            <div className="flex items-center gap-2 text-brass">
              <GitBranch className="w-4 h-4" />
              <h3 className="text-sm font-medium text-ink">Good / Normal / Bad Scenarios</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Simulates three probabilistic futures with distinct tactical trigger actions: high-upside compounding, realistic equilibrium, and downside boundary erosion.
            </p>
          </div>

          <div className="p-5 rounded-md bg-surface border border-border space-y-3">
            <div className="flex items-center gap-2 text-sage">
              <Layers className="w-4 h-4" />
              <h3 className="text-sm font-medium text-ink">Six Thinking Hats</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Segments complex perspectives into disciplined parallel thinking modes: empirical facts, subjective sentiment, cautionary risk, generative optimism, and procedural closure.
            </p>
          </div>

          <div className="p-5 rounded-md bg-surface border border-border space-y-3">
            <div className="flex items-center gap-2 text-persona-slate">
              <Sliders className="w-4 h-4" />
              <h3 className="text-sm font-medium text-ink">Decision Matrix</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Deploys weighted multi-factor scoring against tangible variables: base compensation, autonomy index, stress mitigation, and long-term career leverage.
            </p>
          </div>
        </div>
      </section>

      {/* Live Sample Debate Preview Card */}
      <section className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-brass font-medium">Sample Chamber Preview</span>
            <h2 className="font-serif text-2xl text-ink font-normal mt-1">
              Case D-882: Remote Pay-Cut vs Flexibility
            </h2>
          </div>
          <button
            onClick={() => {
              startNewSession();
              setCurrentView('session-concluded');
            }}
            type="button"
            className="px-4 py-2 rounded-md bg-surface border border-border text-xs text-ink hover:bg-background transition-colors self-start"
          >
            Review Full Synthesis
          </button>
        </div>

        <div className="p-6 rounded-lg bg-surface border border-border space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b border-border">
            {/* The Pragmatist excerpt */}
            <div className="p-4 rounded-md bg-background border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-persona-sage">The Pragmatist</span>
                <span className="text-[10px] text-ink-muted font-mono">GPT-5.2</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed italic">
                &quot;Eliminating metropolitan transit and commuter friction recuperates $640 monthly in after-tax capital. The net financial variance is only -6.5%.&quot;
              </p>
            </div>

            {/* The Dreamer excerpt */}
            <div className="p-4 rounded-md bg-background border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-persona-rose">The Dreamer</span>
                <span className="text-[10px] text-ink-muted font-mono">Claude 4.6</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed italic">
                &quot;The 20 hours reclaimed monthly equals 240 hours per year—six full weeks of unmetered sovereignty to compound health and creative agency.&quot;
              </p>
            </div>

            {/* The Skeptic excerpt */}
            <div className="p-4 rounded-md bg-background border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-persona-slate">The Skeptic</span>
                <span className="text-[10px] text-ink-muted font-mono">Gemini 3 Pro</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed italic">
                &quot;Proximity bias creates an invisible ceiling. Require a structured 6-month compensation parity review clause before executing.&quot;
              </p>
            </div>
          </div>

          {/* Chair Recommendation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-md bg-background/70 border border-brass/30">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brass" />
                <span className="text-xs font-medium text-brass">Sample Chair Preview</span>
              </div>
              <p className="text-sm font-medium text-ink">
                Sample recommendation: proceed conditionally with a 6-month parity review and $2,500 equipment allowance.
              </p>
            </div>
            <button
              onClick={() => {
                startNewSession();
                setCurrentView('session-concluded');
              }}
              type="button"
              className="px-4 py-2 rounded-md bg-brass text-background text-xs font-medium hover:bg-brass/90 transition-colors shrink-0"
            >
              Open Deliberation
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Table (Strict VNĐ pricing) */}
      <section className="max-w-5xl mx-auto px-4 space-y-10">
        <div className="text-left space-y-2">
          <span className="text-xs text-brass font-medium">Illustrative Access</span>
          <h2 className="font-serif text-2xl sm:text-4xl text-ink font-normal">
            Mock Chamber Plans
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted">
            Concept tiers shown in VNĐ. No subscription, clearing, purchase, or activation exists.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Chamber */}
          <div className="p-6 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-lg text-ink font-normal">Free Chamber — Concept</h3>
                <p className="text-xs text-ink-muted mt-1">Sample entry tier; not provisioned</p>
              </div>
              <div className="font-serif text-3xl text-ink">₫0</div>
              <ul className="space-y-2.5 text-xs text-ink-muted pt-2 border-t border-border">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>3 monthly deliberations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Standard 3-advisor council</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Good / Normal / Bad framework</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentView('sign-in')}
              type="button"
              className="w-full py-2.5 rounded-md bg-background border border-border hover:bg-surface text-xs font-medium text-ink transition-colors"
            >
              Preview Free Flow
            </button>
          </div>

          {/* Pro Chamber (Highlighted) */}
          <div className="p-6 rounded-lg bg-surface border-2 border-brass flex flex-col justify-between space-y-6 relative shadow-lg">
            <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-md bg-brass text-background text-[11px] font-medium">
              Concept Highlight
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-lg text-ink font-normal">Sovereign Chamber — Concept</h3>
                <p className="text-xs text-ink-muted mt-1">Sample paid-tier concept; not purchasable</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl text-brass">₫119,000</span>
                <span className="text-xs text-ink-muted line-through">₫149,000</span>
                <span className="text-xs text-ink-muted">/month</span>
              </div>
              <ul className="space-y-2.5 text-xs text-ink-muted pt-2 border-t border-border">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Future unlimited-session concept</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>All 3 decision frameworks unlocked</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Custom advisor personas builder</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Mock counter-draft generator</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Future BYOK design slot</span>
                </li>
              </ul>
            </div>
            <button
              onClick={openCheckoutDrawer}
              type="button"
              className="w-full py-2.5 rounded-md bg-brass hover:bg-brass/90 text-background text-xs font-medium transition-colors shadow-xs"
            >
              Preview Mock Checkout
            </button>
          </div>

          {/* Enterprise Syndicate */}
          <div className="p-6 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-lg text-ink font-normal">Enterprise Syndicate — Concept</h3>
                <p className="text-xs text-ink-muted mt-1">Sample team tier; no infrastructure provisioned</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-3xl text-ink">₫490,000</span>
                <span className="text-xs text-ink-muted">/month</span>
              </div>
              <ul className="space-y-2.5 text-xs text-ink-muted pt-2 border-t border-border">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Multi-seat council coordination</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Future private deployment option</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Custom corporate decision matrices</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-brass" />
                  <span>Future support concept; no SLA</span>
                </li>
              </ul>
            </div>
            <button
              onClick={openCheckoutDrawer}
              type="button"
              className="w-full py-2.5 rounded-md bg-background border border-border hover:bg-surface text-xs font-medium text-ink transition-colors"
            >
              Preview Team Flow
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="max-w-4xl mx-auto px-4 space-y-6">
        <div className="space-y-2">
          <span className="text-xs text-brass font-medium">Inquiries</span>
          <h2 className="font-serif text-2xl sm:text-3xl text-ink font-normal">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-md border border-border bg-surface overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-background/40 transition-colors"
                >
                  <span className="text-sm font-medium text-ink">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-ink-muted transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-brass' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-ink-muted leading-relaxed border-t border-border/40 mt-1">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
