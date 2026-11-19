import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MemoryProfile, SculptureVariant, VisualMode } from '../memory/types';
import type { CanvasHandle, Selection } from '../scene/MemoryCanvas';
import type { MaterialStyle } from '../scene/object/ObjectScene';
import { Breakdown } from './Interpretation';
import { detectQuality, prefersReducedMotion, type Quality } from '../lib/capability';
import { saveMemory } from '../lib/storage';
import { makeShareUrl } from '../lib/share';
import { ambient } from '../audio/ambient';
import { MemoryPainting } from '../painting/MemoryPainting';
import type { PaintStyle } from '../painting/paint';

const MODE_NAME: Record<VisualMode, string> = { world: 'The World', object: 'The Object', painting: 'The Painting' };

const MemoryCanvas = lazy(() => import('../scene/MemoryCanvas').then((m) => ({ default: m.MemoryCanvas })));

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** 2D fallback for devices without WebGL: a layered gradient poster of the memory. */
function Poster({ profile }: { profile: MemoryProfile }) {
  const c = profile.palette.colors;
  return (
    <div className="poster" style={{ background: `radial-gradient(ellipse at 50% 70%, ${c[3]}aa, transparent 60%), radial-gradient(circle at 30% 30%, ${c[5]}88, transparent 45%), linear-gradient(${c[0]}, ${c[1]} 70%, ${c[2]})` }}>
      <div className="poster-form" style={{ background: `radial-gradient(circle at 40% 35%, ${c[5]}, ${c[3]} 55%, ${c[4]})` }} />
      <p className="meta">3D is unavailable on this device. This is a still interpretation.</p>
    </div>
  );
}

const SOUND_LABEL = 'Ambient sound';

export function Result({ profile, shared, onEdit, onNew, onUpdate }: { profile: MemoryProfile; shared: boolean; onEdit: () => void; onNew: () => void; onUpdate: (p: MemoryProfile) => void }) {
  const [quality, setQuality] = useState<Quality>(() => detectQuality());
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const [mode, setMode] = useState<VisualMode>(profile.mode.value);
  const [variant, setVariant] = useState<SculptureVariant>(profile.variant);
  const [material, setMaterial] = useState<MaterialStyle>('glass');
  const [paintStyle, setPaintStyle] = useState<PaintStyle>(() => (profile.mood.value === 'uncertain' || profile.mood.value === 'strange' ? 'ink' : profile.mood.value === 'joyful' ? 'oil' : 'watercolor'));
  const [paintVariation, setPaintVariation] = useState(0);
  const [light, setLight] = useState(1);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 760);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const canvas = useRef<CanvasHandle>(null);

  useEffect(() => { setSelection(null); }, [mode, variant]);
  useEffect(() => () => ambient.stop(), []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'h') setPanelOpen((v) => !v);
      if (e.key === 'Escape') { setSelection(null); setInfoOpen(false); setShareOpen(false); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function toggleSound() {
    if (sound) { ambient.stop(); setSound(false); return; }
    await ambient.start(profile.sounds.map((s) => s.value), profile.mood.value, volume);
    setSound(true);
  }

  function exportImage() {
    const url = canvas.current?.capture();
    if (!url) { setToast('Could not capture the canvas on this device.'); return; }
    const a = document.createElement('a');
    a.href = url; a.download = `shape-of-a-memory-${profile.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`;
    a.click();
    setToast('Image saved.');
  }

  function save() {
    const p = { ...profile, variant, mode: { ...profile.mode, value: mode } };
    onUpdate(p);
    setToast(saveMemory(p) ? 'Kept in this browser only.' : 'This browser would not allow saving.');
  }

  async function copyShare(includeWords: boolean) {
    const url = makeShareUrl({ ...profile, variant, mode: { ...profile.mode, value: mode } }, includeWords);
    try { await navigator.clipboard.writeText(url); setToast('Link copied. It holds the memory itself; no server stores it.'); }
    catch { window.prompt('Copy this link', url); }
    setShareOpen(false);
  }

  const sel = selection;
  const selInfo = sel ? (sel.kind === 'object'
    ? { k: profile.objects[sel.index]?.source === 'visitor' ? 'From your words' : 'Imagined', title: profile.objects[sel.index]?.label, body: profile.objects[sel.index]?.note }
    : { k: 'Forgotten', title: profile.unclear[sel.index], body: 'You said this part was unclear. It stays frosted; the interpretation does not try to fill it in.' }) : null;

  const settings = { light, quality: quality === 'none' ? 'low' as const : quality, reducedMotion };

  return (
    <section className="result">
      <div className="canvas-wrap">
        {mode === 'painting' ? (
          <MemoryPainting ref={canvas} profile={profile} style={paintStyle} variation={paintVariation} light={light} />
        ) : quality === 'none' ? <Poster profile={profile} /> : (
          <CanvasBoundary fallback={<Poster profile={profile} />}>
            <Suspense fallback={<div className="canvas-loading"><span className="meta">Building the scene…</span></div>}>
              <MemoryCanvas ref={canvas} profile={profile} mode={mode} variant={variant} material={material}
                settings={settings} selection={selection} onSelect={setSelection} resetKey={resetKey} />
            </Suspense>
          </CanvasBoundary>
        )}
        <div className="vignette" aria-hidden="true" />
      </div>

      <header className="result-top">
        <div>
          <p className="meta">{MODE_NAME[mode]} · {profile.palette.name}{shared ? ' · shared with you' : ''}</p>
          <h1 className="serif">{profile.title}</h1>
        </div>
        <nav className="result-nav">
          <button className="btn btn-glass" onClick={() => setInfoOpen(true)}>The memory</button>
          <button className="btn btn-glass" onClick={onEdit}>Edit words</button>
          <button className="btn btn-glass" onClick={onNew}>New memory</button>
        </nav>
      </header>

      <p className="hint-bar meta" aria-hidden="true">
        {mode === 'world' ? 'Drag to look · scroll / pinch to move closer · WASD to walk · click things' : mode === 'painting' ? 'Change the medium or repaint it in the controls' : 'Drag to turn · scroll / pinch to zoom · click fragments'}
      </p>

      <AnimatePresence>
        {selInfo && (
          <motion.aside key="sel" className="sel-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} role="dialog" aria-label="Detail">
            <p className="meta">{selInfo.k}</p>
            <p className="serif sel-title">{selInfo.title}</p>
            <p className="sel-body">{selInfo.body}</p>
            <button className="btn-link" onClick={() => setSelection(null)}>Close</button>
          </motion.aside>
        )}
      </AnimatePresence>

      <button className="panel-toggle btn btn-glass" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen} aria-controls="controls">
        {panelOpen ? 'Hide controls' : 'Controls'}
      </button>

      <AnimatePresence>
        {panelOpen && (
          <motion.aside id="controls" className="panel" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="ctl">
              <p className="meta">Form</p>
              <div className="seg">
                <button className={mode === 'world' ? 'on' : ''} onClick={() => setMode('world')}>World</button>
                <button className={mode === 'object' ? 'on' : ''} onClick={() => setMode('object')}>Object</button>
                <button className={mode === 'painting' ? 'on' : ''} onClick={() => setMode('painting')}>Painting</button>
              </div>
            </div>
            {mode === 'painting' && (
              <div className="ctl">
                <p className="meta">Medium</p>
                <div className="seg">
                  {(['watercolor', 'oil', 'ink'] as PaintStyle[]).map((s) => <button key={s} className={paintStyle === s ? 'on' : ''} onClick={() => setPaintStyle(s)}>{s === 'watercolor' ? 'Watercolour' : s}</button>)}
                </div>
                <button className="btn btn-small" onClick={() => setPaintVariation((v) => v + 1)}>Repaint</button>
              </div>
            )}
            {mode === 'object' && (
              <>
                <div className="ctl">
                  <p className="meta">Variation</p>
                  <div className="seg">
                    {(['glass', 'fragments', 'threads'] as SculptureVariant[]).map((v) => <button key={v} className={variant === v ? 'on' : ''} onClick={() => setVariant(v)}>{v === 'glass' ? 'Layers' : v === 'fragments' ? 'Fragments' : 'Threads'}</button>)}
                  </div>
                </div>
                <div className="ctl">
                  <p className="meta">Material</p>
                  <div className="seg">
                    {(['glass', 'pearl', 'clay', 'chrome'] as MaterialStyle[]).map((m) => <button key={m} className={material === m ? 'on' : ''} onClick={() => setMaterial(m)}>{m}</button>)}
                  </div>
                </div>
              </>
            )}
            <div className="ctl">
              <label className="meta" htmlFor="light">Light · {Math.round(light * 100)}%</label>
              <input id="light" type="range" min={0.2} max={2} step={0.05} value={light} onChange={(e) => setLight(+e.target.value)} />
            </div>
            <div className="ctl">
              <p className="meta">{SOUND_LABEL}</p>
              <div className="row">
                <button className={`btn btn-small ${sound ? 'on' : ''}`} onClick={toggleSound} aria-pressed={sound}>{sound ? 'Sound on' : 'Sound off'}</button>
                <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={volume} disabled={!sound}
                  onChange={(e) => { setVolume(+e.target.value); ambient.setVolume(+e.target.value); }} />
              </div>
            </div>
            {quality !== 'none' && mode !== 'painting' && (
              <div className="ctl">
                <p className="meta">Detail</p>
                <div className="seg">
                  <button className={quality === 'high' ? 'on' : ''} onClick={() => setQuality('high')}>Full</button>
                  <button className={quality === 'low' ? 'on' : ''} onClick={() => setQuality('low')}>Light</button>
                </div>
              </div>
            )}
            <div className="ctl actions">
              {mode !== 'painting' && <button className="btn btn-small" onClick={() => setResetKey((k) => k + 1)}>Reset view</button>}
              <button className="btn btn-small" onClick={save}>Save</button>
              <button className="btn btn-small" onClick={exportImage} disabled={quality === 'none' && mode !== 'painting'}>Export image</button>
              <button className="btn btn-small" onClick={() => setShareOpen(true)}>Share</button>
            </div>
            <p className="meta panel-foot">Press H to hide</p>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {infoOpen && (
          <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInfoOpen(false)}>
            <motion.aside className="drawer" role="dialog" aria-label="The memory" initial={{ x: -40 }} animate={{ x: 0 }} exit={{ x: -40 }} onClick={(e) => e.stopPropagation()}>
              <button className="btn-link drawer-close" onClick={() => setInfoOpen(false)}>Close</button>
              <p className="meta">The memory</p>
              <h2 className="serif">{profile.title}</h2>
              <p className="tone serif"><em>{profile.emotionalTone}</em></p>
              <Breakdown profile={profile} compact />
              <p className="meta section-head">In your words</p>
              <dl className="original">
                {([['What happened', profile.input.what], ['Where', profile.input.where], ['When', profile.input.when], ['Seen', profile.input.seeing], ['Heard', profile.input.sounds], ['Felt', profile.input.feeling], ['Unclear', profile.input.unclear]] as const)
                  .filter(([, v]) => v.trim()).map(([k, v]) => <div key={k}><dt className="meta">{k}</dt><dd className="serif">{v}</dd></div>)}
                {![profile.input.what, profile.input.where, profile.input.when, profile.input.seeing, profile.input.sounds, profile.input.feeling, profile.input.unclear].some((v) => v.trim()) &&
                  <p className="empty">{shared ? 'The words were kept private by whoever shared this.' : 'No words were given.'}</p>}
              </dl>
              <p className="disclaimer">An artistic interpretation. It does not reconstruct the real memory or recover forgotten details.</p>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareOpen && (
          <motion.div className="drawer-scrim center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShareOpen(false)}>
            <motion.div className="modal" role="dialog" aria-label="Share" initial={{ y: 16 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}>
              <p className="meta">Share</p>
              <p className="serif modal-title">Who should see your words?</p>
              <p className="hint">The link carries the memory inside itself (after the #), so no server ever receives it. Anyone with the link can open it.</p>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => copyShare(false)}>Share the shape only</button>
                <button className="btn btn-quiet" onClick={() => copyShare(true)}>Include my words</button>
              </div>
              <button className="btn-link" onClick={() => setShareOpen(false)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <motion.p className="toast" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.p>}</AnimatePresence>
    </section>
  );
}
