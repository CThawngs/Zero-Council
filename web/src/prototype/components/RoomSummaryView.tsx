import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { modelLabel, providerLabel } from '../data/mockData';
import { RESUME_ALL, USER_HANDLE } from '../chat/engine';
import { attachmentStatus } from '../chat/attachment-status';
import { Avatar, AttachmentGlyph } from './ChatRoomView';

type ClampLines = 2 | 3 | 4 | 5;

const CLAMP_CLASS: Record<ClampLines, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
};

interface ExpandableTextProps {
  text: string;
  maxLines?: ClampLines;
  as?: 'p' | 'h1' | 'span';
  className?: string;
  showMoreLabel: string;
  showLessLabel: string;
}

/**
 * Wraps long or unbroken lines cleanly and clamps overflow beyond `maxLines` behind an
 * expand/collapse toggle. Only shows the toggle when the rendered text actually overflows.
 */
const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  maxLines = 4,
  as = 'p',
  className = '',
  showMoreLabel,
  showLessLabel,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
      setIsTruncated(el.scrollHeight - el.clientHeight > lineHeight * 0.4);
    };

    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text, expanded, maxLines]);

  const sharedClassName = `whitespace-pre-wrap [overflow-wrap:anywhere] ${!expanded ? CLAMP_CLASS[maxLines] : ''} ${className}`.trim();
  const assignRef = (node: HTMLElement | null) => {
    textRef.current = node;
  };

  return (
    <div className="min-w-0">
      {as === 'h1' ? (
        <h1 ref={assignRef} className={sharedClassName}>
          {text}
        </h1>
      ) : as === 'span' ? (
        <span ref={assignRef} className={sharedClassName}>
          {text}
        </span>
      ) : (
        <p ref={assignRef} className={sharedClassName}>
          {text}
        </p>
      )}
      {(isTruncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60"
        >
          {expanded ? (
            <>
              {showLessLabel}
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              {showMoreLabel}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
};

/**
 * What the council said, in one page, after the user ends the meeting.
 *
 * Extractive on purpose: every line here is something an advisor (or the user) actually wrote, taken
 * from the transcript. A recap that paraphrased would be one more model call and one more chance to
 * put words in an advisor's mouth, and in the scripted preview there is no model to ask at all.
 */
export const RoomSummaryView: React.FC = () => {
  const { currentRoom, personas, setCurrentView, showToast, openRoomConclusion, isDeliberating, t } = useApp();

  if (!currentRoom) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 py-4 sm:py-8">
        <h1 className="font-serif text-3xl text-ink">{t.summaryEyebrow}</h1>
        <p className="text-sm text-ink-muted">{t.summaryNoRoom}</p>
        <button type="button" onClick={() => setCurrentView('empty-chamber')} className="button-primary min-h-11">
          {t.summaryNew}
        </button>
      </div>
    );
  }

  const matchId = (p: { id: string }, id: string) => {
    if (p.id === id) return true;
    const strip = (s: string) => (s.startsWith('bot:') ? s.slice(4) : s);
    return strip(p.id) === strip(id);
  };

  const roster = currentRoom.roster
    .map((id) => personas.find((persona) => matchId(persona, id)))
    .filter((persona): persona is (typeof personas)[number] => Boolean(persona));

  const nameOf = (id: string) =>
    id === USER_HANDLE
      ? t.chatYou
      : id === RESUME_ALL
        ? '@all'
        : (personas.find((persona) => matchId(persona, id))?.name ?? id);

  const userMessages = currentRoom.messages.filter((message) => message.authorId === USER_HANDLE);
  const advisorMessages = currentRoom.messages.filter((message) => message.authorId !== USER_HANDLE);
  const [opening, ...followUps] = userMessages;
  const attachments = userMessages.flatMap((message) => message.attachments ?? []);

  const positions = roster.map((persona) => {
    const spoken = advisorMessages.filter((message) => matchId(persona, message.authorId));
    return { persona, turns: spoken.length, last: spoken[spoken.length - 1] };
  });

  const handoffs = advisorMessages
    .filter((message) => (message.mentioned ?? []).length > 0)
    .map((message) => `${nameOf(message.authorId)} → ${(message.mentioned ?? []).map(nameOf).join(', ')}`);

  const outcome = (() => {
    switch (currentRoom.stoppedBy) {
      case 'max-turns':
        return t.chatPaused.replace('{count}', String(currentRoom.turns));
      case 'budget':
        return t.chatBudgetReached;
      case 'silent':
        return t.chatNobodySpoke;
      case 'cancelled':
        return t.chatCancelled;
      case 'failed':
        return currentRoom.failures[0]?.kind === 'timeout'
          ? t.chatAdvisorTimedOut
          : t.chatAdvisorFailed.replace('{reason}', currentRoom.failures[0]?.kind ?? 'error');
      default:
        return t.summaryOutcomeDone;
    }
  })();

  const recapText = [
    currentRoom.title,
    '',
    `${t.summaryQuestion}: ${opening?.body ?? ''}`,
    ...followUps.map((message) => `${t.summaryFollowUps}: ${message.body}`),
    '',
    `${t.summaryPositions}:`,
    ...positions.map(({ persona, last }) => `- ${persona.name}: ${last ? last.body : t.summaryNoTurns}`),
    ...(handoffs.length > 0 ? ['', `${t.summaryFloor}:`, ...handoffs.map((line) => `- ${line}`)] : []),
    '',
    outcome,
  ].join('\n');

  const copyRecap = async () => {
    try {
      await navigator.clipboard.writeText(recapText);
    } catch {
      // Clipboard API refused (insecure context, permissions). Fall back to the old selection trick
      // rather than leave a button that does nothing.
      const scratch = document.createElement('textarea');
      scratch.value = recapText;
      scratch.style.position = 'fixed';
      scratch.style.opacity = '0';
      document.body.appendChild(scratch);
      scratch.select();
      document.execCommand('copy');
      document.body.removeChild(scratch);
    }
    showToast('summaryCopied');
  };

  const stats = [
    { label: t.summaryStatAdvisors, value: roster.length },
    { label: t.summaryStatTurns, value: advisorMessages.length },
    { label: t.summaryStatQuestions, value: userMessages.length },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 py-4 sm:py-8">
      <header className="min-w-0 max-w-3xl">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
          <span className="h-2 w-2 rounded-full bg-brass" aria-hidden="true" />
          {t.summaryEyebrow}
        </p>
        <ExpandableText
          key={currentRoom.title}
          as="h1"
          text={currentRoom.title}
          maxLines={3}
          className="mt-3 font-serif text-3xl leading-snug text-ink sm:text-4xl sm:leading-snug"
          showMoreLabel={t.summaryShowMore}
          showLessLabel={t.summaryShowLess}
        />
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">{t.summaryIntro}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setCurrentView('chat-room')} className="button-primary min-h-11 justify-center">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t.summaryBack}
          </button>
          <button type="button" onClick={copyRecap} className="button-secondary min-h-11 justify-center">
            <Copy className="h-4 w-4" aria-hidden="true" />
            {t.summaryCopy}
          </button>
          <button type="button" onClick={() => setCurrentView('empty-chamber')} className="button-quiet min-h-11 justify-center">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.summaryNew}
          </button>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-surface px-4 py-3.5">
            <dt className="text-xs text-ink-muted">{stat.label}</dt>
            <dd className="mt-1 font-serif text-2xl text-ink sm:text-3xl">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="summary-question" className="space-y-3">
        <h2 id="summary-question" className="font-serif text-xl text-ink">
          {t.summaryQuestion}
        </h2>
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          {opening?.body && (
            <ExpandableText
              key={opening.id}
              text={opening.body}
              maxLines={4}
              className="text-sm leading-relaxed text-ink sm:text-base"
              showMoreLabel={t.summaryShowMore}
              showLessLabel={t.summaryShowLess}
            />
          )}
          {followUps.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t.summaryFollowUps}</p>
              <ul className="mt-2 space-y-1.5">
                {followUps.map((message) => (
                  <li key={message.id} className="min-w-0">
                    <ExpandableText
                      text={message.body}
                      maxLines={3}
                      className="text-sm leading-relaxed text-ink-muted"
                      showMoreLabel={t.summaryShowMore}
                      showLessLabel={t.summaryShowLess}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {advisorMessages.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-ink-muted">{t.summaryEmpty}</p>
      ) : (
        <section aria-labelledby="summary-positions" className="space-y-3">
          <h2 id="summary-positions" className="font-serif text-xl text-ink">
            {t.summaryPositions}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {positions.map(({ persona, turns, last }) => (
              <li
                key={persona.id}
                className="min-w-0 rounded-2xl border p-5"
                style={{
                  backgroundColor: `color-mix(in srgb, ${persona.colorHex} 8%, var(--color-surface))`,
                  borderColor: `color-mix(in srgb, ${persona.colorHex} 32%, var(--color-border))`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={persona.name} color={persona.colorHex} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{persona.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {modelLabel(persona.model)} · {providerLabel(persona.provider)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] text-ink-muted">
                    {turns > 0 ? t.summaryTurns.replace('{count}', String(turns)) : t.summaryNoTurns}
                  </span>
                </div>
                {last && (
                  <ExpandableText
                    key={last.id}
                    text={last.body}
                    maxLines={5}
                    className="mt-3 text-sm leading-relaxed text-ink"
                    showMoreLabel={t.summaryShowMore}
                    showLessLabel={t.summaryShowLess}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {handoffs.length > 0 && (
        <section aria-labelledby="summary-floor" className="space-y-3">
          <h2 id="summary-floor" className="font-serif text-xl text-ink">
            {t.summaryFloor}
          </h2>
          <ol className="space-y-2 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            {handoffs.map((line, index) => (
              <li key={`${line}-${index}`} className="flex min-w-0 gap-3 text-sm text-ink">
                <span className="w-5 shrink-0 text-right text-xs leading-6 text-ink-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <ExpandableText
                    as="span"
                    text={line}
                    maxLines={2}
                    className="block text-sm text-ink"
                    showMoreLabel={t.summaryShowMore}
                    showLessLabel={t.summaryShowLess}
                  />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {attachments.length > 0 && (
        <section aria-labelledby="summary-sources" className="space-y-3">
          <h2 id="summary-sources" className="font-serif text-xl text-ink">
            {t.summaryAttachments}
          </h2>
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-ink-muted"
              >
                <AttachmentGlyph attachment={attachment} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
                <span className="min-w-0 break-all">
                  <span className="font-medium text-ink">{attachment.name}</span>{' '}
                  {attachmentStatus(attachment, t)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="summary-conclusion" className="space-y-3">
        <h2 id="summary-conclusion" className="font-serif text-xl text-ink">
          {t.summaryConclusion}
        </h2>
        <div className="rounded-2xl border border-brass/40 bg-brass/5 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-ink">{t.summaryConclusionBody}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.summaryConclusionNote}</p>
          <button
            type="button"
            onClick={openRoomConclusion}
            disabled={isDeliberating}
            className="button-primary mt-4 min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeliberating ? '...' : t.summaryConclusionOpen}
          </button>
        </div>
      </section>

      <section aria-labelledby="summary-outcome" className="space-y-3">
        <h2 id="summary-outcome" className="font-serif text-xl text-ink">
          {t.summaryOutcome}
        </h2>
        <p className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm leading-relaxed text-ink-muted">{outcome}</p>
      </section>
    </div>
  );
};
