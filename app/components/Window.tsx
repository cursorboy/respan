"use client";

import { useEffect, useRef } from "react";
import { useDesktop } from "./desktop";
import { AppIcon } from "./AppIcon";

interface Props {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultX?: number;
  defaultY?: number;
  w?: number;
  bodyClassName?: string;
  /** If provided, the ✕ control closes (unmounts) the window instead of minimizing. */
  onClose?: () => void;
}

// A draggable, focusable, minimizable, maximizable Win95 window. Floating on
// large screens (managed by DesktopProvider); a plain stacked window otherwise.
export function Window({ id, title, children, defaultX = 40, defaultY = 24, w = 600, bodyClassName = "win-body", onClose }: Props) {
  const desktop = useDesktop();
  const { windows, topId, floating, register, unregister, setTitle, focus, move, setMin, toggleMax } = desktop;
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    register(id, defaultX, defaultY, w);
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setTitle(id, title);
  }, [id, title, setTitle]);

  const st = windows[id];
  if (st?.min) return null;
  const active = topId === id;

  const controls = (
    <span className="win-controls" onPointerDown={(e) => e.stopPropagation()}>
      <button aria-label="Minimize" onClick={() => setMin(id, true)}>
        _
      </button>
      <button aria-label="Maximize" onClick={() => toggleMax(id)}>
        ▢
      </button>
      <button aria-label="Close" onClick={() => (onClose ? onClose() : setMin(id, true))}>
        ✕
      </button>
    </span>
  );

  // --- static (small screens or before registration) ---
  if (!floating || !st) {
    return (
      <div className="win" onPointerDown={() => st && focus(id)}>
        <div className={`win-title ${active ? "" : "win-title-off"}`}>
          <span className="truncate">{title}</span>
          {controls}
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    );
  }

  // --- floating ---
  const onTitleDown = (e: React.PointerEvent) => {
    focus(id);
    if (st.max) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: st.x, oy: st.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onTitleMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    move(id, drag.current.ox + (e.clientX - drag.current.sx), drag.current.oy + (e.clientY - drag.current.sy));
  };
  const onTitleUp = () => {
    drag.current = null;
  };

  const style: React.CSSProperties = st.max
    ? {}
    : { position: "absolute", left: st.x, top: st.y, width: st.w, zIndex: st.z };

  return (
    <div
      className={`win ${st.max ? "fixed inset-x-2 top-[48px] bottom-[44px] z-30 flex flex-col" : ""}`}
      style={style}
      onPointerDown={() => focus(id)}
    >
      <div
        className={`win-title ${active ? "" : "win-title-off"} ${st.max ? "" : "cursor-move"} select-none`}
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onDoubleClick={() => toggleMax(id)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <AppIcon id={id} size={12} light className="shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        {controls}
      </div>
      <div className={`${bodyClassName} ${st.max ? "min-h-0 flex-1 overflow-auto" : ""}`}>{children}</div>
    </div>
  );
}
