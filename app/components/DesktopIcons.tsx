"use client";

import { useRef, useState } from "react";
import { AppIcon } from "./AppIcon";

type DeskApp = "playground" | "minesweeper";

const ICONS: { id: DeskApp; label: string; x: number; y: number }[] = [
  { id: "playground", label: "Playground", x: 392, y: 352 },
  { id: "minesweeper", label: "Minesweeper", x: 496, y: 352 },
];

// Classic Win95 desktop shortcuts, sitting on the teal desktop (behind windows).
// Draggable: a plain click opens the app, a drag past the threshold relocates the
// icon. Floating screens only; small screens stack windows.
export function DesktopIcons({ onOpen }: { onOpen: (app: DeskApp) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
      {ICONS.map((ic) => (
        <DeskIcon key={ic.id} id={ic.id} label={ic.label} x={ic.x} y={ic.y} onOpen={() => onOpen(ic.id)} />
      ))}
    </div>
  );
}

function DeskIcon({ id, label, x, y, onOpen }: { id: DeskApp; label: string; x: number; y: number; onOpen: () => void }) {
  const [pos, setPos] = useState({ x, y });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setPos({ x: Math.max(0, d.ox + dx), y: Math.max(0, d.oy + dy) });
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) onOpen(); // a click, not a drag → open
    drag.current = null;
  };

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ left: pos.x, top: pos.y }}
      className="group pointer-events-auto absolute flex w-[80px] cursor-move select-none flex-col items-center gap-1 p-1 text-center focus:outline-none"
    >
      <span className="bevel-out flex h-12 w-12 items-center justify-center bg-panel group-active:translate-y-px">
        <AppIcon id={id} size={26} />
      </span>
      <span className="px-1 text-[11px] font-bold leading-tight text-white [text-shadow:1px_1px_0_#000,-1px_0_0_#000] group-focus:bg-accent-glow">
        {label}
      </span>
    </button>
  );
}
