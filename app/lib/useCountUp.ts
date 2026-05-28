"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from `start` toward `target` with easeOutCubic. On the first
 * mount it sweeps from `start`; later target changes animate from the previous
 * value. Honors prefers-reduced-motion (snaps instantly).
 */
export function useCountUp(target: number, { duration = 850, start = 0 }: { duration?: number; start?: number } = {}): number {
  const [value, setValue] = useState(start);
  const prev = useRef(start);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = prev.current;
    prev.current = target;

    if (reduce || from === target) {
      setValue(target);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}
