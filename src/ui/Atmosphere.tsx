// Lightweight 2D atmospheric background for the non-3D screens: drifting light, haze and film grain.
import type { CSSProperties } from 'react';

export function Atmosphere({ tint }: { tint?: string[] }) {
  const style = tint
    ? ({ '--a1': tint[3], '--a2': tint[4], '--a3': tint[0] } as CSSProperties)
    : undefined;
  return (
    <div className="atmos" aria-hidden="true" style={style}>
      <div className="atmos-light l1" />
      <div className="atmos-light l2" />
      <div className="atmos-light l3" />
      <div className="atmos-horizon" />
      <div className="atmos-motes">{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ '--i': i } as CSSProperties} />)}</div>
      <div className="atmos-grain" />
    </div>
  );
}
