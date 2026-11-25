import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type ClampLines = 2 | 3 | 4 | 5;

// Explicit map so Tailwind v4 statically detects and emits every line-clamp-* utility.
const CLAMP_CLASS: Record<ClampLines, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
};

interface ExpandableTextProps {
  text?: string;
  /** Optional custom content (e.g. @mention-highlighted nodes or ContentRenderPanel) rendered instead of raw `text`. */
  children?: React.ReactNode;
  maxLines?: ClampLines;
  /** Clamp by pixel height instead of line-clamp (for rich/block content like panels). */
  maxHeight?: number;
  as?: 'p' | 'h1' | 'span' | 'div';
  className?: string;
  /** Override toggle button color/styles (e.g. `text-current` on accent-colored user bubbles). */
  buttonClassName?: string;
  showMoreLabel: string;
  showLessLabel: string;
}

/**
 * Wraps long or unbroken lines cleanly and clamps overflow beyond `maxLines` (or `maxHeight` for
 * block content) behind an expand/collapse toggle. Only shows the toggle when content overflows.
 */
export const ExpandableText: React.FC<ExpandableTextProps> = ({
  text = '',
  children,
  maxLines = 4,
  maxHeight,
  as = 'p',
  className = '',
  buttonClassName = 'text-brass',
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
      // Block/panel content uses pixel height clamping instead of line-clamp, so detect overflow directly.
      if (maxHeight !== undefined) {
        setIsTruncated(el.scrollHeight - el.clientHeight > 8);
        return;
      }
      // Serif headings (e.g. Literata) can overhang line-height by a few px without being clamped;
      // requiring > 40% of a line's height avoids false "Show more" buttons on 1-line titles.
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
      setIsTruncated(el.scrollHeight - el.clientHeight > lineHeight * 0.4);
    };

    // Defer via rAF + ResizeObserver so measurement runs after layout and updates on resize.
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text, children, expanded, maxLines, maxHeight]);

  const useHeightClamp = maxHeight !== undefined;
  // `[overflow-wrap:anywhere]` lets unbroken tokens (URLs, hashes) wrap inside flex/grid cells.
  const sharedClassName = `${
    useHeightClamp ? 'min-w-0' : `whitespace-pre-wrap [overflow-wrap:anywhere] ${!expanded ? CLAMP_CLASS[maxLines] : ''}`
  } ${className}`.trim();
  const heightStyle = useHeightClamp && !expanded ? { maxHeight: `${maxHeight}px`, overflow: 'hidden' as const } : undefined;
  const content = children ?? text;
  const assignRef = (node: HTMLElement | null) => {
    textRef.current = node;
  };

  return (
    <div className="min-w-0">
      {as === 'h1' ? (
        <h1 ref={assignRef} className={sharedClassName} style={heightStyle}>
          {content}
        </h1>
      ) : as === 'span' ? (
        <span ref={assignRef} className={sharedClassName} style={heightStyle}>
          {content}
        </span>
      ) : as === 'div' ? (
        <div ref={assignRef} className={sharedClassName} style={heightStyle}>
          {content}
        </div>
      ) : (
        <p ref={assignRef} className={sharedClassName} style={heightStyle}>
          {content}
        </p>
      )}
      {(isTruncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className={`mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 ${buttonClassName}`.trim()}
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
