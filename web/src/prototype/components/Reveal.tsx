'use client';

import React, { useEffect, useRef, useState } from 'react';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Optional stagger delay in ms, useful for lists of cards. */
  delayMs?: number;
  /** HTML tag to render — use 'li' inside <ol>/<ul> so markup stays valid. */
  as?: 'div' | 'li';
};

/**
 * Fades + slides content in the first time it scrolls into view.
 * Pure browser IntersectionObserver — no extra dependency.
 * Honors prefers-reduced-motion via the global rule in globals.css.
 */
export const Reveal: React.FC<RevealProps> = ({ children, className = '', delayMs = 0, as = 'div' }) => {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Fallback: if the browser has no IntersectionObserver, just show it.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(node);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal--visible' : ''} ${className}`.trim()}
      style={delayMs ? ({ '--reveal-delay': `${delayMs}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
};
