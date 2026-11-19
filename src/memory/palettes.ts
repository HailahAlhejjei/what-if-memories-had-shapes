import type { Mood, TimeOfDay, Weather } from './types';

// Brand palette
export const BRAND = {
  ivory: '#F4EFE6',
  rose: '#C99A9D',
  blue: '#8DA8B9',
  amber: '#D6A66A',
  plum: '#382D40',
  charcoal: '#29272B',
};

interface Palette { name: string; colors: string[] }

// colors: [sky-top, sky-bottom/fog, ground, primary accent, secondary accent, light]
const MOOD_PALETTES: Record<Mood, Palette> = {
  nostalgic: { name: 'Faded photograph', colors: ['#6E5A5E', '#E9D9C8', '#B89B88', '#C99A9D', '#A27B5C', '#F4EFE6'] },
  peaceful: { name: 'Still water', colors: ['#7E97A8', '#E3E6E0', '#A8B5A2', '#8DA8B9', '#C9D3C0', '#F6F3EC'] },
  strange: { name: 'Lucid violet', colors: ['#241D33', '#6E5F86', '#3A3149', '#9FD3C7', '#C99A9D', '#E8DFF5'] },
  joyful: { name: 'Golden hour', colors: ['#E3A869', '#F7E4BE', '#C8B26F', '#D6A66A', '#9DBA8A', '#FFF6E6'] },
  melancholic: { name: 'Blue hour', colors: ['#2E3A4A', '#8C9BA8', '#4C5560', '#8DA8B9', '#B7B3BE', '#DCE3E8'] },
  uncertain: { name: 'Plum fog', colors: ['#382D40', '#8F8796', '#4A4252', '#7E8EA3', '#C99A9D', '#D9D3DC'] },
};

const CHILDHOOD: Palette = { name: 'Childhood afternoon', colors: ['#D9B26A', '#F3E7B5', '#A9B98A', '#D6A66A', '#8FB28A', '#FFF8E2'] };
const RAIN: Palette = { name: 'Rain on glass', colors: ['#5F7383', '#C7CFD4', '#6D7880', '#8DA8B9', '#A9B4BC', '#EEF2F4'] };
const NIGHT: Palette = { name: 'Night lantern', colors: ['#14131C', '#3B3550', '#24222C', '#D6A66A', '#8DA8B9', '#F2D9A8'] };

const hexToRgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};

export function choosePalette(mood: Mood, time: TimeOfDay, weather: Weather, childhood: boolean): Palette & { reason: string } {
  let base: Palette = MOOD_PALETTES[mood];
  let reason = `${mood} mood`;
  if (childhood && (mood === 'joyful' || mood === 'nostalgic' || mood === 'peaceful')) { base = CHILDHOOD; reason = 'a childhood memory'; }
  if (weather === 'rain') { base = blend(base, RAIN, 0.65, 'Rain-washed ' + base.name.toLowerCase()); reason += ', with rain'; }
  if (time === 'night') { base = blend(base, NIGHT, 0.7, 'Nocturne'); reason += ', at night'; }
  else if (time === 'dusk') { base = blend(base, NIGHT, 0.35, base.name + ' at dusk'); reason += ', at dusk'; }
  else if (time === 'sunset') { base = blend(base, MOOD_PALETTES.joyful, 0.35, base.name + ', late sun'); reason += ', at sunset'; }
  return { ...base, reason };
}

/** Tints a palette with the colours of further moods. */
export function blendMoods(colors: string[], extra: Mood[]): string[] {
  return extra.reduce((acc, m, i) => acc.map((c, k) => mix(c, MOOD_PALETTES[m].colors[k], i === 0 ? 0.3 : 0.18)), colors);
}

function blend(a: Palette, b: Palette, t: number, name: string): Palette {
  return { name, colors: a.colors.map((c, i) => mix(c, b.colors[i], t)) };
}
