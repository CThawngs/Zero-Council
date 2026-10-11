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
 *
 * The reveal is ADDITIVE, never a visibility gate. `data-armed` is only set once
 * we have confirmed an observer exists, motion is allowed, and the element
 * starts below the fold — so the served HTML, a browser without
 * IntersectionObserver, and a user with reduced-motion all still render the
 * content. The previous version applied `opacity: 0` unconditionally, which
 * left 16 elements on the live landing page stuck at zero opacity and collapsed
 * the page to 2329px of mostly empty space.
 */
export const Reveal: React.FC<RevealProps> = ({ children, className = '', delayMs = 0, as = 'div' }) => {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Already on screen at mount: show it immediately rather than hiding
    // content that the visitor is currently looking at.
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    setArmed(true);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      data-armed={armed ? 'true' : undefined}
      data-visible={visible ? 'true' : undefined}
      style={delayMs ? ({ '--reveal-delay': `${delayMs}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
};