import { useState } from 'react';
import { motion } from 'framer-motion';
import type { MemoryProfile } from '../memory/types';
import { deleteSaved, listSaved } from '../lib/storage';

export function Intro({ onBegin, onOpenSaved }: { onBegin: () => void; onOpenSaved: (p: MemoryProfile) => void }) {
  const [saved, setSaved] = useState(() => listSaved());
  const fade = (d: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 1.4, ease: [0.22, 1, 0.36, 1] } });
  return (
    <section className="intro">
      <motion.p className="meta intro-kicker" {...fade(0.2)}>An interactive exhibition · No. 01</motion.p>
      <h1 className="intro-title serif">
        <motion.span {...fade(0.5)}>Some memories</motion.span>
        <motion.span {...fade(0.9)}><em>never really</em> leave.</motion.span>
      </h1>
      <motion.p className="intro-sub" {...fade(1.4)}>What if you could see what a memory feels like?</motion.p>
      <motion.div {...fade(1.8)}>
        <button className="btn btn-primary" onClick={onBegin} autoFocus>Shape a memory</button>
      </motion.div>
      <motion.p className="intro-note" {...fade(2.2)}>
        Your words stay in this browser. Nothing is sent or stored unless you choose to.
      </motion.p>

      {saved.length > 0 && (
        <motion.div className="saved" {...fade(2.4)}>
          <p className="meta">Kept on this device</p>
          <ul>
            {saved.slice(0, 6).map((m) => (
              <li key={m.id}>
                <button className="saved-open" onClick={() => onOpenSaved(m)}>
                  <span className="saved-swatch" style={{ background: `linear-gradient(135deg, ${m.palette.colors[0]}, ${m.palette.colors[3]}, ${m.palette.colors[1]})` }} />
                  <span className="serif">{m.title}</span>
                  <span className="meta">{new Date(m.createdAt).toLocaleDateString()}</span>
                </button>
                <button className="saved-del" aria-label={`Forget “${m.title}”`} onClick={() => { deleteSaved(m.id); setSaved(listSaved()); }}>×</button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </section>
  );
}
