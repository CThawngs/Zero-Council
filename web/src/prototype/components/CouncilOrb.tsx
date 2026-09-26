import React from 'react';

// Four advisors, one hue. The brass halo behind the scene is the only glow in
// the hero, so the nodes must not reintroduce a second accent colour.
const NODE_OPACITIES = [1, 0.78, 0.56, 0.34] as const;

/**
 * Decorative 3D "council orbit" for the landing page hero.
 * Pure CSS transforms — no extra dependency. Respects
 * prefers-reduced-motion via the global rule in globals.css.
 */
export const CouncilOrb: React.FC = () => {
  return (
    <div className="council-orb" aria-hidden="true">
      <div className="glow" />
      <div className="council-orb__scene">
        <div className="council-orb__ring council-orb__ring--x" />
        <div className="council-orb__ring council-orb__ring--y" />
        <div className="council-orb__core" />
        {NODE_OPACITIES.map((nodeOpacity, index) => (
          <div
            key={nodeOpacity}
            className="council-orb__node"
            style={
              {
                '--node-opacity': nodeOpacity,
                '--node-angle': `${index * 90}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
};
