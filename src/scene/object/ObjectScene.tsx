// MODE 2: THE OBJECT. An abstract sculpture whose form is driven by the memory profile.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { MemoryProfile, SculptureVariant } from '../../memory/types';
import { mulberry32 } from '../../memory/interpret';
import { mix } from '../../memory/palettes';
import { Dust, SceneBackdrop, useLook, type SceneSettings } from '../shared';
import type { Selection } from '../MemoryCanvas';

export type MaterialStyle = 'glass' | 'pearl' | 'clay' | 'chrome';

// ---------- The core: noise-displaced form with a fresnel / iridescent shader ----------
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){ const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
 vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy); vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
 i=mod289(i); vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }`;

const coreVert = /* glsl */ `${NOISE}
uniform float uTime; uniform float uAmp; uniform float uFreq;
varying vec3 vN; varying vec3 vView; varying float vD;
float disp(vec3 p){ return snoise(p*uFreq + uTime*0.12)*uAmp + snoise(p*uFreq*2.3 - uTime*0.08)*uAmp*0.35; }
void main(){
  vec3 p = position; vec3 n = normalize(normal);
  float d = disp(p); vD = d;
  vec3 displaced = p + n*d;
  // numerical normal
  vec3 t = normalize(cross(n, vec3(0.0,1.0,0.1))); vec3 b = normalize(cross(n, t)); float e = 0.01;
  vec3 pt = p + t*e; pt += normalize(pt)*disp(pt); vec3 pb = p + b*e; pb += normalize(pb)*disp(pb);
  vec3 nn = normalize(cross(pt - displaced, pb - displaced));
  vN = normalize(normalMatrix * nn);
  vec4 mv = modelViewMatrix * vec4(displaced,1.0); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const coreFrag = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uLight; uniform float uClarity;
varying vec3 vN; varying vec3 vView; varying float vD;
void main(){
  float f = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.2);
  vec3 base = mix(uA, uB, smoothstep(-0.3, 0.3, vD));
  vec3 iri = 0.5 + 0.5*cos(6.2831*(f*0.8 + vD*1.5 + vec3(0.0,0.33,0.67)));
  vec3 col = mix(base, uC, f*0.85) + iri*f*0.18;
  col *= 0.55 + 0.6*uLight;
  float alpha = mix(0.55, 0.95, uClarity) * (0.55 + f*0.6);
  gl_FragColor = vec4(col, alpha);
}`;

function Core({ a, b, c, light, clarity, amp, reducedMotion, scale = 1 }: { a: string; b: string; c: string; light: number; clarity: number; amp: number; reducedMotion: boolean; scale?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAmp: { value: amp }, uFreq: { value: 1.4 },
    uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uC: { value: new THREE.Color(c) },
    uLight: { value: light }, uClarity: { value: clarity },
  }), [a, b, c, amp, clarity]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    if (!mat.current) return;
    if (!reducedMotion) mat.current.uniforms.uTime.value += dt;
    mat.current.uniforms.uLight.value = light;
  });
  return (
    <mesh scale={scale}>
      <icosahedronGeometry args={[0.75, 48]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={coreVert} fragmentShader={coreFrag} transparent depthWrite={false} />
    </mesh>
  );
}

function ShellMaterial({ style, color, inferred }: { style: MaterialStyle; color: string; inferred?: boolean }) {
  switch (style) {
    case 'glass':
      return <meshPhysicalMaterial color={color} transmission={1} thickness={1.2} roughness={0.08} ior={1.45} iridescence={0.6} iridescenceIOR={1.3} clearcoat={1} attenuationColor={color} attenuationDistance={2.5} transparent opacity={inferred ? 0.7 : 1} />;
    case 'pearl':
      return <meshPhysicalMaterial color={color} roughness={0.3} sheen={1} sheenColor="#ffffff" iridescence={1} iridescenceIOR={1.6} clearcoat={0.8} />;
    case 'clay':
      return <meshStandardMaterial color={color} roughness={0.95} />;
    case 'chrome':
      return <meshPhysicalMaterial color={color} metalness={1} roughness={0.12} clearcoat={1} envMapIntensity={1.5} />;
  }
}

// ---------- Variant A: layered translucent shells (lathe silhouettes) ----------
function GlassLayers({ profile, look, style, reducedMotion }: VariantProps) {
  const r = mulberry32(profile.seed);
  const layers = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const pts: THREE.Vector2[] = [];
    const k1 = 0.6 + r() * 0.8, k2 = r() * 3;
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      const rad = Math.sin(t * Math.PI) * (0.9 + i * 0.22) * (1 + Math.sin(t * Math.PI * k1 * 3 + k2) * 0.18);
      pts.push(new THREE.Vector2(Math.max(0.001, rad), (t - 0.5) * (2.2 + i * 0.25)));
    }
    const g = new THREE.LatheGeometry(pts, 96, 0, Math.PI * (1.2 + r() * 0.75));
    return { g, rot: r() * Math.PI * 2, tilt: (r() - 0.5) * 0.5, color: [look.accent, look.light, look.accent2, look.top, look.bottom][i] };
  }), [profile.seed, look]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (reducedMotion || !g.current) return;
    g.current.children.forEach((c, i) => { if (c.userData.layer) c.rotation.y = layers[i].rot + clock.elapsedTime * 0.05 * (i % 2 ? 1 : -1); });
  });
  return (
    <group ref={g}>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.g} rotation={[l.tilt, l.rot, 0]} userData={{ layer: true }} castShadow>
          <ShellMaterial style={style} color={l.color} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Variant B: floating organic fragments (one per remembered thing) ----------
function Fragments({ profile, look, style, reducedMotion, onSelect, selection }: VariantProps) {
  const r = mulberry32(profile.seed + 11);
  const items = useMemo(() => {
    const total = Math.max(7, profile.objects.length + profile.unclear.length + 4);
    return Array.from({ length: total }, (_, i) => {
      const g = new THREE.IcosahedronGeometry(0.35 + r() * 0.35, 3);
      const p = g.attributes.position as THREE.BufferAttribute; const v = new THREE.Vector3();
      const f = 1.5 + r() * 2, o = r() * 10;
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        const n = 1 + Math.sin(v.x * f + o) * 0.18 + Math.sin(v.y * f * 1.3 + o) * 0.14;
        v.multiplyScalar(n); v.x *= 0.7 + r() * 0.001 + 0.3; p.setXYZ(k, v.x, v.y * 0.7, v.z);
      }
      g.computeVertexNormals();
      const phi = Math.acos(1 - 2 * (i + 0.5) / total), theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const rad = 1.5 + r() * 0.9;
      // Each fragment corresponds to a remembered object or a forgotten piece, when there are enough.
      const ref: Selection | null = i < profile.objects.length ? { kind: 'object', index: i } : i - profile.objects.length < profile.unclear.length ? { kind: 'gap', index: i - profile.objects.length } : null;
      return { g, pos: new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * rad, Math.cos(phi) * rad * 0.8, Math.sin(phi) * Math.sin(theta) * rad), speed: 0.2 + r() * 0.4, ref, color: [look.accent, look.light, look.accent2, look.bottom][i % 4] };
    });
  }, [profile, look]); // eslint-disable-line react-hooks/exhaustive-deps
  const group = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (reducedMotion || !group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((m, i) => {
      const it = items[i]; if (!it) return;
      m.position.set(it.pos.x, it.pos.y + Math.sin(t * it.speed + i) * 0.12, it.pos.z);
      m.rotation.set(t * it.speed * 0.3, t * it.speed * 0.5 + i, 0);
    });
  });
  return (
    <group ref={group}>
      {items.map((it, i) => {
        const sel = !!(it.ref && selection && selection.kind === it.ref.kind && selection.index === it.ref.index);
        const isGap = it.ref?.kind === 'gap';
        return (
          <mesh key={i} geometry={it.g} position={it.pos} scale={sel ? 1.25 : 1} castShadow
            onClick={(e) => { if (!it.ref) return; e.stopPropagation(); onSelect(it.ref); }}
            onPointerOver={() => { if (it.ref) document.body.style.cursor = 'pointer'; }} onPointerOut={() => (document.body.style.cursor = '')}>
            {isGap
              ? <meshPhysicalMaterial color={look.light} roughness={0.9} transmission={0.9} thickness={0.6} transparent opacity={0.55} />
              : <ShellMaterial style={style} color={it.color} inferred={it.ref?.kind === 'object' && profile.objects[it.ref.index].source === 'inferred'} />}
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- Variant C: interconnected threads (curves weaving around the core) ----------
function Threads({ profile, look, style, reducedMotion }: VariantProps) {
  const r = mulberry32(profile.seed + 23);
  const tubes = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const pts: THREE.Vector3[] = [];
    const a = r() * 6.28, b = r() * 6.28, k = 1 + Math.floor(r() * 3);
    for (let j = 0; j < 64; j++) {
      const t = (j / 64) * Math.PI * 2;
      const rad = 1.3 + Math.sin(t * k + a) * 0.35;
      pts.push(new THREE.Vector3(Math.cos(t) * rad, Math.sin(t * 2 + b) * 0.9, Math.sin(t) * rad).applyAxisAngle(new THREE.Vector3(1, 0, 0), i * 0.45 + a * 0.1));
    }
    return { g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 300, 0.035 + r() * 0.05, 12, true), color: [look.accent, look.light, look.accent2][i % 3] };
  }), [profile.seed, look]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (!reducedMotion && g.current) g.current.rotation.y += dt * 0.06; });
  return (
    <group ref={g}>
      {tubes.map((t, i) => <mesh key={i} geometry={t.g} castShadow><ShellMaterial style={style} color={t.color} /></mesh>)}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={'n' + i} position={[Math.cos(i * 1.05) * 1.35, Math.sin(i * 2.2) * 0.6, Math.sin(i * 1.05) * 1.35]}>
          <sphereGeometry args={[0.09, 24, 16]} /><ShellMaterial style={style} color={look.light} />
        </mesh>
      ))}
    </group>
  );
}

interface VariantProps { profile: MemoryProfile; look: ReturnType<typeof useLook>; style: MaterialStyle; reducedMotion: boolean; onSelect: (s: Selection | null) => void; selection: Selection | null }

export function ObjectScene({ profile, settings, variant, style, selection, onSelect }: { profile: MemoryProfile; settings: SceneSettings; variant: SculptureVariant; style: MaterialStyle; selection: Selection | null; onSelect: (s: Selection | null) => void }) {
  const look = useLook(profile);
  const bg = mix(look.bottom, look.top, 0.35);
  const spin = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (!settings.reducedMotion && spin.current) spin.current.rotation.y += dt * 0.08; });
  const amp = 0.12 + (1 - profile.atmosphere.clarity) * 0.35 + (profile.mood.value === 'strange' ? 0.15 : 0);
  const vp: VariantProps = { profile, look, style, reducedMotion: settings.reducedMotion, onSelect, selection };
  return (
    <group onPointerMissed={() => onSelect(null)}>
      <SceneBackdrop color={bg} fog={{ type: 'linear', near: 6, far: 22 }} />
      <ambientLight intensity={0.35 * settings.light} color={look.light} />
      <directionalLight position={[4, 6, 3]} intensity={2.2 * settings.light} color={look.sun.color} castShadow={settings.quality === 'high'} />
      <directionalLight position={[-5, 2, -4]} intensity={1.1 * settings.light} color={look.accent} />
      <pointLight position={[0, -2, 2]} intensity={3 * settings.light} color={look.accent2} distance={8} />
      <group ref={spin} position={[0, 0.2, 0]}>
        <Core a={look.accent} b={look.bottom} c={look.light} light={settings.light} clarity={profile.atmosphere.clarity} amp={amp} reducedMotion={settings.reducedMotion} scale={variant === 'threads' ? 0.8 : 1} />
        {variant === 'glass' && <GlassLayers {...vp} />}
        {variant === 'fragments' && <Fragments {...vp} />}
        {variant === 'threads' && <Threads {...vp} />}
      </group>
      <ContactShadows position={[0, -2.1, 0]} opacity={0.45} scale={9} blur={2.8} far={4} color={mix(look.bottom, '#000000', 0.6)} />
      <Dust count={settings.quality === 'high' ? 500 : 180} color={look.light} radius={5} height={5} seed={profile.seed} reducedMotion={settings.reducedMotion} />
    </group>
  );
}
