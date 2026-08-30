"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useVitals } from "@/lib/store";

const MODEL = "/models/heart.glb";
useGLTF.preload(MODEL);

const RED = new THREE.Color(0.9, 0.12, 0.12);
const RED_EMISSIVE = new THREE.Color(0.6, 0.05, 0.05);

type MatRef = { m: THREE.MeshStandardMaterial; c: THREE.Color; e: THREE.Color; ei: number };

function Heart() {
  const group = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const warnMix = useRef(0);
  const { scene } = useGLTF(MODEL);

  // clone, center, scale to fit, and collect materials for animation
  const { model, mats } = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scl = 34 / Math.max(size.x, size.y, size.z);
    s.scale.setScalar(scl);
    s.position.set(-center.x * scl, -center.y * scl, -center.z * scl);
    const mats: MatRef[] = [];
    s.traverse((o: any) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        const m = o.material as THREE.MeshStandardMaterial;
        mats.push({ m, c: m.color.clone(), e: (m.emissive || new THREE.Color(0)).clone(), ei: m.emissiveIntensity ?? 0 });
      }
    });
    return { model: s, mats };
  }, [scene]);

  useFrame((_, dt) => {
    const { hr, warn } = useVitals.getState();
    phase.current = (phase.current + (hr / 60) * dt) % 1;
    const p = phase.current;
    const pulse =
      Math.exp(-Math.pow((p - 0.11) / 0.08, 2)) * 1.0 +
      Math.exp(-Math.pow((p - 0.38) / 0.11, 2)) * 0.5;
    if (group.current) group.current.scale.setScalar(1 + pulse * 0.06);

    warnMix.current += ((warn ? 1 : 0) - warnMix.current) * Math.min(1, dt * 4);
    const w = warnMix.current;
    for (const o of mats) {
      o.m.color.copy(o.c).lerp(RED, w * 0.55);
      if (o.m.emissive) {
        o.m.emissive.copy(o.e).lerp(RED_EMISSIVE, w * 0.65);
        o.m.emissiveIntensity = o.ei * 0.6 + pulse * 0.6 + w * 0.3;
      }
    }
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

function Field() {
  const pts = useMemo(() => {
    const n = 240, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 26 + Math.random() * 16, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.12; });
  return (
    <points ref={ref} geometry={pts}>
      <pointsMaterial color={"#2FB3A3"} size={0.4} transparent opacity={0.45} />
    </points>
  );
}

export default function HeartTwin() {
  return (
    <Canvas camera={{ position: [0, 6, 62], fov: 45 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight color={"#8090a0"} intensity={0.9} />
      <pointLight color={"#ffe3d8"} intensity={1.7} distance={500} position={[38, 48, 55]} />
      <pointLight color={"#2FB3A3"} intensity={0.9} distance={500} position={[-55, -8, 28]} />
      <directionalLight color={"#ffffff"} intensity={0.6} position={[-24, 18, -45]} />
      <Suspense fallback={null}>
        <Heart />
      </Suspense>
      <Field />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={1.2}
        minDistance={40}
        maxDistance={120}
        minPolarAngle={0.4}
        maxPolarAngle={2.4}
      />
    </Canvas>
  );
}
