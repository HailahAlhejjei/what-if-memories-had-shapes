// The structured memory profile: the single input to the generation system.

export const MOODS = ['nostalgic', 'peaceful', 'strange', 'joyful', 'melancholic', 'uncertain'] as const;
export type Mood = (typeof MOODS)[number];

export const ENVIRONMENTS = ['bedroom', 'kitchen', 'street', 'garden', 'corridor', 'beach', 'field', 'forest', 'void'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const TIMES = ['dawn', 'morning', 'afternoon', 'sunset', 'dusk', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];

export const WEATHERS = ['clear', 'rain', 'fog', 'snow', 'wind'] as const;
export type Weather = (typeof WEATHERS)[number];

export const OBJECT_KINDS = [
  'lamp', 'bed', 'window', 'tree', 'flower', 'bench', 'door', 'chair', 'table', 'book',
  'swing', 'umbrella', 'shell', 'boat', 'streetlight', 'car', 'piano', 'clock', 'cup', 'stone',
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const SOUND_KINDS = ['rain', 'wind', 'waves', 'birds', 'city', 'crickets', 'hum', 'clock', 'music', 'voices'] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

export type Source = 'visitor' | 'inferred';

/** Every interpreted value records where it came from. */
export interface Sourced<T> {
  value: T;
  source: Source;
  /** The visitor's own words that triggered this, when source is 'visitor'. */
  evidence?: string;
  /** Why the system chose this, when source is 'inferred'. */
  reason?: string;
}

export interface MemoryInput {
  what: string;
  where: string;
  when: string;
  seeing: string;
  sounds: string;
  feeling: string;
  unclear: string;
  /** The first chosen mood (kept for older saved memories). */
  mood: Mood | null;
  /** Every mood chosen, in the order picked. */
  moods?: Mood[];
  /** The visitor's own word for the feeling, when none of the moods fit. */
  moodOther?: string;
}

export type VisualMode = 'world' | 'object' | 'painting';
export type SculptureVariant = 'glass' | 'fragments' | 'threads';

export interface MemoryObject extends Sourced<ObjectKind> {
  label: string;
  note: string;
}

export interface MemoryProfile {
  version: 1;
  id: string;
  createdAt: string;
  title: string;
  input: MemoryInput;
  environment: Sourced<Environment>;
  time: Sourced<TimeOfDay>;
  weather: Sourced<Weather>;
  mood: Sourced<Mood>;
  /** Further moods the visitor chose alongside the main one. */
  secondaryMoods?: Mood[];
  /** The visitor's own word(s) for the feeling. */
  moodWords?: string;
  palette: { name: string; colors: string[]; source: Source; reason: string };
  objects: MemoryObject[];
  sounds: Sourced<SoundKind>[];
  atmosphere: {
    /** 0..1, how foggy / hazy */
    haze: number;
    /** 0..1, how many particles */
    dust: number;
    /** 0..1, how sharp/certain the memory feels; low = more distortion */
    clarity: number;
    /** 0..1, warmth of light */
    warmth: number;
  };
  emotionalTone: string;
  /** Fragments the visitor marked as unclear or forgotten. Rendered as blurred / missing. */
  unclear: string[];
  mode: Sourced<VisualMode>;
  variant: SculptureVariant;
  seed: number;
  interpreter: 'local' | 'llm';
}

export const EMPTY_INPUT: MemoryInput = {
  what: '', where: '', when: '', seeing: '', sounds: '', feeling: '', unclear: '', mood: null, moods: [], moodOther: '',
};
