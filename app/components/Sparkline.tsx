"use client";

// Tiny dependency-free SVG sparkline.

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  /** Animate the line drawing itself in (only for static sparklines). */
  animate?: boolean;
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "var(--color-accent)",
  fill = true,
  animate = false,
}: Props) {
  if (values.length === 0) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const n = values.length;
  const x = (i: number) => (n === 1 ? width : (i / (n - 1)) * width);
  const y = (v: number) => height - ((v - min) / span) * (height - 2) - 1;

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      {fill && <path d={area} fill={color} fillOpacity={0.12} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={animate ? 1 : undefined}
        className={animate ? "draw-line" : undefined}
      />
    </svg>
  );
}
