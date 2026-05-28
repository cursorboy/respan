// The classic waving Windows flag (4 panes), approximated with trapezoids.
export function WinFlag({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 90 90" width={size} height={size} className={className} aria-hidden fill="none">
      <path d="M5 11 L41 5 L41 43 L5 47 Z" fill="#F24E3B" />
      <path d="M46 4 L86 10 L86 43 L46 42 Z" fill="#43B649" />
      <path d="M5 52 L41 48 L41 86 L5 80 Z" fill="#2D8CEB" />
      <path d="M46 47 L86 48 L86 80 L46 87 Z" fill="#FFC927" />
    </svg>
  );
}
