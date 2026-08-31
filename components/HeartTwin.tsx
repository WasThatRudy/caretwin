"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMonitor } from "@/lib/store";

const MODEL = "/models/heart.glb";
useGLTF.preload(MODEL);

const RED = new THREE.Color(0.86, 0.16, 0.14);
const RED_E = new THREE.Color(0.5, 0.05, 0.05);
type MatRef = { m: THREE.MeshStandardMaterial; c: THREE.Color; e: THREE.Color; ei: number };

function Heart() {
  const group = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const warnMix = useRef(0);
  const { scene } = useGLTF(MODEL);

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
    const { bpm, warn } = useMonitor.getState();
    phase.current = (phase.current + (bpm / 60) * dt) % 1;
    const p = phase.current;
    const pulse = Math.exp(-Math.pow((p - 0.11) / 0.08, 2)) + Math.exp(-Math.pow((p - 0.38) / 0.11, 2)) * 0.5;
    if (group.current) group.current.scale.setScalar(1 + pulse * 0.045);
    warnMix.current += ((warn ? 1 : 0) - warnMix.current) * Math.min(1, dt * 3);
    const w = warnMix.current;
    for (const o of mats) {
      o.m.color.copy(o.c).lerp(RED, w * 0.5);
      if (o.m.emissive) {
        o.m.emissive.copy(o.e).lerp(RED_E, w * 0.6);
        o.m.emissiveIntensity = o.ei * 0.5 + pulse * 0.4 + w * 0.25;
      }
    }
  });

  return <group ref={group}><primitive object={model} /></group>;
}

export default function HeartTwin() {
  return (
    <Canvas camera={{ position: [0, 6, 62], fov: 42 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <ambientLight color={"#8894a4"} intensity={0.85} />
      <pointLight color={"#ffe7dc"} intensity={1.5} distance={500} position={[36, 46, 52]} />
      <pointLight color={"#3aa0b0"} intensity={0.6} distance={500} position={[-52, -6, 26]} />
      <directionalLight color={"#ffffff"} intensity={0.5} position={[-22, 16, -42]} />
      <Suspense fallback={null}><Heart /></Suspense>
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08}
        autoRotate autoRotateSpeed={1.0} minDistance={42} maxDistance={110} minPolarAngle={0.5} maxPolarAngle={2.3} />
    </Canvas>
  );
}
