// Procedural, soft-edged object templates. Each is built from rounded / lathed / organic forms
// and takes palette colors so the same template reads differently per memory.
import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { ObjectKind } from '../../memory/types';

export interface ObjProps { c: string; c2: string; glow: string; inferred: boolean }

function Mat({ color, inferred, rough = 0.85, emissive, emissiveIntensity = 0, transmission = 0 }: { color: string; inferred: boolean; rough?: number; emissive?: string; emissiveIntensity?: number; transmission?: number }) {
  // Inferred objects are rendered slightly translucent: present, but not quite claimed.
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={rough}
      sheen={0.4}
      sheenColor="#ffffff"
      transparent={inferred || transmission > 0}
      opacity={inferred ? 0.62 : 1}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissiveIntensity}
      transmission={transmission}
      thickness={transmission ? 0.6 : 0}
    />
  );
}

function Lathe({ pts, color, inferred, segments = 40, rough }: { pts: [number, number][]; color: string; inferred: boolean; segments?: number; rough?: number }) {
  const geo = useMemo(() => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments), [pts, segments]);
  return <mesh geometry={geo} castShadow receiveShadow><Mat color={color} inferred={inferred} rough={rough} /></mesh>;
}

function Lamp({ c, glow, inferred }: ObjProps) {
  return (
    <group>
      <Lathe pts={[[0, 0], [0.22, 0], [0.24, 0.05], [0.06, 0.12], [0.04, 0.9], [0, 0.9]]} color={c} inferred={inferred} />
      <mesh position={[0, 1.08, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.32, 0.36, 32, 1, true]} />
        <meshPhysicalMaterial color={glow} emissive={glow} emissiveIntensity={1.4} side={THREE.DoubleSide} transparent opacity={0.85} roughness={1} />
      </mesh>
      <pointLight position={[0, 1, 0]} color={glow} intensity={2.4} distance={5} decay={2} />
    </group>
  );
}

function Bed({ c, c2, inferred }: ObjProps) {
  return (
    <group>
      <RoundedBox args={[2.1, 0.45, 1.5]} radius={0.12} position={[0, 0.25, 0]} castShadow receiveShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      <RoundedBox args={[2.0, 0.22, 1.45]} radius={0.1} position={[0.05, 0.55, 0]} castShadow><Mat color={c2} inferred={inferred} /></RoundedBox>
      <RoundedBox args={[0.5, 0.18, 0.9]} radius={0.09} position={[-0.7, 0.73, 0]} castShadow><Mat color="#F4EFE6" inferred={inferred} /></RoundedBox>
      <RoundedBox args={[0.12, 1.0, 1.5]} radius={0.05} position={[-1.05, 0.5, 0]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
    </group>
  );
}

function Window({ c, glow, inferred }: ObjProps) {
  return (
    <group position={[0, 1.6, 0]}>
      <RoundedBox args={[1.5, 1.9, 0.12]} radius={0.05} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[1.25, 1.65]} />
        <meshBasicMaterial color={glow} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.08]}><boxGeometry args={[0.05, 1.65, 0.02]} /><Mat color={c} inferred={inferred} /></mesh>
      <mesh position={[0, 0.1, 0.08]}><boxGeometry args={[1.25, 0.05, 0.02]} /><Mat color={c} inferred={inferred} /></mesh>
      <pointLight position={[0, 0, 0.8]} color={glow} intensity={2.5} distance={5} decay={2} />
    </group>
  );
}

function Tree({ c, c2, inferred }: ObjProps) {
  const blobs = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return { p: [Math.cos(a) * 0.55, 2.2 + Math.sin(i * 2.1) * 0.35, Math.sin(a) * 0.55] as [number, number, number], s: 0.55 + (i % 3) * 0.12 };
  }), []);
  return (
    <group>
      <Lathe pts={[[0, 0], [0.22, 0], [0.14, 0.4], [0.1, 1.6], [0.05, 2.2], [0, 2.2]]} color={c2} inferred={inferred} segments={12} />
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p} scale={b.s} castShadow>
          <icosahedronGeometry args={[1, 3]} />
          <Mat color={c} inferred={inferred} rough={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 0]} scale={0.75} castShadow><icosahedronGeometry args={[1, 3]} /><Mat color={c} inferred={inferred} rough={0.95} /></mesh>
    </group>
  );
}

function Flower({ c, c2, inferred }: ObjProps) {
  const stems = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: Math.cos(i * 2.4) * 0.35 * (i / 7 + 0.3), z: Math.sin(i * 2.4) * 0.35 * (i / 7 + 0.3), h: 0.35 + (i % 3) * 0.15 })), []);
  return (
    <group>
      {stems.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <mesh position={[0, s.h / 2, 0]}><cylinderGeometry args={[0.012, 0.015, s.h, 5]} /><Mat color={c2} inferred={inferred} /></mesh>
          <mesh position={[0, s.h, 0]} scale={[1, 0.6, 1]} castShadow><sphereGeometry args={[0.08, 16, 12]} /><Mat color={c} inferred={inferred} rough={0.6} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Bench({ c, inferred }: ObjProps) {
  return (
    <group>
      <RoundedBox args={[1.8, 0.1, 0.5]} radius={0.04} position={[0, 0.48, 0]} castShadow receiveShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      <RoundedBox args={[1.8, 0.4, 0.08]} radius={0.04} position={[0, 0.85, -0.22]} rotation={[-0.15, 0, 0]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      {[-0.75, 0.75].map((x) => <RoundedBox key={x} args={[0.08, 0.48, 0.45]} radius={0.03} position={[x, 0.24, 0]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>)}
    </group>
  );
}

function Door({ c, glow, inferred }: ObjProps) {
  return (
    <group>
      <RoundedBox args={[1.2, 2.4, 0.16]} radius={0.05} position={[0, 1.2, 0]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      <mesh position={[0, 1.15, 0.09]}><planeGeometry args={[0.95, 2.1]} /><meshBasicMaterial color={glow} transparent opacity={0.55} /></mesh>
      <mesh position={[0.38, 1.15, 0.13]}><sphereGeometry args={[0.04, 12, 8]} /><meshStandardMaterial color="#D6A66A" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

function Chair({ c, inferred }: ObjProps) {
  return (
    <group>
      <RoundedBox args={[0.6, 0.08, 0.6]} radius={0.03} position={[0, 0.48, 0]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      <RoundedBox args={[0.6, 0.6, 0.07]} radius={0.03} position={[0, 0.82, -0.27]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      {[[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.24, z]} castShadow><cylinderGeometry args={[0.025, 0.03, 0.48, 8]} /><Mat color={c} inferred={inferred} /></mesh>
      ))}
    </group>
  );
}

function Table({ c, c2, inferred }: ObjProps) {
  return (
    <group>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow><cylinderGeometry args={[0.7, 0.7, 0.06, 48]} /><Mat color={c} inferred={inferred} /></mesh>
      <Lathe pts={[[0, 0], [0.35, 0], [0.3, 0.05], [0.06, 0.15], [0.05, 0.74], [0, 0.74]]} color={c2} inferred={inferred} />
    </group>
  );
}

function Book({ c, c2, inferred }: ObjProps) {
  return (
    <group position={[0, 0.03, 0]} rotation={[0, 0.4, 0]}>
      <RoundedBox args={[0.5, 0.06, 0.36]} radius={0.015} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
      <RoundedBox args={[0.46, 0.05, 0.33]} radius={0.01} position={[0.04, 0.06, 0.02]} rotation={[0, 0.25, 0]} castShadow><Mat color={c2} inferred={inferred} /></RoundedBox>
      <mesh position={[-0.05, 0.1, 0.1]} rotation={[-Math.PI / 2, 0, 0.6]}><planeGeometry args={[0.3, 0.22]} /><meshStandardMaterial color="#F4EFE6" side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

function Swing({ c, c2, inferred }: ObjProps) {
  return (
    <group>
      {[-0.9, 0.9].map((x) => <mesh key={x} position={[x, 1.3, 0]} castShadow><cylinderGeometry args={[0.05, 0.06, 2.6, 8]} /><Mat color={c2} inferred={inferred} /></mesh>)}
      <mesh position={[0, 2.6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 1.9, 8]} /><Mat color={c2} inferred={inferred} /></mesh>
      {[-0.3, 0.3].map((x) => <mesh key={x} position={[x, 1.75, 0]}><cylinderGeometry args={[0.008, 0.008, 1.7, 4]} /><meshBasicMaterial color="#F4EFE6" /></mesh>)}
      <RoundedBox args={[0.7, 0.05, 0.25]} radius={0.02} position={[0, 0.9, 0]} castShadow><Mat color={c} inferred={inferred} /></RoundedBox>
    </group>
  );
}

function Umbrella({ c, c2, inferred }: ObjProps) {
  return (
    <group rotation={[0.2, 0, 0.15]}>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.015, 0.015, 1.6, 6]} /><Mat color={c2} inferred={inferred} /></mesh>
      <mesh position={[0, 1.6, 0]} castShadow><sphereGeometry args={[0.75, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2.6]} /><meshPhysicalMaterial color={c} side={THREE.DoubleSide} roughness={0.5} transparent opacity={inferred ? 0.6 : 0.92} /></mesh>
    </group>
  );
}

function Shell({ c, inferred }: ObjProps) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 120; i++) { const t = i / 119; const a = t * Math.PI * 5; const r = 0.03 + t * 0.22; pts.push(new THREE.Vector3(Math.cos(a) * r, t * 0.25, Math.sin(a) * r)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.06, 12, false);
  }, []);
  return <mesh geometry={geo} position={[0, 0.05, 0]} rotation={[Math.PI / 2.4, 0, 0]} castShadow><Mat color={c} inferred={inferred} rough={0.3} /></mesh>;
}

function Boat({ c, c2, inferred }: ObjProps) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    g.scale(1.3, 0.45, 0.45); return g;
  }, []);
  return (
    <group position={[0, 0.35, 0]}>
      <mesh geometry={geo} castShadow><meshPhysicalMaterial color={c} side={THREE.DoubleSide} roughness={0.7} transparent={inferred} opacity={inferred ? 0.62 : 1} /></mesh>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.025, 0.03, 1.8, 6]} /><Mat color={c2} inferred={inferred} /></mesh>
      <mesh position={[0.35, 1.0, 0]}><planeGeometry args={[0.65, 1.3]} /><meshPhysicalMaterial color="#F4EFE6" side={THREE.DoubleSide} transparent opacity={0.85} /></mesh>
    </group>
  );
}

function Streetlight({ c, glow, inferred }: ObjProps) {
  return (
    <group>
      <Lathe pts={[[0, 0], [0.18, 0], [0.12, 0.2], [0.05, 0.3], [0.04, 3.4], [0, 3.4]]} color={c} inferred={inferred} segments={16} />
      <mesh position={[0, 3.5, 0]}><sphereGeometry args={[0.2, 24, 16]} /><meshBasicMaterial color={glow} toneMapped={false} /></mesh>
      <pointLight position={[0, 3.3, 0]} color={glow} intensity={6} distance={8} decay={2} />
    </group>
  );
}

function Car({ c, c2, inferred }: ObjProps) {
  return (
    <group position={[0, 0.3, 0]}>
      <RoundedBox args={[2.4, 0.55, 1.1]} radius={0.24} castShadow><Mat color={c} inferred={inferred} rough={0.4} /></RoundedBox>
      <RoundedBox args={[1.3, 0.5, 1.0]} radius={0.22} position={[-0.15, 0.42, 0]} castShadow><Mat color={c2} inferred={inferred} rough={0.2} transmission={0.4} /></RoundedBox>
      {[[-0.75, 0.5], [0.75, 0.5], [-0.75, -0.5], [0.75, -0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.2, z]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.18, 0.08, 10, 20]} /><meshStandardMaterial color="#29272B" roughness={0.9} /></mesh>
      ))}
    </group>
  );
}

function Piano({ c, inferred }: ObjProps) {
  return (
    <group>
      <RoundedBox args={[1.6, 1.2, 0.6]} radius={0.06} position={[0, 0.6, 0]} castShadow><Mat color={c} inferred={inferred} rough={0.25} /></RoundedBox>
      <mesh position={[0, 0.78, 0.36]}><boxGeometry args={[1.45, 0.04, 0.16]} /><meshStandardMaterial color="#F4EFE6" /></mesh>
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[-0.62 + i * 0.14, 0.81, 0.33]}><boxGeometry args={[0.05, 0.03, 0.09]} /><meshStandardMaterial color="#29272B" /></mesh>)}
    </group>
  );
}

function Clock({ c, c2, inferred }: ObjProps) {
  return (
    <group position={[0, 1.6, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.38, 0.38, 0.08, 48]} /><Mat color={c} inferred={inferred} /></mesh>
      <mesh position={[0, 0, 0.045]}><circleGeometry args={[0.33, 48]} /><meshStandardMaterial color="#F4EFE6" /></mesh>
      <mesh position={[0.06, 0.08, 0.05]} rotation={[0, 0, -0.6]}><boxGeometry args={[0.02, 0.22, 0.01]} /><meshBasicMaterial color={c2} /></mesh>
      <mesh position={[-0.05, 0.03, 0.05]} rotation={[0, 0, 1.1]}><boxGeometry args={[0.025, 0.14, 0.01]} /><meshBasicMaterial color={c2} /></mesh>
      <mesh position={[0, -0.9, 0]}><cylinderGeometry args={[0.03, 0.05, 1.4, 8]} /><Mat color={c} inferred={inferred} /></mesh>
    </group>
  );
}

function Cup({ c, inferred }: ObjProps) {
  return (
    <group>
      <Lathe pts={[[0, 0], [0.09, 0], [0.11, 0.02], [0.12, 0.16], [0.115, 0.17], [0.1, 0.03], [0, 0.03]]} color={c} inferred={inferred} rough={0.3} />
      <mesh position={[0.13, 0.09, 0]}><torusGeometry args={[0.04, 0.012, 8, 16]} /><Mat color={c} inferred={inferred} /></mesh>
    </group>
  );
}

function Stone({ c, inferred }: ObjProps) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.5, 4);
    const p = g.attributes.position as THREE.BufferAttribute; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + Math.sin(v.x * 4.1) * 0.08 + Math.sin(v.y * 5.3 + v.z * 3) * 0.06;
      v.multiplyScalar(n); v.y *= 0.6; p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  }, []);
  return <mesh geometry={geo} position={[0, 0.2, 0]} castShadow receiveShadow><Mat color={c} inferred={inferred} rough={0.95} /></mesh>;
}

export const OBJECT_TEMPLATES: Record<ObjectKind, (p: ObjProps) => JSX.Element> = {
  lamp: Lamp, bed: Bed, window: Window, tree: Tree, flower: Flower, bench: Bench, door: Door, chair: Chair, table: Table,
  book: Book, swing: Swing, umbrella: Umbrella, shell: Shell, boat: Boat, streetlight: Streetlight, car: Car, piano: Piano,
  clock: Clock, cup: Cup, stone: Stone,
};

/** Approximate footprint radius for layout. */
export const OBJECT_SIZE: Record<ObjectKind, number> = {
  lamp: 0.5, bed: 1.4, window: 0.9, tree: 1.4, flower: 0.5, bench: 1.0, door: 0.8, chair: 0.5, table: 0.8, book: 0.4,
  swing: 1.1, umbrella: 0.8, shell: 0.3, boat: 1.4, streetlight: 0.4, car: 1.4, piano: 1.0, clock: 0.5, cup: 0.2, stone: 0.6,
};

/** Wall-mounted objects stand against the back of interior scenes. */
export const WALL_OBJECTS = new Set<ObjectKind>(['window', 'door', 'clock']);
