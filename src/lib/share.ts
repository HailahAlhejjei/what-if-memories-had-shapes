// Share links live entirely in the URL fragment (#...), which browsers never send to a server.
import type { MemoryProfile } from '../memory/types';
import { EMPTY_INPUT } from '../memory/types';

function toB64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** includeWords=false strips the visitor's text and evidence quotes, leaving only the shape. */
export function makeShareUrl(p: MemoryProfile, includeWords: boolean): string {
  let data: MemoryProfile = p;
  if (!includeWords) {
    const strip = <T extends { evidence?: string }>(x: T): T => ({ ...x, evidence: x.evidence ? '(private)' : undefined });
    data = {
      ...p,
      title: 'A shared memory',
      input: { ...EMPTY_INPUT, mood: p.input.mood },
      environment: strip(p.environment), time: strip(p.time), weather: strip(p.weather), mood: strip(p.mood),
      objects: p.objects.map((o) => ({ ...strip(o), note: o.source === 'visitor' ? 'From the original description (kept private).' : o.note })),
      sounds: p.sounds.map(strip),
      unclear: p.unclear.map(() => '…'),
    };
  }
  const url = new URL(window.location.href);
  url.hash = 'm=' + toB64(JSON.stringify(data));
  return url.toString();
}

export function readSharedFromHash(): MemoryProfile | null {
  const m = window.location.hash.match(/m=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const p = JSON.parse(fromB64(m[1]));
    return p && p.version === 1 && p.environment && p.palette ? p : null;
  } catch { return null; }
}
