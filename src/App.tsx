import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Intro } from './ui/Intro';
import { MemoryForm } from './ui/MemoryForm';
import { Interpretation } from './ui/Interpretation';
import { Result } from './ui/Result';
import { Loading } from './ui/Loading';
import { Atmosphere } from './ui/Atmosphere';
import { EMPTY_INPUT, type MemoryInput, type MemoryProfile } from './memory/types';
import { interpretLocally } from './memory/interpret';
import { interpretWithLLM } from './memory/llm';
import { readSharedFromHash } from './lib/share';
import { prefersReducedMotion } from './lib/capability';

type Stage = 'intro' | 'form' | 'interpreting' | 'interpretation' | 'result';

export interface InterpretOptions { useLLM: boolean; apiKey: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [stage, setStage] = useState<Stage>('intro');
  const [input, setInput] = useState<MemoryInput>(EMPTY_INPUT);
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const reduced = useRef(prefersReducedMotion()).current;

  // Open a shared link directly in the result view.
  useEffect(() => {
    const p = readSharedFromHash();
    if (p) { setProfile(p); setInput(p.input); setShared(true); setStage('result'); }
  }, []);

  async function interpret(next: MemoryInput, opts: InterpretOptions) {
    setInput(next);
    setStage('interpreting');
    setNotice(null);
    const started = performance.now();
    let p: MemoryProfile;
    try {
      p = opts.useLLM && opts.apiKey ? await interpretWithLLM(next, opts.apiKey) : interpretLocally(next);
    } catch (e) {
      p = interpretLocally(next);
      setNotice(`The online interpreter was unavailable (${(e as Error).message}). The local interpreter was used instead; nothing else was sent.`);
    }
    // Keep a short, deliberate pause so the transition reads as a moment rather than a flicker.
    const minimum = reduced ? 300 : 1900;
    const elapsed = performance.now() - started;
    if (elapsed < minimum) await wait(minimum - elapsed);
    setProfile(p);
    setStage('interpretation');
  }

  function openSaved(p: MemoryProfile) { setProfile(p); setInput(p.input); setShared(false); setStage('result'); }

  function startOver() {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setShared(false); setProfile(null); setInput(EMPTY_INPUT); setStage('form');
  }

  return (
    <MotionConfig reducedMotion="user">
      {stage !== 'result' && <Atmosphere tint={profile?.palette.colors} />}
      <AnimatePresence mode="wait">
        <motion.main
          key={stage}
          className={`stage stage-${stage}`}
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: reduced ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {stage === 'intro' && <Intro onBegin={() => setStage('form')} onOpenSaved={openSaved} />}
          {stage === 'form' && <MemoryForm initial={input} onSubmit={interpret} onBack={() => setStage('intro')} />}
          {stage === 'interpreting' && <Loading />}
          {stage === 'interpretation' && profile && (
            <Interpretation profile={profile} notice={notice} onGenerate={() => setStage('result')} onEdit={() => setStage('form')} />
          )}
          {stage === 'result' && profile && (
            <Result profile={profile} shared={shared} onEdit={() => { setShared(false); setStage('form'); }} onNew={startOver}
              onUpdate={setProfile} />
          )}
        </motion.main>
      </AnimatePresence>
    </MotionConfig>
  );
}
