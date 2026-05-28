"use client";

import { useCountUp } from "@/app/lib/useCountUp";

interface Props {
  value: number;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
}

// Animated number readout. Used for the hero rating and leaderboard ratings.
export function CountUp({ value, decimals = 0, className, style, duration }: Props) {
  const v = useCountUp(value, duration ? { duration } : undefined);
  return (
    <span className={className} style={style}>
      {decimals > 0 ? v.toFixed(decimals) : Math.round(v)}
    </span>
  );
}
