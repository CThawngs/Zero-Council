import React, { useEffect, useRef } from 'react';
import { User, Users } from 'lucide-react';
import {
  CHAT_UX_COPY,
  type ChatLanguage,
  type MentionCandidate,
} from '../chat/mentions';

interface MentionAutocompleteProps {
  candidates: MentionCandidate[];
  activeIndex: number;
  language: ChatLanguage;
  onSelect: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
}

const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter((word) => word && !/^(the|a|an)$/i.test(word));
  const letters = (words.length > 0 ? words : [name]).slice(0, 2).map((word) => word.charAt(0));
  return letters.join('').toUpperCase();
};

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  candidates,
  activeIndex,
  language,
  onSelect,
  onHover,
}) => {
  const ux = CHAT_UX_COPY[language];
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>(`[data-mention-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, candidates.length]);

  return (
    <div
      id="chat-mention-popover"
      className=" absolute bottom-full left-0 z-40 mb-2 w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-surface-2 px-3 py-1.5 text-[11px]">
        <span className="font-semibold text-ink">{ux.mentionMenuTitle}</span>
        <span className="hidden truncate text-[10px] text-ink-muted sm:inline">
          {ux.mentionNavHint}
        </span>
      </div>

      <div
        ref={listRef}
        id="chat-mention-listbox"
        role="listbox"
        aria-label={ux.mentionMenuTitle}
        className="max-h-60 overflow-y-auto p-1.5"
      >
        {candidates.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-ink-muted">{ux.mentionEmpty}</p>
        ) : (
          candidates.map((candidate, index) => {
            const isActive = index === activeIndex;
            const color = candidate.colorHex ?? 'var(--color-accent)';
            const statusLabel =
              candidate.kind === 'bot'
                ? candidate.connected
                  ? ux.mentionConnectedLabel
                  : ux.mentionPreviewLabel
                : null;

            return (
              <button
                key={candidate.id}
                type="button"
                role="option"
                id={`chat-mention-option-${index}`}
                data-mention-index={index}
                data-mention-handle={candidate.handle}
                aria-selected={isActive}
                onMouseDown={(event) => {
                  // Prevent textarea blur so mobile tap & desktop click keep caret focus seamlessly.
                  event.preventDefault();
                }}
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(candidate)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                  isActive
                    ? 'border-brass/45 bg-brass/12 text-ink'
                    : 'border-transparent bg-transparent text-ink hover:bg-surface-2'
                }`}
              >
                {candidate.kind === 'all' ? (
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brass/45 bg-brass/15 text-ink"
                  >
                    <Users className="h-4 w-4" />
                  </span>
                ) : candidate.kind === 'user' ? (
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sage/45 bg-sage/15 text-ink"
                  >
                    <User className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full border font-serif text-xs font-semibold text-ink"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${color} 22%, var(--color-surface))`,
                        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
                      }}
                    >
                      {initialsOf(candidate.label)}
                    </span>
                    <span
                      aria-hidden="true"
                      title={statusLabel ?? undefined}
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${
                        candidate.connected ? 'bg-sage' : 'bg-ink-muted/60'
                      }`}
                    />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-ink">
                      {candidate.kind === 'bot' ? `@${candidate.label}` : candidate.label}
                    </span>
                    {candidate.roleBadge && (
                      <span className="max-w-[7rem] shrink-0 truncate rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                        {candidate.roleBadge}
                      </span>
                    )}
                  </span>
                  {candidate.subtitle && (
                    <span
                      className={`mt-0.5 block truncate text-[11px] leading-snug ${
                        isActive ? 'text-ink/80' : 'text-ink-muted'
                      }`}
                    >
                      {candidate.subtitle}
                    </span>
                  )}
                </span>

                {statusLabel && (
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                      candidate.connected
                        ? 'border-sage/40 bg-sage/12 text-ink'
                        : 'border-border bg-surface-2 text-ink-muted'
                    }`}
                  >
                    {statusLabel}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
