// Hand-drawn wavy underline (sketch accent under headlines).
export function DoodleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden className={className} fill="none">
      <path
        d="M3 8 C 48 3, 92 11, 150 6 S 252 3, 297 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
