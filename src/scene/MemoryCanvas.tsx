// The 3D entry point. The UI only talks to this component through props; it knows nothing about Three.js.
import { Suspense, forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { MemoryProfile, SculptureVariant, VisualMode } from '../memory/types';
import { WorldScene, WORLD_CAMERA } from './world/WorldScene';
import { ObjectScene, type MaterialStyle } from './object/ObjectScene';
import { useLook, type SceneSettings } from './shared';

export type Selection = { kind: 'object' | 'gap'; index: number };

export interface CanvasHandle { capture: () => string | null; resetView: () => void }

interface Props {
  profile: MemoryProfile;
  mode: VisualMode;
  variant: SculptureVariant;
  material: MaterialStyle;
  settings: SceneSettings;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  resetKey: number;
}

/** Cinematic intro: the camera drifts in from further away, then hands control to the visitor. */
function CameraRig({ mode, profile, reducedMotion, resetKey, controls }: { mode: VisualMode; profile: MemoryProfile; reducedMotion: boolean; resetKey: number; controls: RefObject<OrbitControlsImpl> }) {
  const { camera } = useThree();
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    const preset = mode === 'world' ? WORLD_CAMERA[profile.environment.value] : { pos: [3.2, 1.2, 4.6] as [number, number, number], target: [0, 0.1, 0] as [number, number, number] };
    const to = new THREE.Vector3(...preset.pos);
    const target = new THREE.Vector3(...preset.target);
    const from = to.clone().sub(target).multiplyScalar(1.9).add(target).add(new THREE.Vector3(0, 1.5, 0));
    if (controls.current) controls.current.target.copy(target);
    if (reducedMotion) { camera.position.copy(to); camera.lookAt(target); anim.current = null; }
    else { camera.position.copy(from); anim.current = { from, to, target, t: 0 }; }
  }, [mode, profile, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const a = anim.current; if (!a) return;
    a.t = Math.min(1, a.t + dt / 3.2);
    const e = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.from, a.to, e);
    camera.lookAt(a.target);
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** WASD / arrow keys move through the world by sliding both the camera and orbit target. */
function KeyboardWalk({ controls, enabled, bounds }: { controls: RefObject<OrbitControlsImpl>; enabled: boolean; bounds: number }) {
  const keys = useRef<Set<string>>(new Set());
  const { camera } = useThree();
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); keys.current.clear(); };
  }, [enabled]);
  useFrame((_, dt) => {
    const k = keys.current; const c = controls.current; if (!enabled || !c || k.size === 0) return;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const move = new THREE.Vector3();
    if (k.has('w') || k.has('arrowup')) move.add(fwd);
    if (k.has('s') || k.has('arrowdown')) move.sub(fwd);
    if (k.has('d') || k.has('arrowright')) move.add(right);
    if (k.has('a') || k.has('arrowleft')) move.sub(right);
    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(dt * 2.6);
    const next = c.target.clone().add(move);
    if (Math.hypot(next.x, next.z) > bounds) return;
    c.target.add(move); camera.position.add(move); c.update();
  });
  return null;
}

/** Local studio lighting for reflections; no HDR downloads. */
function Studio({ profile }: { profile: MemoryProfile }) {
  const look = useLook(profile);
  return (
    <Environment resolution={128} frames={1}>
      <color attach="background" args={[look.bottom]} />
      <Lightformer intensity={2} color={look.light} position={[0, 5, -4]} scale={[10, 3, 1]} />
      <Lightformer intensity={1.2} color={look.accent} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} />
      <Lightformer intensity={0.9} color={look.accent2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} />
      <Lightformer form="ring" intensity={1.5} color={look.light} position={[0, 2, 5]} scale={2} />
    </Environment>
  );
}

export const MemoryCanvas = forwardRef<CanvasHandle, Props>(function MemoryCanvas(props, ref) {
  const { profile, mode, variant, material, settings, selection, onSelect, resetKey } = props;
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const interior = ['bedroom', 'kitchen', 'corridor'].includes(profile.environment.value);

  useImperativeHandle(ref, () => ({
    capture: () => { try { return glRef.current?.domElement.toDataURL('image/png') ?? null; } catch { return null; } },
    resetView: () => { /* handled by resetKey */ },
  }));

  return (
    <Canvas
      shadows={settings.quality === 'high'}
      dpr={settings.quality === 'high' ? [1, 1.75] : [1, 1.25]}
      gl={{ preserveDrawingBuffer: true, antialias: settings.quality === 'high', powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      camera={{ fov: mode === 'world' ? 55 : 40, near: 0.05, far: 200, position: [4, 3, 8] }}
      onCreated={({ gl }) => { glRef.current = gl; gl.toneMappingExposure = 0.92; }}
      aria-label={`3D ${mode === 'world' ? 'world' : 'sculpture'} for the memory “${profile.title}”`}
    >
      <Suspense fallback={null}>
        <Studio profile={profile} />
        {mode === 'world'
          ? <WorldScene profile={profile} settings={settings} selection={selection} onSelect={onSelect} />
          : <ObjectScene profile={profile} settings={settings} variant={variant} style={material} selection={selection} onSelect={onSelect} />}
      </Suspense>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={mode === 'world'}
        minDistance={mode === 'world' ? 1.2 : 2.2}
        maxDistance={mode === 'world' ? (interior ? 8 : 18) : 10}
        maxPolarAngle={mode === 'world' ? Math.PI * 0.49 : Math.PI * 0.85}
        autoRotate={mode === 'object' && !settings.reducedMotion && !selection}
        autoRotateSpeed={0.4}
      />
      <CameraRig mode={mode} profile={profile} reducedMotion={settings.reducedMotion} resetKey={resetKey} controls={controls} />
      <KeyboardWalk controls={controls} enabled={mode === 'world'} bounds={interior ? (profile.environment.value === 'corridor' ? 11 : 3.5) : 14} />
    </Canvas>
  );
});
