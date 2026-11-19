// MODE 1: THE WORLD. Environment templates + procedural layout of the memory's objects.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Environment, MemoryProfile } from '../../memory/types';
import { mulberry32 } from '../../memory/interpret';
import { mix } from '../../memory/palettes';
import { OBJECT_SIZE, OBJECT_TEMPLATES, WALL_OBJECTS } from './objects';
import { Dust, LightRig, Rain, SceneBackdrop, Sky, useLook, type SceneSettings } from '../shared';
import type { Selection } from '../MemoryCanvas';

const INTERIOR = new Set<Environment>(['bedroom', 'kitchen', 'corridor']);

// ---------- Terrain (procedural, vertex-displaced) ----------
function Terrain({ color, color2, roughness, amp, seed, size = 60, shore = false }: { color: string; color2: string; roughness: number; amp: number; seed: number; size?: number; shore?: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, 128, 128);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(p.count * 3);
    const c1 = new THREE.Color(color), c2 = new THREE.Color(color2), tmp = new THREE.Color();
    const o = (seed % 1000) / 37;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      const n = Math.sin(x * 0.18 + o) * Math.cos(z * 0.21 - o) + Math.sin(x * 0.5 + z * 0.4) * 0.3 + Math.sin(x * 1.7 - z * 1.3) * 0.06;
      const flat = THREE.MathUtils.smoothstep(d, 5, 14); // keep the centre walkable
      p.setY(i, n * amp * flat - (shore ? Math.max(0, -z - 2.5) * 0.18 : 0));
      tmp.copy(c1).lerp(c2, THREE.MathUtils.clamp(n * 0.5 + 0.5, 0, 1) * 0.6);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [color, color2, amp, seed, size, shore]);
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors roughness={roughness} /></mesh>;
}

// ---------- Grass (instanced) ----------
function Grass({ count, color, reducedMotion }: { count: number; color: string; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => { const g = new THREE.ConeGeometry(0.025, 0.4, 3); g.translate(0, 0.2, 0); return g; }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = { value: 0 };
      m.userData.shader = s;
      s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
        transformed.x += sin(uTime*1.3 + wp.x*0.7 + wp.z*0.5) * 0.06 * position.y * 2.5;`);
    };
    return m;
  }, [color]);
  useLayoutEffect(() => {
    {
      if (!ref.current) return;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, d = 1.5 + Math.sqrt(Math.random()) * 13;
        v.set(Math.cos(a) * d, 0, Math.sin(a) * d);
        q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.3, Math.random() * 3, (Math.random() - 0.5) * 0.3));
        const k = 0.6 + Math.random() * 0.9; s.set(k, k, k);
        ref.current.setMatrixAt(i, m.compose(v, q, s));
      }
      ref.current.instanceMatrix.needsUpdate = true;
    }
  }, [count]);
  useFrame((_, dt) => { const sh = mat.userData.shader; if (sh && !reducedMotion) sh.uniforms.uTime.value += dt; });
  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}

// ---------- Water ----------
const waterVert = /* glsl */ `uniform float uTime; varying vec2 vUv; varying float vH;
void main(){ vUv=uv; vec3 p=position; float h=sin(p.x*0.4+uTime*0.6)*0.08+sin(p.y*0.7+uTime*0.9)*0.05; p.z+=h; vH=h;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
const waterFrag = /* glsl */ `uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uGlint; uniform float uTime; varying vec2 vUv; varying float vH;
void main(){ float shore=smoothstep(0.0,0.18,vUv.y); vec3 c=mix(uShallow,uDeep,shore);
 float foam=smoothstep(0.04,0.0,abs(vUv.y-0.02-sin(vUv.x*40.+uTime)*0.006)); c=mix(c,vec3(0.96,0.94,0.9),foam*0.7);
 c+=uGlint*smoothstep(0.08,0.13,vH)*0.4; gl_FragColor=vec4(c,0.94); }`;

function Water({ deep, shallow, glint, reducedMotion }: { deep: string; shallow: string; glint: string; reducedMotion: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uGlint: { value: new THREE.Color(glint) } }), [deep, shallow, glint]);
  useFrame((_, dt) => { if (!reducedMotion && mat.current) mat.current.uniforms.uTime.value += dt; });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -24]}>
      <planeGeometry args={[80, 40, 120, 60]} />
      <shaderMaterial ref={mat} transparent uniforms={uniforms} vertexShader={waterVert} fragmentShader={waterFrag} />
    </mesh>
  );
}

// ---------- Environment templates ----------
function Room({ look, corridor }: { look: ReturnType<typeof useLook>; corridor: boolean }) {
  const w = corridor ? 4 : 8, d = corridor ? 22 : 8, h = 3.4;
  const wall = mix(look.light, look.bottom, 0.45), floor = mix(look.ground, look.accent2, 0.3);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial color={floor} roughness={0.7} /></mesh>
      <mesh position={[0, h / 2, -d / 2]} receiveShadow><planeGeometry args={[w, h]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[d, h]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><planeGeometry args={[d, h]} /><meshStandardMaterial color={mix(wall, look.top, 0.1)} roughness={0.95} /></mesh>
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color={mix(wall, '#000000', 0.15)} side={THREE.DoubleSide} /></mesh>
      {/* A rug: soft, rounded, slightly worn */}
      {!corridor && <RoundedBox args={[3.4, 0.02, 2.4]} radius={0.01} position={[0.5, 0.011, 0.6]} receiveShadow><meshStandardMaterial color={look.accent} roughness={1} /></RoundedBox>}
      {corridor && Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, h - 0.02, -d / 2 + 2 + i * 4.4]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.9, 0.3]} /><meshBasicMaterial color={look.light} toneMapped={false} /></mesh>
      ))}
    </group>
  );
}

function Street({ look, seed }: { look: ReturnType<typeof useLook>; seed: number }) {
  const r = mulberry32(seed + 3);
  const blocks = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const side = i % 2 ? 1 : -1; const z = -18 + Math.floor(i / 2) * 5.5;
    return { x: side * (5.5 + r() * 1.5), z, w: 3 + r() * 1.5, h: 3 + r() * 7, d: 4 + r() * 1, tone: r(), lit: r() };
  }), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[60, 60]} /><meshStandardMaterial color={mix(look.ground, '#29272B', 0.35)} roughness={0.55} metalness={0.1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow><planeGeometry args={[6, 60]} /><meshStandardMaterial color={mix(look.ground, '#29272B', 0.6)} roughness={0.35} metalness={0.2} /></mesh>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -26 + i * 4.5]}><planeGeometry args={[0.12, 1.6]} /><meshBasicMaterial color={look.light} transparent opacity={0.5} /></mesh>)}
      {blocks.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, b.z]}>
          <RoundedBox args={[b.w, b.h, b.d]} radius={0.25} castShadow receiveShadow><meshStandardMaterial color={mix(look.bottom, look.top, b.tone * 0.6)} roughness={0.9} /></RoundedBox>
          {b.lit > 0.4 && <mesh position={[-Math.sign(b.x) * (b.w / 2 + 0.01), -b.h / 2 + 1.6 + b.lit * 2, 0]} rotation={[0, -Math.sign(b.x) * Math.PI / 2, 0]}><planeGeometry args={[1.2, 0.8]} /><meshBasicMaterial color={look.accent} toneMapped={false} transparent opacity={0.85} /></mesh>}
        </group>
      ))}
    </group>
  );
}

function Ground({ profile, settings, look }: { profile: MemoryProfile; settings: SceneSettings; look: ReturnType<typeof useLook> }) {
  const env = profile.environment.value;
  if (env === 'bedroom' || env === 'kitchen' || env === 'corridor') return <Room look={look} corridor={env === 'corridor'} />;
  if (env === 'street') return <Street look={look} seed={profile.seed} />;
  if (env === 'beach') return (
    <group>
      <Terrain color={mix(look.light, '#D6A66A', 0.4)} color2={look.ground} roughness={1} amp={0.6} seed={profile.seed} shore />
      <Water deep={mix(look.top, '#1d2a38', 0.4)} shallow={mix(look.accent, look.light, 0.4)} glint={look.light} reducedMotion={settings.reducedMotion} />
    </group>
  );
  if (env === 'void') return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow><cylinderGeometry args={[7, 5.5, 0.5, 96]} /><meshPhysicalMaterial color={look.ground} roughness={0.4} clearcoat={0.6} /></mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 0.7) * (10 + i), -1 + Math.sin(i * 1.3) * 3, Math.sin(i * 0.7) * (10 + i)]} scale={0.6 + (i % 3) * 0.5}>
          <icosahedronGeometry args={[1, 1]} /><meshPhysicalMaterial color={look.accent} roughness={0.2} transmission={0.6} thickness={1} transparent opacity={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
  // garden, field, forest
  const grassy = mix(look.ground, '#7f9a6c', env === 'field' ? 0.2 : 0.45);
  return (
    <group>
      <Terrain color={grassy} color2={mix(grassy, look.accent2, 0.5)} roughness={1} amp={env === 'field' ? 2.2 : 1.2} seed={profile.seed} />
      <Grass count={settings.quality === 'high' ? 9000 : 2500} color={mix(grassy, look.light, 0.15)} reducedMotion={settings.reducedMotion} />
    </group>
  );
}

// ---------- Layout ----------
interface Placed { i: number; pos: [number, number, number]; rot: number }

function layout(profile: MemoryProfile): Placed[] {
  const r = mulberry32(profile.seed);
  const env = profile.environment.value;
  const interior = INTERIOR.has(env);
  const corridor = env === 'corridor';
  const placed: { p: THREE.Vector2; s: number }[] = [];
  let wallX = corridor ? -1.9 : -2.8;
  return profile.objects.map((o, i) => {
    const size = OBJECT_SIZE[o.value];
    if (interior && WALL_OBJECTS.has(o.value)) {
      if (corridor) { const z = -9 + i * 3.6; const side = i % 2 ? 1 : -1; return { i, pos: [side * 1.98, 0, z], rot: -side * Math.PI / 2 }; }
      const x = wallX; wallX += 1.9;
      return { i, pos: [x, 0, -3.92], rot: 0 };
    }
    for (let tries = 0; tries < 60; tries++) {
      const a = r() * Math.PI * 2;
      const dist = interior ? (corridor ? 0 : 0.8 + r() * 2.2) : 2 + r() * (env === 'street' ? 3 : 6);
      let x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      if (corridor) { x = (r() - 0.5) * 2.4; z = -8 + r() * 14; }
      if (env === 'street') { x = (r() > 0.5 ? 1 : -1) * (3.4 + r() * 0.6); z = -8 + r() * 12; }
      if (env === 'beach') z = Math.min(z, 1.5);
      const p = new THREE.Vector2(x, z);
      if (placed.every((q) => q.p.distanceTo(p) > q.s + size + 0.2) && p.length() > 0.8) {
        placed.push({ p, s: size });
        const face = Math.atan2(-x, -z + 6); // roughly face the camera
        return { i, pos: [x, 0, z], rot: interior ? face : r() * Math.PI * 2 };
      }
    }
    return { i, pos: [(i - 2) * 2, 0, -2], rot: 0 };
  });
}

// ---------- Forgotten fragments: frosted glass panes for what the visitor couldn't recall ----------
function Gap({ text, index, onSelect, selected, color, reducedMotion }: { text: string; index: number; onSelect: (s: Selection) => void; selected: boolean; color: string; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const base = useMemo(() => new THREE.Vector3(Math.cos(index * 2.3) * (2.5 + index * 0.6), 1.6 + (index % 3) * 0.5, Math.sin(index * 2.3) * (2.2 + index * 0.4) - 0.5), [index]);
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.elapsedTime;
    ref.current.position.set(base.x, base.y + Math.sin(t * 0.6 + index) * 0.15, base.z);
    ref.current.rotation.y = t * 0.15 + index;
  });
  return (
    <mesh ref={ref} position={base} onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'gap', index }); }} scale={selected ? 1.15 : 1}
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}
      userData={{ text }}>
      <planeGeometry args={[0.9, 1.2]} />
      <meshPhysicalMaterial color={color} roughness={0.85} transmission={0.9} thickness={0.4} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------- Selectable object wrapper ----------
function Selectable({ children, onClick, selected, position, rotation }: { children: ReactNode; onClick: () => void; selected: boolean; position: [number, number, number]; rotation: number }) {
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (!g.current) return;
    const target = selected ? 1.06 : hover ? 1.03 : 1;
    g.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, dt * 8));
  });
  return (
    <group ref={g} position={position} rotation={[0, rotation, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
      {children}
      {(selected || hover) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.7, 0.76, 64]} />
          <meshBasicMaterial color="#F4EFE6" transparent opacity={selected ? 0.8 : 0.35} />
        </mesh>
      )}
    </group>
  );
}

export function WorldScene({ profile, settings, selection, onSelect }: { profile: MemoryProfile; settings: SceneSettings; selection: Selection | null; onSelect: (s: Selection | null) => void }) {
  const look = useLook(profile);
  const placed = useMemo(() => layout(profile), [profile]);
  const env = profile.environment.value;
  const interior = INTERIOR.has(env);
  const fogDensity = (interior ? 0.012 : 0.03) + profile.atmosphere.haze * (interior ? 0.03 : 0.06);

  return (
    <group onPointerMissed={() => onSelect(null)}>
      <SceneBackdrop color={look.fogColor} fog={{ type: 'exp2', density: fogDensity }} />
      <Sky top={look.top} bottom={look.bottom} glow={look.glow} sunDir={look.sunDir} haze={profile.atmosphere.haze} />
      <LightRig profile={profile} settings={settings} />
      <Ground profile={profile} settings={settings} look={look} />

      {placed.map(({ i, pos, rot }) => {
        const o = profile.objects[i];
        const T = OBJECT_TEMPLATES[o.value];
        const c = i % 2 ? look.accent : mix(look.accent2, look.light, 0.2);
        return (
          <Selectable key={i} position={pos} rotation={rot} selected={selection?.kind === 'object' && selection.index === i} onClick={() => onSelect({ kind: 'object', index: i })}>
            <T c={c} c2={mix(look.ground, look.accent, 0.35)} glow={look.light} inferred={o.source === 'inferred'} />
          </Selectable>
        );
      })}

      {profile.unclear.map((t, i) => (
        <Gap key={i} text={t} index={i} onSelect={onSelect} selected={selection?.kind === 'gap' && selection.index === i} color={look.light} reducedMotion={settings.reducedMotion} />
      ))}

      <Dust count={Math.round((settings.quality === 'high' ? 900 : 300) * (0.4 + profile.atmosphere.dust))} color={look.light} radius={interior ? 4 : 12} height={interior ? 3.2 : 6} seed={profile.seed} reducedMotion={settings.reducedMotion} />
      {profile.weather.value === 'rain' && !interior && <Rain count={settings.quality === 'high' ? 2400 : 800} color={look.light} reducedMotion={settings.reducedMotion} />}
      {profile.weather.value === 'snow' && <Dust count={settings.quality === 'high' ? 1500 : 500} color="#ffffff" radius={14} height={9} seed={profile.seed + 99} reducedMotion={settings.reducedMotion} />}
    </group>
  );
}

export const WORLD_CAMERA: Record<Environment, { pos: [number, number, number]; target: [number, number, number] }> = {
  bedroom: { pos: [2.6, 2.0, 5.6], target: [0, 0.9, -0.5] },
  kitchen: { pos: [2.6, 2.0, 5.6], target: [0, 0.9, -0.5] },
  corridor: { pos: [0.4, 1.7, 9.5], target: [0, 1.4, 0] },
  street: { pos: [1.5, 1.8, 10], target: [0, 1.4, 0] },
  garden: { pos: [5, 2.6, 8], target: [0, 0.8, 0] },
  field: { pos: [5, 2.6, 9], target: [0, 0.8, 0] },
  forest: { pos: [5, 2.6, 8], target: [0, 1, 0] },
  beach: { pos: [4, 2.4, 8], target: [0, 0.6, -2] },
  void: { pos: [6, 3.4, 8], target: [0, 0.6, 0] },
};
