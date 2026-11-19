// Local, offline interpreter: turns free text into a MemoryProfile using a small lexicon.
// No network. Deterministic for the same input (seeded).

import { choosePalette } from './palettes';
import type {
  Environment, MemoryInput, MemoryObject, MemoryProfile, Mood, ObjectKind, SculptureVariant,
  SoundKind, Sourced, TimeOfDay, VisualMode, Weather,
} from './types';

type Lexicon<T extends string> = Record<T, string[]>;

const ENV_WORDS: Lexicon<Environment> = {
  bedroom: ['bedroom', 'my room', 'bed', 'pillow', 'blanket', 'attic', 'dorm', 'nursery'],
  kitchen: ['kitchen', 'stove', 'oven', 'dining', 'breakfast', 'grandmother\'s house', 'grandma', 'cooking', 'baking'],
  street: ['street', 'road', 'city', 'town', 'sidewalk', 'pavement', 'avenue', 'alley', 'downtown', 'traffic', 'crossing', 'bus stop'],
  garden: ['garden', 'backyard', 'yard', 'park', 'courtyard', 'porch', 'balcony', 'greenhouse'],
  corridor: ['corridor', 'hallway', 'hall', 'school', 'hospital', 'classroom', 'station', 'airport', 'office', 'building', 'stairs'],
  beach: ['beach', 'sea', 'ocean', 'shore', 'coast', 'waves', 'sand', 'harbor', 'harbour', 'pier', 'lake'],
  field: ['field', 'meadow', 'desert', 'farm', 'hill', 'countryside', 'prairie', 'grass', 'dunes', 'village', 'mountain'],
  forest: ['forest', 'woods', 'trees', 'jungle', 'trail', 'camping', 'cabin'],
  void: ['dream', 'nowhere', 'darkness', 'void', 'space'],
};

const TIME_WORDS: Lexicon<TimeOfDay> = {
  dawn: ['dawn', 'sunrise', 'early morning', 'first light', 'daybreak', 'fajr'],
  morning: ['morning', 'breakfast', 'am ', 'before school'],
  afternoon: ['afternoon', 'noon', 'midday', 'lunch', 'after school', 'daytime', 'sunny'],
  sunset: ['sunset', 'golden hour', 'evening sun', 'maghrib', 'late afternoon'],
  dusk: ['dusk', 'twilight', 'evening', 'dinner'],
  night: ['night', 'midnight', 'dark', 'stars', 'moon', 'late', 'bedtime', 'sleep'],
};

const WEATHER_WORDS: Lexicon<Weather> = {
  clear: ['clear', 'sunny', 'bright', 'blue sky'],
  rain: ['rain', 'raining', 'rainy', 'storm', 'drizzle', 'wet', 'puddle', 'thunder', 'umbrella'],
  fog: ['fog', 'mist', 'misty', 'haze', 'hazy', 'cloudy', 'grey', 'gray', 'blurry'],
  snow: ['snow', 'snowing', 'winter', 'frost', 'ice', 'cold'],
  wind: ['wind', 'windy', 'breeze', 'gust', 'dust storm'],
};

const MOOD_WORDS: Lexicon<Mood> = {
  nostalgic: ['nostalg', 'miss', 'used to', 'long ago', 'remember', 'childhood', 'old', 'faded', 'grandm', 'grandf'],
  peaceful: ['peace', 'calm', 'quiet', 'safe', 'still', 'gentle', 'warm', 'cozy', 'cosy', 'rest', 'soft'],
  strange: ['strange', 'weird', 'odd', 'surreal', 'unreal', 'dream', 'eerie', 'impossible'],
  joyful: ['happy', 'joy', 'laugh', 'fun', 'excited', 'celebrat', 'birthday', 'wedding', 'play', 'love', 'bright'],
  melancholic: ['sad', 'lonely', 'alone', 'goodbye', 'lost', 'cry', 'grief', 'funeral', 'left', 'empty', 'last time', 'heavy'],
  uncertain: ['not sure', 'unsure', 'maybe', 'can\'t remember', 'cannot remember', 'forgot', 'unclear', 'confus', 'blur', 'vague', 'don\'t know'],
};

const OBJECT_WORDS: Lexicon<ObjectKind> = {
  lamp: ['lamp', 'light bulb', 'candle', 'lantern', 'nightlight'],
  bed: ['bed', 'mattress', 'pillow', 'blanket'],
  window: ['window', 'curtain', 'glass'],
  tree: ['tree', 'palm', 'oak', 'branches', 'leaves'],
  flower: ['flower', 'rose', 'jasmine', 'blossom', 'tulip', 'daisy', 'petal', 'plant'],
  bench: ['bench', 'seat'],
  door: ['door', 'gate', 'doorway', 'entrance'],
  chair: ['chair', 'sofa', 'couch', 'armchair', 'stool'],
  table: ['table', 'desk', 'counter'],
  book: ['book', 'notebook', 'letter', 'diary', 'photo', 'photograph', 'album'],
  swing: ['swing', 'playground', 'hammock'],
  umbrella: ['umbrella', 'parasol'],
  shell: ['shell', 'seashell', 'pebble'],
  boat: ['boat', 'ship', 'sail', 'canoe'],
  streetlight: ['streetlight', 'street light', 'lamppost', 'lamp post', 'neon', 'sign'],
  car: ['car', 'taxi', 'bus', 'truck', 'bicycle', 'bike', 'train'],
  piano: ['piano', 'guitar', 'radio', 'record', 'violin', 'oud'],
  clock: ['clock', 'watch', 'alarm'],
  cup: ['cup', 'tea', 'coffee', 'mug', 'glass of', 'bowl'],
  stone: ['stone', 'rock', 'wall', 'boulder'],
};

const SOUND_WORDS: Lexicon<SoundKind> = {
  rain: ['rain', 'drizzle', 'storm', 'drops', 'thunder'],
  wind: ['wind', 'breeze', 'rustl', 'whistl'],
  waves: ['wave', 'sea', 'ocean', 'surf', 'water'],
  birds: ['bird', 'chirp', 'sing', 'pigeon', 'seagull', 'gull'],
  city: ['traffic', 'car', 'horn', 'engine', 'street', 'city', 'crowd'],
  crickets: ['cricket', 'insect', 'cicada', 'frog'],
  hum: ['hum', 'fan', 'fridge', 'air condition', 'silence', 'quiet', 'nothing'],
  clock: ['tick', 'clock'],
  music: ['music', 'song', 'piano', 'radio', 'melody', 'singing', 'guitar'],
  voices: ['voice', 'talk', 'laugh', 'whisper', 'call', 'mother', 'father', 'friend', 'people'],
};

const OBJECT_LABELS: Record<ObjectKind, string> = {
  lamp: 'A small light', bed: 'A bed', window: 'A window', tree: 'A tree', flower: 'Flowers', bench: 'A bench',
  door: 'A door', chair: 'A chair', table: 'A table', book: 'Paper, or a book', swing: 'A swing', umbrella: 'An umbrella',
  shell: 'A shell', boat: 'A boat', streetlight: 'A streetlight', car: 'Something that moves you', piano: 'An instrument',
  clock: 'A clock', cup: 'A cup', stone: 'A stone',
};

// What we add when the visitor has not described objects, per environment.
const ENV_DEFAULT_OBJECTS: Record<Environment, ObjectKind[]> = {
  bedroom: ['bed', 'window', 'lamp'],
  kitchen: ['table', 'cup', 'window'],
  street: ['streetlight', 'streetlight', 'door'],
  garden: ['tree', 'flower', 'bench'],
  corridor: ['door', 'door', 'window'],
  beach: ['shell', 'boat', 'stone'],
  field: ['tree', 'stone', 'flower'],
  forest: ['tree', 'tree', 'stone'],
  void: ['stone', 'lamp', 'door'],
};

const ENV_SOUNDS: Record<Environment, SoundKind> = {
  bedroom: 'hum', kitchen: 'hum', street: 'city', garden: 'birds', corridor: 'hum', beach: 'waves', field: 'wind', forest: 'birds', void: 'hum',
};

const MOOD_TONES: Record<Mood, string> = {
  nostalgic: 'Warm but distant, like light through an old photograph.',
  peaceful: 'Still and unhurried; nothing in it is asking for anything.',
  strange: 'Familiar shapes in slightly wrong places.',
  joyful: 'Bright, open, a little overexposed with feeling.',
  melancholic: 'Quiet and heavy, edges softened by time.',
  uncertain: 'Half-present; parts dissolve the closer you look.',
};

// ---------------------------------------------------------------------------

function norm(s: string) { return ' ' + s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ') + ' '; }

const SUFFIXES = ['', 's', 'es', 'ed', 'd', 'ing', 'y', 'ly', 'e', 'er', 'ers', 'ic', 'ful', "'s"];

function findWord(text: string, words: string[]): string | null {
  for (const raw of words) {
    const w = raw.trim();
    let from = 0;
    while (true) {
      const idx = text.indexOf(w, from);
      if (idx < 0) break;
      from = idx + 1;
      const before = text[idx - 1];
      if (before && /[a-z]/.test(before)) continue; // must start a word ("bed" not in "embedded")
      // must end a word, allowing simple inflections; long stems like "nostalg" may continue freely
      const rest = text.slice(idx + w.length).match(/^[a-z']*/)?.[0] ?? '';
      if (w.includes(' ') || w.length >= 6 || SUFFIXES.includes(rest)) return w;
    }
  }
  return null;
}

/** Score every key of a lexicon against text; return best with evidence. */
function best<T extends string>(text: string, lex: Lexicon<T>): { key: T; evidence: string } | null {
  let top: { key: T; evidence: string; score: number } | null = null;
  for (const key of Object.keys(lex) as T[]) {
    let score = 0; let evidence = '';
    for (const w of lex[key]) {
      if (findWord(text, [w])) { score += 1 + w.length / 10; if (!evidence) evidence = w.trim(); }
    }
    if (score > 0 && (!top || score > top.score)) top = { key, evidence, score };
  }
  return top ? { key: top.key, evidence: top.evidence } : null;
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasText(input: MemoryInput) {
  return [input.what, input.where, input.when, input.seeing, input.sounds, input.feeling, input.unclear].some((s) => s.trim().length > 0);
}

function makeTitle(input: MemoryInput, env: Environment, time: TimeOfDay): string {
  const src = (input.what || input.seeing || input.where).trim();
  if (src) {
    const firstClause = src.split(/[.!?\n]/)[0].trim();
    const words = firstClause.split(/\s+/).slice(0, 7).join(' ');
    if (words.length > 3) return words.charAt(0).toUpperCase() + words.slice(1) + (firstClause.split(/\s+/).length > 7 ? '…' : '');
  }
  const envName: Record<Environment, string> = {
    bedroom: 'A room', kitchen: 'A kitchen', street: 'A street', garden: 'A garden', corridor: 'A corridor',
    beach: 'A shoreline', field: 'An open field', forest: 'Among trees', void: 'Somewhere',
  };
  return `${envName[env]}, ${time}`;
}

export function interpretLocally(input: MemoryInput): MemoryProfile {
  const all = norm([input.what, input.where, input.when, input.seeing, input.sounds, input.feeling, input.unclear].join(' . '));
  const where = norm(input.where + ' ' + input.what);
  const when = norm(input.when + ' ' + input.what);
  const seeing = norm(input.seeing + ' ' + input.what + ' ' + input.where);
  const sounds = norm(input.sounds);
  const feeling = norm(input.feeling + ' ' + input.what + ' ' + input.unclear);
  const seed = hashString(JSON.stringify(input)) || 1;
  const rnd = mulberry32(seed);

  // Environment
  const envHit = best(where, ENV_WORDS) ?? best(all, ENV_WORDS);
  const environment: Sourced<Environment> = envHit
    ? { value: envHit.key, source: 'visitor', evidence: envHit.evidence }
    : { value: (['garden', 'field', 'void', 'bedroom'] as Environment[])[Math.floor(rnd() * 4)], source: 'inferred', reason: 'No place was described, so a setting was chosen to hold the feeling.' };

  // Time
  const timeHit = best(when, TIME_WORDS) ?? best(all, TIME_WORDS);
  const time: Sourced<TimeOfDay> = timeHit
    ? { value: timeHit.key, source: 'visitor', evidence: timeHit.evidence }
    : { value: input.mood === 'melancholic' || input.mood === 'uncertain' ? 'dusk' : input.mood === 'joyful' ? 'afternoon' : 'sunset', source: 'inferred', reason: 'Time of day was left open; the light was chosen from the mood.' };

  // Weather
  const wHit = best(all, WEATHER_WORDS);
  const weather: Sourced<Weather> = wHit && wHit.key !== 'clear'
    ? { value: wHit.key, source: 'visitor', evidence: wHit.evidence }
    : wHit ? { value: 'clear', source: 'visitor', evidence: wHit.evidence }
      : { value: input.mood === 'uncertain' || input.mood === 'strange' ? 'fog' : 'clear', source: 'inferred', reason: 'No weather was mentioned.' };

  // Mood
  const moodHit = best(feeling, MOOD_WORDS);
  const mood: Sourced<Mood> = input.mood
    ? { value: input.mood, source: 'visitor', evidence: 'chosen in the mood picker' }
    : moodHit ? { value: moodHit.key, source: 'visitor', evidence: moodHit.evidence }
      : { value: 'nostalgic', source: 'inferred', reason: 'No feeling was named; memories default to a soft nostalgia here.' };

  const childhood = /child|kid|young|little|school|grand|mother|father|mom|dad|age (\d)\b|years old/.test(all);
  const pal = choosePalette(mood.value, time.value, weather.value, childhood);

  // Objects
  const objects: MemoryObject[] = [];
  const seen = new Set<ObjectKind>();
  for (const kind of Object.keys(OBJECT_WORDS) as ObjectKind[]) {
    const ev = findWord(seeing, OBJECT_WORDS[kind]) ?? findWord(all, OBJECT_WORDS[kind]);
    if (ev && !seen.has(kind)) {
      seen.add(kind);
      objects.push({ value: kind, source: 'visitor', evidence: ev, label: OBJECT_LABELS[kind], note: quoteAround(input, ev) ?? `You mentioned “${ev}”.` });
    }
  }
  const visitorObjectCount = objects.length;
  for (const kind of ENV_DEFAULT_OBJECTS[environment.value]) {
    if (objects.length >= 6) break;
    if (seen.has(kind) && kind !== 'tree' && kind !== 'door' && kind !== 'streetlight') continue;
    seen.add(kind);
    objects.push({ value: kind, source: 'inferred', reason: `Placed because ${environment.value} spaces often hold one.`, label: OBJECT_LABELS[kind], note: 'Not from your description. Added to furnish the space.' });
  }

  // Sounds
  const soundList: Sourced<SoundKind>[] = [];
  const soundSeen = new Set<SoundKind>();
  for (const kind of Object.keys(SOUND_WORDS) as SoundKind[]) {
    const ev = findWord(sounds, SOUND_WORDS[kind]);
    if (ev) { soundSeen.add(kind); soundList.push({ value: kind, source: 'visitor', evidence: ev }); }
  }
  if (weather.value === 'rain' && !soundSeen.has('rain')) { soundSeen.add('rain'); soundList.push({ value: 'rain', source: 'inferred', reason: 'It was raining.' }); }
  if (!soundSeen.has(ENV_SOUNDS[environment.value])) soundList.push({ value: ENV_SOUNDS[environment.value], source: 'inferred', reason: `The usual sound of a ${environment.value}.` });
  if (time.value === 'night' && environment.value !== 'street' && !soundSeen.has('crickets')) soundList.push({ value: 'crickets', source: 'inferred', reason: 'Nights outdoors carry insects.' });

  // Unclear fragments
  const unclear = input.unclear.split(/[.,;\n]| and /).map((s) => s.trim()).filter((s) => s.length > 1).slice(0, 6);
  const uncertainty = Math.min(1, unclear.length * 0.15 + (mood.value === 'uncertain' ? 0.35 : 0) + (/forgot|can't|cannot|not sure|blur|vague/.test(all) ? 0.2 : 0));

  const atmosphere = {
    haze: clamp01(0.25 + uncertainty * 0.5 + (weather.value === 'fog' ? 0.35 : 0) + (weather.value === 'rain' ? 0.15 : 0)),
    dust: clamp01(0.35 + (mood.value === 'nostalgic' ? 0.3 : 0) + (time.value === 'afternoon' || time.value === 'sunset' ? 0.15 : 0)),
    clarity: clamp01(1 - uncertainty),
    warmth: clamp01({ dawn: 0.55, morning: 0.6, afternoon: 0.7, sunset: 0.9, dusk: 0.45, night: 0.25 }[time.value] + (mood.value === 'melancholic' ? -0.15 : 0) + (mood.value === 'joyful' ? 0.1 : 0)),
  };

  // Mode: a described place with things in it becomes a world; a feeling becomes an object.
  const placeStrength = (environment.source === 'visitor' ? 2 : 0) + visitorObjectCount;
  const feelingStrength = (input.feeling.trim().length > 0 ? 1 : 0) + unclear.length * 0.5 + (mood.value === 'strange' || mood.value === 'uncertain' ? 1 : 0);
  const mode: Sourced<VisualMode> = placeStrength >= 3 && placeStrength >= feelingStrength
    ? { value: 'world', source: 'inferred', reason: 'You described a place and things in it, so it became somewhere to walk through.' }
    : { value: 'object', source: 'inferred', reason: hasText(input) ? 'Your memory leans on feeling more than place, so it became an object to hold.' : 'With little description, the memory became an abstract form.' };

  const variant: SculptureVariant = uncertainty > 0.45 || weather.value === 'fog' ? 'fragments' : mood.value === 'joyful' || mood.value === 'strange' ? 'threads' : 'glass';

  return {
    version: 1,
    id: `m-${seed.toString(36)}-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    title: makeTitle(input, environment.value, time.value),
    input,
    environment, time, weather, mood,
    palette: { name: pal.name, colors: pal.colors, source: 'inferred', reason: `Colors chosen for ${pal.reason}.` },
    objects,
    sounds: soundList.slice(0, 4),
    atmosphere,
    emotionalTone: MOOD_TONES[mood.value],
    unclear,
    mode, variant, seed,
    interpreter: 'local',
  };
}

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

/** Return a short excerpt of the visitor's own text around a word. */
function quoteAround(input: MemoryInput, word: string): string | null {
  const fields = [input.seeing, input.what, input.where, input.sounds, input.feeling];
  for (const f of fields) {
    const i = f.toLowerCase().indexOf(word);
    if (i >= 0) {
      const start = Math.max(0, f.lastIndexOf(' ', Math.max(0, i - 28)));
      const endIdx = f.indexOf(' ', Math.min(f.length, i + word.length + 28));
      const end = endIdx < 0 ? f.length : endIdx;
      return `“${start > 0 ? '…' : ''}${f.slice(start, end).trim()}${end < f.length ? '…' : ''}”`;
    }
  }
  return null;
}
