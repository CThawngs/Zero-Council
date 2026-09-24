import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, ChevronDown, QrCode } from 'lucide-react';

export const PricingView: React.FC = () => {
  const { openCheckoutDrawer, setCurrentView } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const plans = [
    {
      name: 'Free Chamber — Concept',
      price: '₫0',
      period: 'illustrative',
      description: 'Preview the full council flow using local sample responses.',
      highlight: false,
      features: [
        '3 monthly council sessions',
        'Standard 3-advisor panel',
        'Good / Normal / Bad Scenarios framework',
        'Transient sample sessions',
        'Community support concept',
      ],
      ctaText: 'Preview Free Chamber',
      action: () => setCurrentView('empty-chamber'),
    },
    {
      name: 'Sovereign Chamber — Concept',
      price: '₫119,000',
      originalPrice: '₫149,000',
      period: 'illustrative / month',
      description: 'Explore a possible paid tier; no purchase or activation occurs.',
      highlight: true,
      features: [
        'Sample plan label — unlimited council sessions concept',
        'Provider slots for future approved models',
        'All 3 decision frameworks unlocked',
        'Custom advisor personas & directives builder',
        'Executive counter-draft copy generator',
        'Future encrypted BYOK design (not implemented)',
        'Mock VietQR checkout concept',
      ],
      ctaText: 'Preview Sovereign Concept',
      action: openCheckoutDrawer,
    },
    {
      name: 'Enterprise Syndicate — Concept',
      price: '₫490,000',
      period: 'illustrative / month',
      description: 'Explore a possible team tier; infrastructure and support are not provisioned.',
      highlight: false,
      features: [
        'Multi-seat council collaboration concept',
        'Future private deployment (not implemented) option',
        'Tailored corporate decision matrices',
        'Custom executive counter-draft templates',
        'Future support tier',
        'Future compliant invoicing (not implemented)',
      ],
      ctaText: 'Preview Enterprise Concept',
      action: openCheckoutDrawer,
    },
  ];

  const compareMatrix = [
    {
      feature: 'Monthly Deliberations',
      free: '3 sessions',
      sovereign: 'Unlimited',
      enterprise: 'Unlimited',
    },
    {
      feature: 'Model Provider Slots',
      free: 'Sample labels only',
      sovereign: 'Future approved providers (not implemented)',
      enterprise: 'Future private deployment (not implemented)',
    },
    {
      feature: 'Decision Frameworks',
      free: 'Good / Normal / Bad only',
      sovereign: 'All 3 frameworks',
      enterprise: 'All 3 + custom matrices',
    },
    {
      feature: 'Custom Advisor Builder',
      free: 'No',
      sovereign: 'Included',
      enterprise: 'Unlimited team personas',
    },
    {
      feature: 'Executive Counter-Drafts',
      free: 'No',
      sovereign: 'Included',
      enterprise: 'Included + legal templates',
    },
    {
      feature: 'Bring-Your-Own-Key (BYOK)',
      free: 'Not connected',
      sovereign: 'Mock state only',
      enterprise: 'Future design',
    },
    {
      feature: 'Billing Integration',
      free: '—',
      sovereign: 'Mock checkout',
      enterprise: 'Future compliant billing',
    },
  ];

  const pricingFaqs = [
    {
      q: 'Does this checkout process a real payment?',
      a: 'No. The QR placeholder, countdown, illustrative totals, and completion button are interface samples. This build contains no payment code or bank details, sends no payment request, and activates no plan.',
    },
    {
      q: 'Are all prices listed in Vietnam Đồng (VNĐ)?',
      a: 'Amounts use VNĐ to exercise local formatting. They are illustrative and are not an offer or confirmed production pricing.',
    },
    {
      q: 'Can I apply promotional voucher codes?',
      a: 'The drawer accepts sample code COUNCIL30 to test the discount UI. It changes mock totals only and has no monetary value.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'No real subscription exists. Settings contains sample membership controls only; production cancellation and renewal remain future work.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 space-y-16 text-left">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-surface border border-border text-xs text-brass">
          <QrCode className="w-3.5 h-3.5" />
          <span>Illustrative plans · mock checkout only</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl text-ink font-normal tracking-tight">
          Sovereign Council Memberships
        </h1>
        <p className="text-sm text-ink-muted">
          Concept tiers for product exploration. No plan is purchasable, billable, or active in this build.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          return (
            <div
              key={p.name}
              className={`p-6 rounded-lg bg-surface flex flex-col justify-between space-y-6 ${
                p.highlight
                  ? 'border-2 border-brass shadow-xl relative'
                  : 'border border-border'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-md bg-brass text-background text-[11px] font-medium">
                  Concept Highlight
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-ink font-normal">{p.name}</h3>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">{p.description}</p>
                </div>

                <div className="flex items-baseline gap-2 pt-2">
                  <span className={`font-serif text-3xl font-normal ${p.highlight ? 'text-brass' : 'text-ink'}`}>
                    {p.price}
                  </span>
                  {p.originalPrice && (
                    <span className="text-xs text-ink-muted line-through">
                      {p.originalPrice}
                    </span>
                  )}
                  <span className="text-xs text-ink-muted">{p.period}</span>
                </div>

                <ul className="space-y-2.5 text-xs text-ink-muted pt-4 border-t border-border">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-3.5 h-3.5 text-brass mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={p.action}
                className={`w-full py-2.5 rounded-md text-xs font-medium transition-colors shadow-xs ${
                  p.highlight
                    ? 'bg-brass hover:bg-brass/90 text-background'
                    : 'bg-background hover:bg-surface border border-border text-ink'
                }`}
              >
                {p.ctaText}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="space-y-6 pt-6">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl text-ink font-normal">
            Feature Comparison Matrix
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Concept capabilities shown for UI evaluation; none are provisioned services.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs text-ink">
            <thead>
              <tr className="border-b border-border bg-background/50 text-ink-muted font-medium">
                <th className="p-4">Capability</th>
                <th className="p-4">Free Chamber</th>
                <th className="p-4 text-brass">Sovereign Chamber</th>
                <th className="p-4">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compareMatrix.map((row, i) => (
                <tr key={i} className="hover:bg-background/30 transition-colors">
                  <td className="p-4 font-medium text-ink">{row.feature}</td>
                  <td className="p-4 text-ink-muted">{row.free}</td>
                  <td className="p-4 font-medium text-ink">{row.sovereign}</td>
                  <td className="p-4 text-ink-muted">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing FAQs */}
      <div className="space-y-4 pt-6 max-w-3xl">
        <h2 className="font-serif text-xl text-ink font-normal">Billing & Settlement FAQs</h2>
        <div className="space-y-3">
          {pricingFaqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-md border border-border bg-surface overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-background/40 transition-colors"
                >
                  <span className="text-xs font-medium text-ink">{faq.q}</span>
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
      </div>
    </div>
  );
};
