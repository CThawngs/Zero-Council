import React from 'react';

const NODE_COLORS = [
  'var(--color-persona-rose)',
  'var(--color-persona-sage)',
  'var(--color-persona-slate)',
  'var(--color-persona-ochre)',
];

/**
 * Decorative 3D "council orbit" for the landing page hero.
 * Pure CSS transforms — no extra dependency. Respects
 * prefers-reduced-motion via the global rule in globals.css.
 */
export const CouncilOrb: React.FC = () => {
  return (
    <div className="council-orb" aria-hidden="true">
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
