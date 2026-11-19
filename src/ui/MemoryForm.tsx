import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MOODS, type MemoryInput, type Mood } from '../memory/types';
import { getApiKey, setApiKey } from '../lib/storage';
import { LLM_MODEL } from '../memory/llm';
import type { InterpretOptions } from '../App';

type Field = Exclude<keyof MemoryInput, 'mood' | 'moods' | 'moodOther'>;

const QUESTIONS: { key: Field; q: string; hint: string; placeholder: string }[] = [
  { key: 'what', q: 'What happened?', hint: 'Start anywhere. A sentence is enough.', placeholder: 'We stayed up late on the roof, waiting for the power to come back…' },
  { key: 'where', q: 'Where were you?', hint: 'A room, a street, a coast, somewhere you can no longer name.', placeholder: 'My grandmother’s kitchen, the one with the green tiles' },
  { key: 'when', q: 'What time of day was it?', hint: 'Or the season, or the light.', placeholder: 'Late afternoon, just before sunset' },
  { key: 'seeing', q: 'What do you remember seeing?', hint: 'Objects, colours, the shape of the light.', placeholder: 'A lamp with a yellow shade, a window, a cup of tea going cold' },
  { key: 'sounds', q: 'What sounds do you remember?', hint: 'Or the silence.', placeholder: 'Rain on the window, a radio somewhere, someone laughing' },
  { key: 'feeling', q: 'What did it feel like?', hint: 'In your body, or in the room.', placeholder: 'Safe, and a little sad, like I knew it would end' },
  { key: 'unclear', q: 'What is unclear, or forgotten?', hint: 'These gaps become part of the shape. Separate them with commas.', placeholder: 'Her face, what we were talking about, the year' },
];

const MOOD_NOTES: Record<Mood, string> = {
  nostalgic: 'Faded warmth', peaceful: 'Stillness', strange: 'Slightly wrong', joyful: 'Bright, open', melancholic: 'Soft weight', uncertain: 'Half-there',
};

export function MemoryForm({ initial, onSubmit, onBack }: { initial: MemoryInput; onSubmit: (i: MemoryInput, o: InterpretOptions) => void; onBack: () => void }) {
  const [data, setData] = useState<MemoryInput>(initial);
  const [step, setStep] = useState(0);
  const [useLLM, setUseLLM] = useState(false);
  const [key, setKey] = useState(getApiKey());
  const [consent, setConsent] = useState(false);
  const total = QUESTIONS.length + 2; // + mood + review
  const ta = useRef<HTMLTextAreaElement>(null);


  const next = () => setStep((s) => Math.min(total - 1, s + 1));
  const prev = () => (step === 0 ? onBack() : setStep((s) => s - 1));
  const answered = QUESTIONS.filter((q) => data[q.key].trim()).length;
  const canLLM = useLLM && key.trim().length > 10 && consent;

  function submit() {
    if (useLLM && canLLM) setApiKey(key.trim());
    onSubmit(data, { useLLM: canLLM, apiKey: key.trim() });
  }

  const chosen = data.moods ?? (data.mood ? [data.mood] : []);
  function toggleMood(m: Mood) {
    const moods = chosen.includes(m) ? chosen.filter((x) => x !== m) : [...chosen, m];
    setData({ ...data, moods, mood: moods[0] ?? null });
  }
  const moodSummary = [...chosen, ...(data.moodOther?.trim() ? [data.moodOther.trim()] : [])].map((m) => `“${m}”`).join(', ');

  const q = QUESTIONS[step];

  return (
    <section className="form" aria-label="Describe a memory">
      <header className="form-top">
        <button className="btn-link" onClick={prev}>← {step === 0 ? 'Leave' : 'Back'}</button>
        <div className="progress" aria-label={`Step ${step + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <button key={i} className={`dot ${i === step ? 'on' : ''} ${i < QUESTIONS.length && data[QUESTIONS[i].key].trim() ? 'filled' : ''}`}
              aria-label={`Go to step ${i + 1}`} onClick={() => setStep(i)} />
          ))}
        </div>
        <span className="meta">{String(step + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </header>

      <AnimatePresence mode="wait">
        <motion.div key={step} className="form-body"
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          {q && (
            <>
              <label className="q serif" htmlFor={`f-${q.key}`}>{q.q}</label>
              <p className="hint">{q.hint}</p>
              <textarea id={`f-${q.key}`} ref={ta} autoFocus rows={4} value={data[q.key]} placeholder={q.placeholder} maxLength={1200}
                onChange={(e) => setData({ ...data, [q.key]: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) next(); }} />
              <div className="form-actions">
                <button className="btn btn-quiet" onClick={() => { setData({ ...data, [q.key]: '' }); next(); }}>Skip</button>
                <button className="btn btn-primary" onClick={next}>{data[q.key].trim() ? 'Continue' : 'Continue without'}</button>
              </div>
              <p className="meta kbd-hint">Ctrl + Enter to continue</p>
            </>
          )}

          {step === QUESTIONS.length && (
            <>
              <p className="q serif" id="mood-label">If it had a weather of its own…</p>
              <p className="hint">Choose as many as it held, write your own, or leave it to the interpretation.</p>
              <div className="moods" role="group" aria-labelledby="mood-label">
                {MOODS.map((m) => {
                  const on = chosen.includes(m);
                  return (
                    <button key={m} aria-pressed={on} className={`mood mood-${m} ${on ? 'on' : ''}`} onClick={() => toggleMood(m)}>
                      <span className="mood-orb" aria-hidden="true" />
                      <span className="mood-name serif">{m}</span>
                      <span className="meta">{MOOD_NOTES[m]}</span>
                      {on && chosen.length > 1 && <span className="mood-order meta" aria-hidden="true">{chosen.indexOf(m) + 1}</span>}
                    </button>
                  );
                })}
                <label className={`mood mood-other ${data.moodOther?.trim() ? 'on' : ''}`}>
                  <span className="mood-orb" aria-hidden="true" />
                  <span className="mood-name serif">Other</span>
                  <input type="text" maxLength={60} value={data.moodOther ?? ''} placeholder="In your own words…"
                    aria-label="Another mood, in your own words"
                    onChange={(e) => setData({ ...data, moodOther: e.target.value })} />
                </label>
              </div>
              {chosen.length > 1 && <p className="meta mood-note">The first one leads; the others tint it.</p>}
              <div className="form-actions">
                <button className="btn btn-quiet" onClick={() => { setData({ ...data, mood: null, moods: [], moodOther: '' }); next(); }}>Skip</button>
                <button className="btn btn-primary" onClick={next}>Continue</button>
              </div>
            </>
          )}

          {step === QUESTIONS.length + 1 && (
            <>
              <p className="q serif">Ready to give it a shape?</p>
              <p className="hint">
                {answered === 0 && !chosen.length && !data.moodOther?.trim()
                  ? 'You left everything open. The shape will be almost entirely imagined, which is its own kind of memory.'
                  : `You answered ${answered} of ${QUESTIONS.length} questions${moodSummary ? ` and chose ${moodSummary}` : ''}. Anything you skipped will be filled in by interpretation, and marked as such.`}
              </p>

              <fieldset className="interp">
                <legend className="meta">Interpreter</legend>
                <label className="radio">
                  <input type="radio" name="interp" checked={!useLLM} onChange={() => setUseLLM(false)} />
                  <span><strong>On this device</strong> · private, works offline. Your words never leave the browser.</span>
                </label>
                <label className="radio">
                  <input type="radio" name="interp" checked={useLLM} onChange={() => setUseLLM(true)} />
                  <span><strong>Language model</strong> · optional, more nuanced. Uses your own Anthropic API key.</span>
                </label>
                {useLLM && (
                  <div className="llm-opts">
                    <label className="meta" htmlFor="apikey">Anthropic API key (kept for this tab only)</label>
                    <input id="apikey" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
                    <label className="check">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span>I agree to send this description to Anthropic ({LLM_MODEL}) to be interpreted. It is not stored by this site.</span>
                    </label>
                    {!canLLM && <p className="meta warn">Needs a key and your consent, otherwise the private interpreter is used.</p>}
                  </div>
                )}
              </fieldset>

              <div className="form-actions">
                <button className="btn btn-quiet" onClick={() => setStep(0)}>Review answers</button>
                <button className="btn btn-primary" onClick={submit}>Interpret this memory</button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
