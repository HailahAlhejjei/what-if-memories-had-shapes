import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { MemoryProfile } from '../memory/types';
import { mix } from '../memory/palettes';
import { paintMemory, type PaintStyle } from './paint';
import type { CanvasHandle } from '../scene/MemoryCanvas';

const MEDIUM: Record<PaintStyle, string> = {
  watercolor: 'Watercolour on paper',
  oil: 'Oil on canvas',
  ink: 'Ink and wash',
};

interface Props { profile: MemoryProfile; style: PaintStyle; variation: number; light: number }

/** Hangs the generated painting on a gallery wall, with a small museum label. */
export const MemoryPainting = forwardRef<CanvasHandle, Props>(function MemoryPainting({ profile, style, variation, light }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    capture: () => { try { return canvas.current?.toDataURL('image/png') ?? null; } catch { return null; } },
    resetView: () => {},
  }));

  // Fit a landscape (or portrait on phones) painting inside the wall.
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight;
      const portrait = W < 700;
      const ratio = portrait ? 4 / 5 : 4 / 3;
      const maxW = W * (portrait ? 0.84 : 0.62), maxH = H * (portrait ? 0.56 : 0.62);
      const w = Math.min(maxW, maxH * ratio);
      setSize({ w: Math.round(w), h: Math.round(w / ratio) });
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current; if (!c || !size.w) return;
    setReady(false);
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      paintMemory(ctx, c.width, c.height, profile, { style, variation, light });
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [profile, style, variation, light, size]);

  const wall = mix(profile.palette.colors[1], '#29272B', 0.78);
  const year = new Date(profile.createdAt).getFullYear();

  return (
    <div ref={wrap} className="gallery" style={{ background: `radial-gradient(ellipse at 50% 35%, ${mix(wall, profile.palette.colors[5], 0.12)}, ${wall} 70%)` }}>
      <figure className="artwork" style={{ width: size.w || undefined }}>
        <div className={`frame frame-${style}`}>
          <canvas ref={canvas} style={{ width: size.w, height: size.h, opacity: ready ? 1 : 0 }} aria-label={`Abstract painting of the memory “${profile.title}”`} role="img" />
          {!ready && <span className="meta painting-wait">Painting…</span>}
        </div>
        <figcaption className="plaque">
          <span className="serif plaque-title">{profile.title}</span>
          <span className="meta">{MEDIUM[style]} · {year}</span>
          <span className="plaque-note">Colours, light and shapes taken from a memory. The pale, unpainted areas are what was forgotten.</span>
        </figcaption>
      </figure>
    </div>
  );
});
