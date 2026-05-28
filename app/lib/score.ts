// Maps a 1–10 score to a diverging red → amber → green color, tuned for a LIGHT
// theme: pastel cell fills with dark, readable colored numbers. Accepts floats
// (mean scores). Applied as inline styles to avoid Tailwind JIT missing
// runtime-built class names.

export function scoreHue(score: number): number {
  const clamped = Math.max(1, Math.min(10, score));
  return ((clamped - 1) / 9) * 130; // 0 = red, 130 = green
}

/** Dark, readable colored ink for numbers/labels on a light tint. */
export function scoreColor(score: number, alpha = 1): string {
  return `hsl(${scoreHue(score)} 62% 36% / ${alpha})`;
}

/** Light pastel cell background. */
export function scoreTint(score: number): string {
  return `hsl(${scoreHue(score)} 72% 93%)`;
}

/** Light border that still carries the hue. */
export function scoreBorder(score: number): string {
  return `hsl(${scoreHue(score)} 48% 80%)`;
}
