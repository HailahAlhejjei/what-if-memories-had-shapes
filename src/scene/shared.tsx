// Shared atmospheric building blocks: sky dome shader, dust particles, light rig, rain.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MemoryProfile, TimeOfDay } from '../memory/types';
import { mix } from '../memory/palettes';
import { mulberry32 } from '../memory/interpret';

export interface SceneSettings {
  light: number; // 0..2 multiplier
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

// ---------- Sky ----------
const skyVert = /* glsl */ `
varying vec3 vPos;
void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const skyFrag = /* glsl */ `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform vec3 uSunDir; uniform float uTime; uniform float uHaze;
varying vec3 vPos;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  float h = clamp(vPos.y*0.5+0.5, 0.0, 1.0);
  vec3 col = mix(uBottom, uTop, smoothstep(0.42, 0.95, h));
  float sun = max(dot(normalize(vPos), normalize(uSunDir)), 0.0);
  col += uGlow * (pow(sun, 8.0)*0.35 + pow(sun, 64.0)*0.6);
  // drifting soft cloud bands
  vec2 uv = vPos.xz / (vPos.y + 0.6) * 1.6 + vec2(uTime*0.006, 0.0);
  float n = noise(uv*1.3) * 0.6 + noise(uv*3.1) * 0.4;
  col = mix(col, mix(uBottom, vec3(1.0), 0.25), smoothstep(0.55, 0.9, n) * 0.18 * smoothstep(0.45, 0.7, h));
  // film grain
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.025;
  col = mix(col, uBottom, uHaze * 0.35 * (1.0 - h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function Sky({ top, bottom, glow, sunDir, haze }: { top: string; bottom: string; glow: string; sunDir: THREE.Vector3; haze: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(() => ({
    uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) }, uGlow: { value: new THREE.Color(glow) },
    uSunDir: { value: sunDir.clone() }, uTime: { value: 0 }, uHaze: { value: haze },
  }), [top, bottom, glow, sunDir, haze]);
  useFrame((_, dt) => { if (mat.current) mat.current.uniforms.uTime.value += dt; });
  return (
    <mesh scale={80} renderOrder={-1}>
      <sphereGeometry args={[1, 48, 24]} />
      <shaderMaterial ref={mat} side={THREE.BackSide} depthWrite={false} fog={false} uniforms={uniforms} vertexShader={skyVert} fragmentShader={skyFrag} />
    </mesh>
  );
}

// ---------- Dust ----------
const dustVert = /* glsl */ `
uniform float uTime; uniform float uSize; attribute float aSeed;
varying float vAlpha;
void main(){
  vec3 p = position;
  p.y += sin(uTime*0.15 + aSeed*6.28) * 0.35;
  p.x += sin(uTime*0.09 + aSeed*12.0) * 0.4;
  p.z += cos(uTime*0.07 + aSeed*9.0) * 0.4;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_PointSize = uSize * (0.6 + aSeed) * (10.0 / -mv.z);
  vAlpha = 0.35 + 0.65 * abs(sin(uTime*0.4 + aSeed*20.0));
  gl_Position = projectionMatrix * mv;
}`;
const dustFrag = /* glsl */ `
uniform vec3 uColor; varying float vAlpha;
void main(){ float d = length(gl_PointCoord - 0.5); if(d>0.5) discard;
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vAlpha * 0.7); }`;

export function Dust({ count, color, radius = 10, height = 6, seed = 1, reducedMotion }: { count: number; color: string; radius?: number; height?: number; seed?: number; reducedMotion: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const geo = useMemo(() => {
    const r = mulberry32(seed + 7);
    const pos = new Float32Array(count * 3); const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
      pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = r() * height; pos[i * 3 + 2] = Math.sin(a) * d; s[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    return g;
  }, [count, radius, height, seed]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 2.2 }, uColor: { value: new THREE.Color(color) } }), [color]);
  useFrame((_, dt) => { if (mat.current && !reducedMotion) mat.current.uniforms.uTime.value += dt; });
  return (
    <points geometry={geo}>
      <shaderMaterial ref={mat} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={dustVert} fragmentShader={dustFrag} />
    </points>
  );
}

// ---------- Rain ----------
export function Rain({ count, color, reducedMotion }: { count: number; color: string; reducedMotion: boolean }) {
  const ref = useRef<THREE.LineSegments>(null!);
  const { geo, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 6); const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 24, y = Math.random() * 12, z = (Math.random() - 0.5) * 24;
      pos.set([x, y, z, x + 0.02, y - 0.35, z], i * 6); speeds[i] = 8 + Math.random() * 5;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, speeds };
  }, [count]);
  useFrame((_, dt) => {
    if (reducedMotion) return;
    const a = geo.attributes.position as THREE.BufferAttribute; const arr = a.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const d = speeds[i] * Math.min(dt, 0.05);
      arr[i * 6 + 1] -= d; arr[i * 6 + 4] -= d;
      if (arr[i * 6 + 4] < 0) { arr[i * 6 + 1] += 12; arr[i * 6 + 4] += 12; }
    }
    a.needsUpdate = true;
  });
  return <lineSegments ref={ref} geometry={geo}><lineBasicMaterial color={color} transparent opacity={0.35} /></lineSegments>;
}

// ---------- Light ----------
const SUN: Record<TimeOfDay, { elev: number; az: number; color: string; intensity: number; ambient: number }> = {
  dawn: { elev: 0.12, az: -1.2, color: '#F2C7B0', intensity: 1.2, ambient: 0.45 },
  morning: { elev: 0.55, az: -0.9, color: '#FFF1DC', intensity: 1.8, ambient: 0.6 },
  afternoon: { elev: 0.8, az: 0.3, color: '#FFF4E2', intensity: 2.1, ambient: 0.65 },
  sunset: { elev: 0.1, az: 1.1, color: '#F2A86A', intensity: 1.7, ambient: 0.45 },
  dusk: { elev: 0.04, az: 1.3, color: '#C99A9D', intensity: 0.8, ambient: 0.4 },
  night: { elev: 0.5, az: -0.4, color: '#9FB3D9', intensity: 0.45, ambient: 0.22 },
};

export function useLook(profile: MemoryProfile) {
  return useMemo(() => {
    const [top, bottom, ground, accent, accent2, light] = profile.palette.colors;
    const s = SUN[profile.time.value];
    const sunDir = new THREE.Vector3(Math.cos(s.az) * Math.cos(s.elev), Math.sin(s.elev), Math.sin(s.az) * Math.cos(s.elev)).normalize();
    const fogColor = mix(bottom, top, 0.15);
    return { top, bottom, ground, accent, accent2, light, sun: s, sunDir, fogColor, glow: mix(s.color, light, 0.4) };
  }, [profile]);
}

export function LightRig({ profile, settings }: { profile: MemoryProfile; settings: SceneSettings }) {
  const look = useLook(profile);
  const k = settings.light;
  const sunPos = look.sunDir.clone().multiplyScalar(14);
  return (
    <>
      <hemisphereLight args={[look.light, look.ground, look.sun.ambient * k]} />
      <directionalLight
        position={sunPos}
        color={look.sun.color}
        intensity={look.sun.intensity * k}
        castShadow={settings.quality === 'high'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
        shadow-radius={6}
      />
      <pointLight position={[0, 2.4, 0]} color={look.accent} intensity={(profile.time.value === 'night' ? 6 : 1.5) * k} distance={10} decay={2} />
    </>
  );
}

/** Sets scene background + fog imperatively so switching scenes never leaves stale values. */
export function SceneBackdrop({ color, fog }: { color: string; fog: { type: 'exp2'; density: number } | { type: 'linear'; near: number; far: number } }) {
  const scene = useThree((s) => s.scene);
  const key = JSON.stringify(fog);
  useEffect(() => {
    scene.background = new THREE.Color(color);
    scene.fog = fog.type === 'exp2' ? new THREE.FogExp2(color, fog.density) : new THREE.Fog(color, fog.near, fog.far);
  }, [scene, color, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
