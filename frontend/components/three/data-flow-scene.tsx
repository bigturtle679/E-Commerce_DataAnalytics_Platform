"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Text, OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { Suspense } from "react";

/* ═══════════════════════════════════════════════
   Pipeline Stages
   ═══════════════════════════════════════════════ */

const STAGES = [
  { id: "raw", label: "Raw", x: -6, color: "#6366f1" },
  { id: "staging", label: "Staging", x: -3, color: "#818cf8" },
  { id: "marts", label: "Marts", x: 0, color: "#38bdf8" },
  { id: "api", label: "API", x: 3, color: "#22d3ee" },
  { id: "dashboard", label: "Dashboard", x: 6, color: "#34d399" },
];

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
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
      <group position={position}>
        {/* Glow sphere */}
        <mesh>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} />
        </mesh>

        {/* Core sphere */}
        <mesh>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>

        {/* Label */}
        <Text
          position={[0, -0.85, 0]}
          fontSize={0.22}
          color="white"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.7}
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

const PARTICLE_COUNT = 150;

function FlowingParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      t: Math.random(),
      speed: 0.1 + Math.random() * 0.15,
      segment: Math.floor(Math.random() * 4),
      yOffset: (Math.random() - 0.5) * 0.8,
      zOffset: (Math.random() - 0.5) * 0.8,
    }));
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    particles.forEach((p, i) => {
      p.t += delta * p.speed;
      if (p.t > 1) p.t -= 1;

      const startX = STAGES[p.segment].x;
      const endX = STAGES[p.segment + 1].x;
      const x = startX + (endX - startX) * p.t;
      const y = p.yOffset + Math.sin(p.t * Math.PI) * 0.3;
      const z = p.zOffset;

      dummy.position.set(x, y, z);
      const scale = Math.sin(p.t * Math.PI) * 0.8 + 0.2;
      dummy.scale.setScalar(scale * 0.04);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.7} />
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
      const start = new THREE.Vector3(stage.x + 0.4, 0, 0);
      const mid = new THREE.Vector3((stage.x + next.x) / 2, 0.15, 0);
      const end = new THREE.Vector3(next.x - 0.4, 0, 0);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curve.getPoints(30).forEach((p) => points.push([p.x, p.y, p.z]));
      return points;
    });
  }, []);

  return (
    <>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#334155"
          lineWidth={1}
          transparent
          opacity={0.3}
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
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 5]} intensity={0.6} color="#60a5fa" />
      <pointLight position={[-5, -3, 3]} intensity={0.3} color="#818cf8" />

      {/* Nodes */}
      {STAGES.map((stage) => (
        <PipelineNode
          key={stage.id}
          position={[stage.x, 0, 0]}
          color={stage.color}
          label={stage.label}
        />
      ))}

      {/* Connections */}
      <ConnectionLines />

      {/* Particles */}
      <FlowingParticles />

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.3}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════
   Fallback (2D SVG)
   ═══════════════════════════════════════════════ */

function DataFlowFallback() {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      {STAGES.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: stage.color,
                boxShadow: `0 0 10px ${stage.color}40`,
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
                  opacity: 0.5,
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
          camera={{ position: [0, 3, 10], fov: 40 }}
          style={{ background: "transparent" }}
          frameloop="always"
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene />
        </Canvas>
      </Suspense>
      {/* Title overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 font-mono">
          Data Pipeline Topology
        </p>
      </div>
    </div>
  );
}
