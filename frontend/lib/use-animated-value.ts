"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook that animates a numeric value with smooth interpolation.
 * Uses requestAnimationFrame for 60fps transitions.
 */
export function useAnimatedValue(
  target: number,
  duration: number = 800,
): number {
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = to;

    if (from === to) return;

    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setCurrent(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return current;
}

/**
 * Formats an animated number with the same formatting as formatNumber.
 */
export function useFormattedAnimatedValue(
  target: number,
  duration: number = 800,
): string {
  const animated = useAnimatedValue(target, duration);
  const rounded = Math.round(animated);

  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`;
  if (rounded >= 1_000) return `${(rounded / 1_000).toFixed(1)}K`;
  return rounded.toLocaleString();
}
