"use client";

import { lazy, Suspense } from "react";

// Lazy-load 3D scene for performance
const DataFlowScene = lazy(() =>
  import("@/components/three/data-flow-scene").then((m) => ({ default: m.DataFlowScene }))
);

export function SpatialBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Suspense fallback={null}>
        <DataFlowScene className="w-full h-full" />
      </Suspense>
    </div>
  );
}
