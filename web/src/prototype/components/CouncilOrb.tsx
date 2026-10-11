import React from 'react';

// One node per advisor, each in that persona's colour. The node hues are
// identity, not decoration — the ring and core stay in the accent family so
// they read as the scene rather than the people.
const NODE_COLORS = [
  'var(--color-persona-rose)',
  'var(--color-persona-sage)',
  'var(--color-persona-slate)',
  'var(--color-persona-ochre)',
] as const;

type CouncilOrbProps = {
  className?: string;
};

/**
 * Decorative 3D "council orbit" for the landing page hero.
 * Pure CSS transforms — no extra dependency. Respects
 * prefers-reduced-motion via the global rule in globals.css.
 */
export const CouncilOrb: React.FC<CouncilOrbProps> = ({ className }) => {
  return (
    <div className={`council-orb ${className ?? ''}`.trim()} aria-hidden="true">
      <div className="council-orb__scene">
        <div className="council-orb__ring council-orb__ring--x" />
        <div className="council-orb__ring council-orb__ring--y" />
        <div className="council-orb__core" />
        {NODE_COLORS.map((color, index) => (
          <div
            key={color}
            className="council-orb__node"
            style={
              {
                '--node-color': color,
                '--node-angle': `${index * 90}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
};