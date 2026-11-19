import { useEffect, useState } from 'react';

const LINES = ['Listening to what you wrote', 'Separating what you said from what we imagine', 'Mixing the light', 'Letting the edges blur'];

export function Loading() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => Math.min(n + 1, LINES.length - 1)), 520); return () => clearInterval(t); }, []);
  return (
    <section className="loading" role="status" aria-live="polite">
      <div className="loading-orb" aria-hidden="true"><span /><span /><span /></div>
      <p className="meta">Interpreting</p>
      <p className="loading-line serif">{LINES[i]}…</p>
    </section>
  );
}
