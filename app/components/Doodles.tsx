// Hand-drawn doodle SVG decorations. Stroke-based, slightly irregular paths so
// they read as sketched. Color via currentColor (text-*).

interface D {
  className?: string;
  size?: number;
}

export function Sparkle({ className = "", size = 26 }: D) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 2.5 C 12.8 8, 16.2 11.4, 21.5 12 C 16.2 12.8, 12.8 16.1, 12 21.5 C 11.2 16.1, 7.8 12.8, 2.5 12 C 7.8 11.4, 11.2 8, 12 2.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Star({ className = "", size = 24 }: D) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 2.5 L14.6 9.2 L21.5 9.6 L16.2 14 L18 20.6 L12 16.7 L6 20.6 L7.8 14 L2.5 9.6 L9.4 9.2 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Squiggle({ className = "", size = 48 }: D) {
  return (
    <svg width={size} height={size * 0.4} viewBox="0 0 60 24" fill="none" aria-hidden className={className}>
      <path
        d="M2 14 C 8 4, 14 4, 19 13 S 31 22, 37 12 S 50 3, 58 11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CurvyArrow({ className = "", size = 64 }: D) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 80 48" fill="none" aria-hidden className={className}>
      <path
        d="M76 10 C 50 2, 18 6, 8 32"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M5 20 L8 33 L20 28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Loop({ className = "", size = 30 }: D) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path
        d="M6 22 C 2 14, 10 6, 17 9 C 24 12, 22 24, 14 24 C 8 24, 7 17, 13 15 C 18 13, 22 18, 24 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
