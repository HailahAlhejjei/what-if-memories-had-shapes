// Optional LLM refinement. Only runs when the visitor supplies their own API key AND
// explicitly consents to sending their description. The local profile is always computed
// first; the LLM can only choose among the same fixed vocabularies, and any "visitor"
// claim must quote text that really appears in the description, or it is downgraded.

import { interpretLocally } from './interpret';
import { choosePalette } from './palettes';
import {
  ENVIRONMENTS, MOODS, OBJECT_KINDS, SOUND_KINDS, TIMES, WEATHERS,
  type MemoryInput, type MemoryProfile, type MemoryObject, type Sourced,
} from './types';

export const LLM_MODEL = 'claude-sonnet-5-5';

const SYSTEM = `You interpret a personal memory for an art installation. You never invent facts about the memory.
Return ONLY JSON with this shape:
{"environment":{"value":ENV,"evidence":"exact quote or null"},
 "time":{"value":TIME,"evidence":"exact quote or null"},
 "weather":{"value":WEATHER,"evidence":"exact quote or null"},
 "mood":{"value":MOOD,"evidence":"exact quote or null"},
 "objects":[{"value":OBJECT,"evidence":"exact quote or null","note":"one short poetic line about it"}],
 "sounds":[{"value":SOUND,"evidence":"exact quote or null"}],
 "emotionalTone":"one sentence, no more than 16 words",
 "title":"a short title of at most 7 words"}
ENV one of ${ENVIRONMENTS.join('|')}; TIME one of ${TIMES.join('|')}; WEATHER one of ${WEATHERS.join('|')};
MOOD one of ${MOODS.join('|')}; OBJECT one of ${OBJECT_KINDS.join('|')}; SOUND one of ${SOUND_KINDS.join('|')}.
"evidence" must be a short exact substring of the visitor's text when the value comes from it, else null. At most 6 objects and 4 sounds.`;

function inText(input: MemoryInput, ev: unknown): string | null {
  if (typeof ev !== 'string' || ev.trim().length < 2) return null;
  const hay = Object.values(input).filter((v) => typeof v === 'string').join(' \n ').toLowerCase();
  return hay.includes(ev.toLowerCase().trim()) ? ev.trim() : null;
}

function pick<T extends string>(raw: any, allowed: readonly T[], input: MemoryInput, fallback: Sourced<T>): Sourced<T> {
  if (!raw || !allowed.includes(raw.value)) return fallback;
  const ev = inText(input, raw.evidence);
  return ev ? { value: raw.value, source: 'visitor', evidence: ev } : { value: raw.value, source: 'inferred', reason: 'Suggested by the language model as a fitting setting.' };
}

export async function interpretWithLLM(input: MemoryInput, apiKey: string, signal?: AbortSignal): Promise<MemoryProfile> {
  const local = interpretLocally(input);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    }),
  });
  if (!res.ok) throw new Error(`Interpretation service returned ${res.status}`);
  const data = await res.json();
  const text: string = data?.content?.find((c: any) => c.type === 'text')?.text ?? '';
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

  const objects: MemoryObject[] = Array.isArray(json.objects)
    ? json.objects.filter((o: any) => OBJECT_KINDS.includes(o?.value)).slice(0, 6).map((o: any) => {
      const ev = inText(input, o.evidence);
      const base = local.objects.find((l) => l.value === o.value);
      return {
        value: o.value,
        source: ev ? 'visitor' : 'inferred',
        evidence: ev ?? undefined,
        reason: ev ? undefined : 'Added by interpretation to furnish the space.',
        label: base?.label ?? o.value,
        note: typeof o.note === 'string' ? o.note.slice(0, 140) : base?.note ?? '',
      } as MemoryObject;
    })
    : local.objects;

  const sounds = Array.isArray(json.sounds)
    ? json.sounds.filter((s: any) => SOUND_KINDS.includes(s?.value)).slice(0, 4).map((s: any) => pick(s, SOUND_KINDS, input, local.sounds[0]))
    : local.sounds;

  const environment = pick(json.environment, ENVIRONMENTS, input, local.environment);
  const time = pick(json.time, TIMES, input, local.time);
  const weather = pick(json.weather, WEATHERS, input, local.weather);
  const mood = input.mood ? local.mood : pick(json.mood, MOODS, input, local.mood);
  const pal = choosePalette(mood.value, time.value, weather.value, /child|school|grand/i.test(JSON.stringify(input)));
  return {
    ...local,
    environment, time, weather, mood,
    palette: { name: pal.name, colors: pal.colors, source: 'inferred', reason: `Colors chosen for ${pal.reason}.` },
    objects: objects.length ? objects : local.objects,
    sounds: sounds.length ? sounds : local.sounds,
    emotionalTone: typeof json.emotionalTone === 'string' ? json.emotionalTone.slice(0, 160) : local.emotionalTone,
    title: typeof json.title === 'string' && json.title.trim() ? json.title.slice(0, 60) : local.title,
    interpreter: 'llm',
  };
}
