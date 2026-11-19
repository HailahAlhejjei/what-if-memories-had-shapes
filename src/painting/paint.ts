// MODE 3: THE PAINTING. A generative, abstract painting rendered on a 2D canvas.
// It does not depict the memory. It absorbs its colours, light, weather, objects (as motifs)
// and forgotten parts (as unpainted, erased areas).
import type { Environment, MemoryProfile, ObjectKind, TimeOfDay } from '../memory/types';
import { mulberry32 } from '../memory/interpret';
import { mix } from '../memory/palettes';

export type PaintStyle = 'watercolor' | 'oil' | 'ink';

type Rnd = () => number;
type Pt = [number, number];

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Gaussian-ish random
const gauss = (r: Rnd) => (r() + r() + r() + r() - 2) / 2;

/** Recursive midpoint deformation: the basis of watercolor-like irregular edges. */
function deform(poly: Pt[], depth: number, variance: number, r: Rnd): Pt[] {
  if (depth <= 0) return poly;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    out.push(a, [(a[0] + b[0]) / 2 + gauss(r) * len * variance, (a[1] + b[1]) / 2 + gauss(r) * len * variance]);
  }
  return deform(out, depth - 1, variance, r);
}

function blobPoly(cx: number, cy: number, rx: number, ry: number, sides: number, r: Rnd): Pt[] {
  const n = Math.max(sides, 16);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx * (0.8 + r() * 0.4), cy + Math.sin(a) * ry * (0.8 + r() * 0.4)] as Pt;
  });
}

function fillPoly(ctx: CanvasRenderingContext2D, p: Pt[]) {
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath(); ctx.fill();
}

/** Many translucent, slightly different layers of one shape: a wash of pigment. */
function wash(ctx: CanvasRenderingContext2D, base: Pt[], color: string, alpha: number, layers: number, r: Rnd, spread = 0.35) {
  const seed = deform(base, 3, spread * 0.6, r);
  ctx.fillStyle = rgba(color, alpha);
  for (let i = 0; i < layers; i++) fillPoly(ctx, deform(seed, 3, spread * 0.85, r));
}

const SUN: Record<TimeOfDay, { x: number; y: number; size: number; strength: number }> = {
  dawn: { x: 0.22, y: 0.58, size: 0.5, strength: 0.6 },
  morning: { x: 0.3, y: 0.3, size: 0.6, strength: 0.55 },
  afternoon: { x: 0.62, y: 0.2, size: 0.7, strength: 0.5 },
  sunset: { x: 0.7, y: 0.56, size: 0.6, strength: 0.85 },
  dusk: { x: 0.78, y: 0.62, size: 0.45, strength: 0.4 },
  night: { x: 0.72, y: 0.22, size: 0.18, strength: 0.7 },
};

const HORIZON: Record<Environment, number> = {
  bedroom: 0.66, kitchen: 0.64, corridor: 0.6, street: 0.62, garden: 0.6, field: 0.56, forest: 0.68, beach: 0.55, void: 0.72,
};

type Motif = 'glow' | 'tall' | 'frame' | 'mass' | 'pebble';
const MOTIF: Record<ObjectKind, Motif> = {
  lamp: 'glow', streetlight: 'glow', clock: 'glow', piano: 'mass', bed: 'mass', table: 'mass', bench: 'mass', chair: 'mass',
  car: 'mass', boat: 'mass', tree: 'tall', flower: 'tall', swing: 'tall', umbrella: 'tall', door: 'frame', window: 'frame',
  book: 'pebble', cup: 'pebble', shell: 'pebble', stone: 'pebble',
};

export interface PaintOptions { style: PaintStyle; variation: number; light: number }

export function paintMemory(ctx: CanvasRenderingContext2D, W: number, H: number, profile: MemoryProfile, opts: PaintOptions) {
  const r = mulberry32(profile.seed + opts.variation * 7919);
  const [top, bottom, ground, accent, accent2, light] = profile.palette.colors;
  const S = Math.min(W, H);
  const style = opts.style;
  const ink = style === 'ink';
  const paper = ink ? '#F1EBDF' : style === 'watercolor' ? mix('#F4EFE6', light, 0.3) : mix(ground, bottom, 0.5);
  const hz = H * (HORIZON[profile.environment.value] + (r() - 0.5) * 0.06);
  const sun = SUN[profile.time.value];
  const night = profile.time.value === 'night';
  const clarity = profile.atmosphere.clarity;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);

  // 1. Ground washes: sky and earth as broad, bleeding bands of pigment.
  const skyCol = ink ? mix(top, '#a9a49d', 0.85) : top;
  const lowCol = ink ? mix(bottom, '#bdb6aa', 0.8) : bottom;
  const earthCol = ink ? mix(ground, '#6a6560', 0.8) : ground;
  const bandAlpha = style === 'oil' ? 0.08 : ink ? 0.025 : 0.045;
  const bandLayers = style === 'oil' ? 26 : 34;
  wash(ctx, [[-W * 0.1, -H * 0.1], [W * 1.1, -H * 0.1], [W * 1.1, hz * 0.7], [-W * 0.1, hz * 0.75]], skyCol, bandAlpha, bandLayers, r, 0.25);
  wash(ctx, [[-W * 0.1, hz * 0.45], [W * 1.1, hz * 0.4], [W * 1.1, hz * 1.08], [-W * 0.1, hz * 1.05]], lowCol, bandAlpha, bandLayers, r, 0.3);
  wash(ctx, [[-W * 0.1, hz * 0.98], [W * 1.1, hz * 0.95], [W * 1.1, H * 1.1], [-W * 0.1, H * 1.1]], earthCol, bandAlpha * 1.1, bandLayers, r, 0.25);

  // 2. The light of that time of day: a soft bloom (or a small moon).
  const sx = W * (sun.x + (r() - 0.5) * 0.1), sy = H * sun.y;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, S * sun.size);
  const lightCol = night ? '#E8ECF2' : mix(light, accent, 0.25);
  g.addColorStop(0, rgba(lightCol, sun.strength * 0.8 * opts.light));
  g.addColorStop(0.25, rgba(lightCol, sun.strength * 0.3 * opts.light));
  g.addColorStop(1, rgba(lightCol, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (night) wash(ctx, blobPoly(sx, sy, S * 0.035, S * 0.035, 10, r), '#F4EFE6', 0.12, 14, r, 0.08);
  else if (sun.strength > 0.5) wash(ctx, blobPoly(sx, sy, S * 0.06, S * 0.06, 10, r), mix(light, accent, 0.4), 0.05, 20, r, 0.2);

  // 3. Mood colour fields: a few large drifting shapes of accent colour.
  const fields = 3 + Math.floor(r() * 3);
  for (let i = 0; i < fields; i++) {
    const c = [accent, accent2, mix(accent, top, 0.5), mix(accent2, light, 0.4)][i % 4];
    const cx = W * (0.1 + r() * 0.8), cy = H * (0.2 + r() * 0.7);
    wash(ctx, blobPoly(cx, cy, S * (0.15 + r() * 0.25), S * (0.08 + r() * 0.16), 9, r), ink ? mix(c, '#8a8580', 0.9) : c, style === 'oil' ? 0.05 : ink ? 0.012 : 0.022, 36, r, 0.4);
  }

  // 4. Objects become motifs, spread along the composition. Imagined ones are fainter.
  const n = profile.objects.length;
  profile.objects.forEach((o, i) => {
    const m = MOTIF[o.value];
    const fx = (i + 0.5 + (r() - 0.5) * 0.6) / Math.max(n, 1);
    const x = W * (0.08 + fx * 0.84);
    const faint = (o.source === 'inferred' ? 0.55 : 1) * (ink ? 0.6 : 1);
    const c = i % 2 ? accent : accent2;
    const col = ink ? mix(c, '#5b5652', 0.75) : c;
    switch (m) {
      case 'glow': {
        const y = hz - S * (0.15 + r() * 0.2), rad = S * (0.08 + r() * 0.06);
        const gg = ctx.createRadialGradient(x, y, 0, x, y, rad * 3);
        gg.addColorStop(0, rgba(mix(light, '#FFE6B0', 0.4), 0.55 * faint * opts.light)); gg.addColorStop(1, rgba(light, 0));
        ctx.fillStyle = gg; ctx.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
        wash(ctx, blobPoly(x, y, rad * 0.5, rad * 0.5, 8, r), ink ? '#F4EFE6' : mix(light, accent, 0.3), 0.06 * faint, 18, r, 0.25);
        break;
      }
      case 'tall': {
        const h = S * (0.25 + r() * 0.25), w = S * (0.05 + r() * 0.05);
        wash(ctx, [[x - w * 0.3, hz + S * 0.02], [x + w * 0.3, hz + S * 0.02], [x + w * 0.2, hz - h * 0.6], [x - w * 0.2, hz - h * 0.6]], mix(col, ground, 0.4), 0.05 * faint, 18, r, 0.2);
        wash(ctx, blobPoly(x, hz - h * 0.75, w * 2.2, h * 0.32, 9, r), col, 0.035 * faint, 30, r, 0.45);
        break;
      }
      case 'frame': {
        const w = S * (0.12 + r() * 0.08), h = w * (1.3 + r() * 0.4), y = hz - h - S * 0.02;
        wash(ctx, [[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h], [x - w / 2, y + h]], mix(light, '#ffffff', 0.3), 0.07 * faint * opts.light, 16, r, 0.06);
        ctx.strokeStyle = rgba(ink ? '#2b2b2b' : mix(col, ground, 0.3), 0.35 * faint); ctx.lineWidth = S * 0.004;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.rect(x - w / 2 + gauss(r) * 3, y + gauss(r) * 3, w, h); ctx.stroke(); }
        break;
      }
      case 'mass': {
        const w = S * (0.2 + r() * 0.15), h = S * (0.06 + r() * 0.06), y = hz + S * (0.02 + r() * 0.08);
        wash(ctx, blobPoly(x, y, w / 2, h / 2, 8, r), col, 0.045 * faint, 26, r, 0.22);
        break;
      }
      case 'pebble': {
        const y = hz + S * (0.08 + r() * 0.2), rad = S * (0.025 + r() * 0.025);
        wash(ctx, blobPoly(x, y, rad * 1.3, rad, 8, r), col, 0.08 * faint, 16, r, 0.2);
        break;
      }
    }
  });

  // Soften: pigment bleeds into wet paper (oil keeps its hard edges).
  if (style !== 'oil') {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.filter = `blur(${Math.round(S * 0.006)}px)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
    ctx.filter = 'none';
  }

  // 5. Brushwork that follows a flow field shaped by the mood.
  const turbulence = profile.mood.value === 'strange' || profile.mood.value === 'uncertain' ? 2.6 : profile.mood.value === 'joyful' ? 1.6 : 0.9;
  const strokes = style === 'oil' ? 2600 : style === 'ink' ? 320 : 260;
  const angleAt = (x: number, y: number) =>
    Math.sin(x / S * 3.1 + profile.seed % 7) * turbulence + Math.cos(y / S * 2.3 + opts.variation) * turbulence * 0.7 + (y < hz ? 0 : 0.15);
  const strokePalette = ink ? ['#2b2b2b', '#3d3a38', accent] : style === 'oil' ? [top, bottom, accent, accent2, light, ground] : [accent, accent2, light];
  for (let i = 0; i < strokes; i++) {
    let x = r() * W, y = r() * H;
    const c = strokePalette[Math.floor(r() * strokePalette.length)];
    const len = (style === 'oil' ? 6 : ink ? 22 : 12) + r() * (style === 'oil' ? 14 : 30);
    const width = style === 'oil' ? S * (0.004 + r() * 0.01) : ink ? S * (0.0008 + r() * 0.002) : S * (0.002 + r() * 0.006);
    ctx.strokeStyle = rgba(c, style === 'oil' ? 0.22 + r() * 0.25 : ink ? 0.25 + r() * 0.4 : 0.06 + r() * 0.08);
    ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < len; k++) {
      const a = angleAt(x, y);
      x += Math.cos(a) * S * 0.004; y += Math.sin(a) * S * 0.004;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 6. Weather, painted.
  const w = profile.weather.value;
  if (w === 'rain') {
    ctx.strokeStyle = rgba(mix(light, top, 0.3), 0.12); ctx.lineWidth = S * 0.0015;
    for (let i = 0; i < 380; i++) { const x = r() * W, y = r() * H, l = S * (0.03 + r() * 0.08); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.08, y + l); ctx.stroke(); }
  }
  if (w === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 500; i++) { ctx.beginPath(); ctx.arc(r() * W, r() * H, S * (0.001 + r() * 0.003), 0, 6.3); ctx.fill(); } }
  if (w === 'fog' || profile.atmosphere.haze > 0.55) {
    const fg = ctx.createLinearGradient(0, hz - S * 0.3, 0, hz + S * 0.2);
    fg.addColorStop(0, rgba(paper, 0)); fg.addColorStop(0.5, rgba(mix(paper, light, 0.5), 0.45 * profile.atmosphere.haze)); fg.addColorStop(1, rgba(paper, 0));
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
  }

  // 7. What was forgotten is left unpainted: soft erasures back to bare paper.
  const gaps = profile.unclear.length + Math.round((1 - clarity) * 2);
  for (let i = 0; i < gaps; i++) {
    const cx = W * (0.15 + r() * 0.7), cy = H * (0.2 + r() * 0.6), rad = S * (0.07 + r() * 0.09);
    const eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    eg.addColorStop(0, rgba(ink ? '#F1EBDF' : mix('#F4EFE6', paper, 0.3), 0.9)); eg.addColorStop(0.6, rgba(mix('#F4EFE6', paper, 0.3), 0.55)); eg.addColorStop(1, rgba(paper, 0));
    ctx.fillStyle = eg;
    fillPoly(ctx, deform(blobPoly(cx, cy, rad, rad * (0.6 + r() * 0.5), 8, r), 3, 0.25, r));
  }

  // 8. Ink gesture lines on top for the ink style.
  if (ink) {
    ctx.strokeStyle = 'rgba(30,28,30,0.65)'; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = S * (0.002 + r() * 0.004);
      let x = r() * W, y = hz + gauss(r) * S * 0.15;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 40; k++) { x += S * 0.012 * (r() + 0.2); y += gauss(r) * S * 0.01; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }

  // 9. Paper / canvas texture, overall light, and a quiet vignette.
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const exposure = 0.75 + opts.light * 0.25;
  const grain = style === 'oil' ? 18 : 12;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % W, py = Math.floor(i / 4 / W);
    const weave = style === 'oil' ? ((px % 4 < 2) !== (py % 4 < 2) ? 4 : -4) : 0;
    const nz = (Math.random() - 0.5) * grain + weave;
    d[i] = Math.min(255, d[i] * exposure + nz); d[i + 1] = Math.min(255, d[i + 1] * exposure + nz); d[i + 2] = Math.min(255, d[i + 2] * exposure + nz);
  }
  ctx.putImageData(img, 0, 0);
  const v = ctx.createRadialGradient(W / 2, H / 2, S * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(20,16,22,${style === 'oil' ? 0.38 : 0.22})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
