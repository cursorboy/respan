"use client";

import { useEffect, useRef, useState } from "react";
import { WinFlag } from "./WinFlag";
import { AppIcon } from "./AppIcon";
import { StartMenu, type StartMenuActions } from "./StartMenu";
import { useDesktop } from "./desktop";

export function Taskbar(props: StartMenuActions) {
  const [startOpen, setStartOpen] = useState(false);
  const [clock, setClock] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { order, titles, windows, topId, focus, setMin } = useDesktop();

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!startOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setStartOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [startOpen]);

  const onTask = (id: string) => {
    const w = windows[id];
    if (!w) return;
    if (w.min) {
      setMin(id, false);
      focus(id);
    } else if (topId === id) {
      setMin(id, true);
    } else {
      focus(id);
    }
  };

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-50">
      {startOpen && <StartMenu {...props} onClose={() => setStartOpen(false)} />}
      <div className="bevel-out flex items-center gap-1.5 bg-panel px-1 py-1">
        <button
          onClick={() => setStartOpen((s) => !s)}
          className={`btn95 flex shrink-0 items-center gap-1.5 px-2 py-1 text-[13px] font-bold ${startOpen ? "translate-y-px" : ""}`}
        >
          <WinFlag size={16} /> Start
        </button>
        <div className="mx-0.5 h-6 w-0.5 shrink-0 bg-[#808080]" />

        {/* Quick Launch: open the tool apps straight from the taskbar */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={props.onPlayground} title="Playground" aria-label="Open Playground" className="btn95 flex h-7 w-7 items-center justify-center">
            <AppIcon id="playground" size={15} />
          </button>
          <button onClick={props.onMinesweeper} title="Minesweeper" aria-label="Open Minesweeper" className="btn95 flex h-7 w-7 items-center justify-center">
            <AppIcon id="minesweeper" size={15} />
          </button>
        </div>

        <div className="mx-0.5 h-6 w-0.5 shrink-0 bg-[#808080]" />

        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {order.map((id) => {
            const active = topId === id && !windows[id]?.min;
            return (
              <button
                key={id}
                onClick={() => onTask(id)}
                title={titles[id]}
                className={`flex min-w-[110px] max-w-[180px] items-center gap-1.5 px-2 py-1 text-left text-[12px] ${active ? "bevel-in bg-[#bdbdbd] font-bold" : "btn95"}`}
              >
                <AppIcon id={id} size={13} className="shrink-0" />
                <span className="truncate">{titles[id] ?? id}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto shrink-0 bevel-in bg-panel px-3 py-1 font-mono text-[12px] tabular-nums text-ink">
          {clock ?? "--:--"}
        </div>
      </div>
    </div>
  );
}
