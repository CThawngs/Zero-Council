'use client';

import React, { useEffect, useRef, useState } from 'react';

// One node per advisor, each in that persona's colour. The node hues are
// identity, not decoration ? the rings and core stay in the accent family so
// they read as the chamber rather than the people.
const NODE_COLORS = [
  'var(--color-persona-rose)',
  'var(--color-persona-sage)',
  'var(--color-persona-slate)',
  'var(--color-persona-ochre)',
] as const;

type CouncilOrbProps = {
  className?: string;
  /** Visual scale/aura preset. Header/footer brand marks use 'default'. */
  variant?: 'default' | 'hero';
  /** Pause CSS spin animations when scrolled out of the viewport to save GPU/battery. */
  pauseOffscreen?: boolean;
};

/**
 * Decorative 3D "council orbit" for the landing hero and brand mark.
 * Pure CSS transforms ? no extra dependency. Core and advisor nodes use
 * exact camera-facing counter-rotation so every sphere stays geometrically
 * round at all spin angles while preserving true 3D front/back occlusion.
 * Respects prefers-reduced-motion via globals.css.
 */
export const CouncilOrb: React.FC<CouncilOrbProps> = ({
  className,
  variant = 'default',
  pauseOffscreen = false,
}) => {
  const orbRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (!pauseOffscreen) return;
    const node = orbRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [pauseOffscreen]);

  const variantClass = variant === 'hero' ? 'council-orb--hero' : '';

  return (
    <div
      ref={orbRef}
      className={`council-orb ${variantClass} ${className ?? ''}`.trim()}
      data-in-view={inView ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="council-orb__aura" />
      <div className="council-orb__tilt">
        <div className="council-orb__scene">
          <div className="council-orb__ring council-orb__ring--x" />
          <div className="council-orb__ring council-orb__ring--y" />
          <div className="council-orb__ring council-orb__ring--tilt" />
          <div className="council-orb__core" />
          {NODE_COLORS.map((color, index) => (
            <div
              key={color}
              className="council-orb__orbit-arm"
              style={
                {
                  '--node-color': color,
                  '--node-angle': `${index * 90}deg`,
                } as React.CSSProperties
              }
            >
              <div className="council-orb__node-anchor">
                <div className="council-orb__node" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
