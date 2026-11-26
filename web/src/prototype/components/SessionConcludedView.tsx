import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/catalog';
import { extractReadableSummary, matchPersonaId } from '../chat/conclusion';
import {
  ArrowLeft,
  Copy,
  ListChecks,
  Maximize2,
  MessageSquare,
  Quote,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import FrameworkPanel from './FrameworkPanel';
import { ExpandableText } from './ExpandableText';
import { hasRichContent } from '../chat/content-render';
import { ContentRenderPanel } from './ContentRenderPanel';

export const SessionConcludedView: React.FC = () => {
  const {
    currentSession,
    currentRoom,
    setCurrentView,
    openContentPanel,
    showToast,
    t,
    language,
  } = useApp();
  const [isCopying, setIsCopying] = useState(false);

  // A concluded session always has at least one round — the first question is
  // round 1. The last round is what "concluded" means: later follow-ups supersede.
  const round = currentSession.rounds[currentSession.rounds.length - 1];
  const fallbackSummary = extractReadableSummary(currentSession.summary) || t.chairSummary;
  const summaryText = extractReadableSummary(round.chair.summary, fallbackSummary);
  const nameOf = (advisorId: string) =>
    currentSession.advisors.find((advisor) => matchPersonaId(advisor, advisorId))?.name ??
    advisorId;

  const handleCopySummary = async () => {
    const branches = [
      currentSession.scenarios.good,
      currentSession.scenarios.normal,
      currentSession.scenarios.bad,
    ];
    const text = [
      `${t.concludedTitle}: ${currentSession.title}`,
      `${t.roundOf.replace('{n}', String(round.index))} — ${t.concludedTitle}`,
      `${t.chairSummaryLabel}: ${summaryText}`,
      `${t.chairDissentLabel}: ${round.chair.dissent}`,
      `${t.nextStep}: ${round.chair.recommendation}`,
      '',
      ...branches.map(
        (b) =>
          `[${b.title}] ${b.description}${
            b.actions.length > 0 ? `\n${b.actions.map((a) => `  - ${a}`).join('\n')}` : ''
          }`
      ),
      '',
      ...round.contributions.map(
        (item) => `- ${nameOf(item.advisorId)}: ${item.text}`
      ),
      t.adviceWarning,
    ].join('\n');

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      showToast('toastCopied');
    } catch {
      showToast('toastCopyFailed');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-4 sm:py-8">
      <header className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
              {t.concludedEyebrow}
            </p>
            <ExpandableText
              key={currentSession.title}
              as="h1"
              text={currentSession.title}
              maxLines={3}
              className="mt-3 font-serif text-2xl leading-snug text-ink sm:text-3xl sm:leading-snug"
              showMoreLabel={t.summaryShowMore}
              showLessLabel={t.summaryShowLess}
            />
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{t.concludedBody}</p>
          </div>
          {currentRoom && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentView('room-summary')}
                className="button-secondary min-h-11 justify-center"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t.sessionBackToSummary}
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('chat-room')}
                className="button-quiet min-h-11 justify-center"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {t.sessionBackToChat}
              </button>
            </div>
          )}
        </div>
      </header>

      <aside
        className="flex items-start gap-3 rounded-xl border border-terracotta/40 bg-terracotta/10 p-4 text-sm leading-relaxed text-ink"
        role="note"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden="true" />
        {t.adviceWarning}
      </aside>

      <section className="overflow-hidden rounded-2xl border-2 border-brass/45 bg-surface shadow-sm">
        <div className="h-1 bg-brass" aria-hidden="true" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
                {t.framing}
              </p>
              <h2 className="mt-2 font-serif text-2xl text-ink">{t.concludedTitle}</h2>
            </div>
            <span className="self-start rounded-md border border-brass/35 bg-background px-2.5 py-1 text-xs text-brass">
              {currentSession.scenarios.good.subtitle || t.fixtureNotConsensus}
            </span>
          </div>

          {round.language !== language && (
            <p className="mt-5 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm leading-relaxed text-ink-muted">
              {t.answerLanguageNote.replace(
                '{language}',
                round.language === 'en' ? 'English' : 'Tiếng Việt'
              )}
            </p>
          )}

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.chairSummaryLabel}</h3>
              <ExpandableText
                key={summaryText}
                text={summaryText}
                maxLines={4}
                className="mt-2 font-serif text-xl leading-relaxed text-ink"
                showMoreLabel={t.summaryShowMore}
                showLessLabel={t.summaryShowLess}
              />
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ListChecks className="h-4 w-4 text-brass" aria-hidden="true" />
                {t.chairDissentLabel}
              </h3>
              <ul className="mt-3 space-y-2">
                {[round.chair.dissent].map((item) => (
                  <li
                    key={item}
                    className="flex min-w-0 gap-2 rounded-lg border border-border bg-background/70 px-3 py-2.5 text-sm leading-relaxed text-ink-muted"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <ExpandableText
                        text={item}
                        maxLines={3}
                        className="text-sm leading-relaxed text-ink-muted"
                        showMoreLabel={t.summaryShowMore}
                        showLessLabel={t.summaryShowLess}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 rounded-xl border border-sage/35 bg-sage/10 p-4">
              <h3 className="text-sm font-semibold text-ink">{t.chairRecommendationLabel}</h3>
              <ExpandableText
                key={round.chair.recommendation}
                text={round.chair.recommendation}
                maxLines={4}
                className="mt-1 text-sm leading-relaxed text-ink-muted"
                showMoreLabel={t.summaryShowMore}
                showLessLabel={t.summaryShowLess}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <ExpandableText
                  key={round.prompt}
                  text={round.prompt}
                  maxLines={3}
                  className="text-sm italic leading-relaxed text-ink-muted"
                  showMoreLabel={t.summaryShowMore}
                  showLessLabel={t.summaryShowLess}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              disabled={isCopying}
              className="button-primary min-h-11 shrink-0 justify-center disabled:cursor-wait disabled:opacity-60"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {t.copySummary}
            </button>
          </div>
        </div>
      </section>

      <FrameworkPanel
        key={`${round.index}-scenarios`}
        round={round}
        session={currentSession}
        t={t}
      />

      <section className="space-y-4" aria-labelledby="testimonies-title">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-brass" aria-hidden="true" />
          <h2 id="testimonies-title" className="font-serif text-2xl text-ink">
            {t.testimonies}
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {round.contributions.map((contribution, index) => {
            const advisor = currentSession.advisors.find((item) =>
              matchPersonaId(item, contribution.advisorId)
            );
            const crossReference = contribution.rebuts ?? contribution.buildsOn;
            const rich = hasRichContent(contribution.text);
            return (
              <article
                key={`${contribution.advisorId}-${index}`}
                className="min-w-0 rounded-2xl border border-border bg-surface p-5"
              >
                <div className="border-b border-border pb-3">
                  <h3 className="truncate font-medium text-ink">{nameOf(contribution.advisorId)}</h3>
                  <p className="mt-1 truncate text-[11px] text-ink-muted">
                    {t.modelLabel}:{' '}
                    {advisor
                      ? `${modelLabel(advisor.model)} · ${providerLabel(advisor.provider)}`
                      : t.notImplemented}
                  </p>
                  {crossReference && (
                    <p className="mt-2 inline-block rounded-full bg-brass/10 px-2.5 py-0.5 text-xs text-brass">
                      {contribution.rebuts
                        ? t.rebutsLabel.replace('{name}', nameOf(contribution.rebuts))
                        : t.buildsOnLabel.replace('{name}', nameOf(contribution.buildsOn as string))}
                    </p>
                  )}
                </div>
                {rich ? (
                  <>
                    <ExpandableText
                      key={`${contribution.advisorId}-${index}-rich`}
                      as="div"
                      text={contribution.text}
                      maxHeight={260}
                      className="mt-4"
                      showMoreLabel={t.summaryShowMore}
                      showLessLabel={t.summaryShowLess}
                    >
                      <ContentRenderPanel
                        content={contribution.text}
                        compact
                        showHeader={false}
                      />
                    </ExpandableText>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          openContentPanel({
                            title: nameOf(contribution.advisorId),
                            content: contribution.text,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
                      >
                        <Maximize2 className="h-3 w-3" aria-hidden="true" />
                        <span>{t.contentPanelOpen}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <ExpandableText
                    text={contribution.text}
                    maxLines={5}
                    className="mt-4 text-sm leading-relaxed text-ink"
                    showMoreLabel={t.summaryShowMore}
                    showLessLabel={t.summaryShowLess}
                  />
                )}
                {advisor?.instructions && (
                  <ExpandableText
                    text={advisor.instructions}
                    maxLines={3}
                    className="mt-3 text-xs leading-relaxed text-ink-muted"
                    showMoreLabel={t.summaryShowMore}
                    showLessLabel={t.summaryShowLess}
                  />
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
