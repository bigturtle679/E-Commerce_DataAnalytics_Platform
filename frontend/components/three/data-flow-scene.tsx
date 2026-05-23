"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { Suspense } from "react";

/* ═══════════════════════════════════════════════
   Pipeline Stages & Horizon Palette
   ═══════════════════════════════════════════════ */

const STAGES = [
  { id: "raw", label: "Raw", x: -8, z: -4, color: "#e07a5f" },     // Terracotta
  { id: "staging", label: "Staging", x: -4, z: -2, color: "#f2cc8f" }, // Warm Gold
  { id: "marts", label: "Marts", x: 0, z: 0, color: "#81b29a" },       // Sage Green
  { id: "api", label: "API", x: 4, z: -2, color: "#4f5d75" },          // Slate Blue
  { id: "dashboard", label: "Dashboard", x: 8, z: -4, color: "#e07a5f" }, // Terracotta
];

/* ═══════════════════════════════════════════════
   Scroll-Linked Camera Control
   ═══════════════════════════════════════════════ */

function CameraRig() {
  const { camera } = useThree();
  const targetPosition = useMemo(() => new THREE.Vector3(0, 2, 10), []);
  
  useFrame(() => {
    // We map scroll progress (0 to max height) to camera position
    const scrollY = window.scrollY;
    // Calculate a scroll factor (0 at top, increasing)
    // We use a simple linear map for demo, assuming ~2000px scrollable area
    const progress = Math.min(scrollY / 1500, 1);
    
    // Base camera starts at [0, 4, 12] looking down at 0,0,0
    // As we scroll, we dive closer to [0, 1, 4]
    targetPosition.x = THREE.MathUtils.lerp(0, STAGES[2].x, progress * 0.5); // Drift slightly towards center
    targetPosition.y = THREE.MathUtils.lerp(4, 0.5, progress);
    targetPosition.z = THREE.MathUtils.lerp(14, 3, progress);

    // Smoothly interpolate camera to target position
    camera.position.lerp(targetPosition, 0.05);
    
    // Always look at the center stage
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ═══════════════════════════════════════════════
   Pipeline Node
   ═══════════════════════════════════════════════ */

function PipelineNode({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.4}>
      <group position={position}>
        {/* Glow sphere */}
        <mesh>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Core sphere */}
        <mesh>
          <sphereGeometry args={[0.25, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            roughness={0.1}
            metalness={0.8}
          />
        </mesh>

        {/* Label */}
        <Text
          position={[0, -0.9, 0]}
          fontSize={0.25}
          color="white"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.8}
        >
          {label}
        </Text>
      </group>
    </Float>
  );
}

/* ═══════════════════════════════════════════════
   Flowing Particles
   ═══════════════════════════════════════════════ */

const PARTICLE_COUNT = 250;

function FlowingParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      t: Math.random(),
      speed: 0.08 + Math.random() * 0.1,
      segment: Math.floor(Math.random() * 4),
      yOffset: (Math.random() - 0.5) * 1.2,
      zOffset: (Math.random() - 0.5) * 1.2,
    }));
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    particles.forEach((p, i) => {
      p.t += delta * p.speed;
      if (p.t > 1) p.t -= 1;

      const stage1 = STAGES[p.segment];
      const stage2 = STAGES[p.segment + 1];
      
      const x = stage1.x + (stage2.x - stage1.x) * p.t;
      const y = p.yOffset + Math.sin(p.t * Math.PI) * 0.4;
      const z = stage1.z + (stage2.z - stage1.z) * p.t + p.zOffset;

      dummy.position.set(x, y, z);
      const scale = Math.sin(p.t * Math.PI) * 1.2 + 0.3;
      dummy.scale.setScalar(scale * 0.03);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#f4f1de" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
}

/* ═══════════════════════════════════════════════
   Connection Lines
   ═══════════════════════════════════════════════ */

function ConnectionLines() {
  const lines = useMemo(() => {
    return STAGES.slice(0, -1).map((stage, i) => {
      const next = STAGES[i + 1];
      const points: [number, number, number][] = [];
      const start = new THREE.Vector3(stage.x + 0.4, 0, stage.z);
      const mid = new THREE.Vector3((stage.x + next.x) / 2, 0.5, (stage.z + next.z) / 2);
      const end = new THREE.Vector3(next.x - 0.4, 0, next.z);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curve.getPoints(40).forEach((p) => points.push([p.x, p.y, p.z]));
      return points;
    });
  }, []);

  return (
    <>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#81b29a"
          lineWidth={1.5}
          transparent
          opacity={0.15}
        />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════
   Main Scene
   ═══════════════════════════════════════════════ */

function Scene() {
  return (
    <>
      <CameraRig />
      
      {/* Lighting tailored for Horizon palette */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 8, 5]} intensity={1.5} color="#f4f1de" />
      <pointLight position={[-8, -4, 4]} intensity={0.8} color="#e07a5f" />

      {/* Nodes */}
      {STAGES.map((stage) => (
        <PipelineNode
          key={stage.id}
          position={[stage.x, 0, stage.z]}
          color={stage.color}
          label={stage.label}
        />
      ))}

      {/* Connections */}
      <ConnectionLines />

      {/* Particles */}
      <FlowingParticles />
    </>
  );
}

/* ═══════════════════════════════════════════════
   Fallback (2D SVG)
   ═══════════════════════════════════════════════ */

function DataFlowFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-20 pointer-events-none">
      {STAGES.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: stage.color,
                boxShadow: `0 0 12px ${stage.color}60`,
              }}
            />
            <span className="text-[10px] text-muted-foreground font-mono">
              {stage.label}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div className="relative w-8 h-px overflow-hidden">
              <div
                className="absolute h-full w-4"
                style={{
                  background: `linear-gradient(90deg, ${stage.color}, ${STAGES[i + 1].color})`,
                  animation: "flow 2s ease-in-out infinite",
                  animationDelay: `${i * 0.3}s`,
                  opacity: 0.6,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, ${stage.color}30, ${STAGES[i + 1].color}30)`,
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Exported Component
   ═══════════════════════════════════════════════ */

export function DataFlowScene({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Suspense fallback={<DataFlowFallback />}>
        <Canvas
          style={{ background: "transparent", pointerEvents: "none" }} // Pointer events none so it doesn't block scrolling/clicks
          frameloop="always"
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <Scene />
        </Canvas>
      </Suspense>
    </div>
  );
}
