"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface WinState {
  x: number;
  y: number;
  z: number;
  w: number;
  min: boolean;
  max: boolean;
}

interface DesktopValue {
  windows: Record<string, WinState>;
  order: string[];
  titles: Record<string, string>;
  topId: string | null;
  floating: boolean;
  register: (id: string, x: number, y: number, w: number) => void;
  unregister: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  setMin: (id: string, v: boolean) => void;
  toggleMax: (id: string) => void;
}

const Ctx = createContext<DesktopValue | null>(null);

// Keep a window inside the visible desktop. The desktop is the relatively-
// positioned <main> (max-width 1500, horizontally padded), so clamp x into that
// content box and y into the viewport height so the title bar is always reachable.
function clampPos(x: number, y: number, w: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x, y };
  const contentW = Math.min(1500, window.innerWidth) - 16;
  const maxX = Math.max(8, contentW - w - 8);
  const maxY = Math.max(8, window.innerHeight - 140);
  return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
}

export function useDesktop(): DesktopValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDesktop must be used within DesktopProvider");
  return c;
}

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<Record<string, WinState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [floating, setFloating] = useState(true);
  const zRef = useRef(10);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setFloating(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const register = useCallback((id: string, x: number, y: number, w: number) => {
    setWindows((prev) => {
      if (prev[id]) return prev;
      zRef.current += 1;
      const p = clampPos(x, y, w);
      return { ...prev, [id]: { x: p.x, y: p.y, w, z: zRef.current, min: false, max: false } };
    });
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  // Pull any off-screen windows back into view when the viewport shrinks.
  useEffect(() => {
    const onResize = () =>
      setWindows((prev) => {
        let changed = false;
        const next: Record<string, WinState> = { ...prev };
        for (const id in prev) {
          const win = prev[id];
          const p = clampPos(win.x, win.y, win.w);
          if (p.x !== win.x || p.y !== win.y) {
            next[id] = { ...win, x: p.x, y: p.y };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const unregister = useCallback((id: string) => {
    setWindows((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  const setTitle = useCallback((id: string, title: string) => {
    setTitles((prev) => (prev[id] === title ? prev : { ...prev, [id]: title }));
  }, []);

  const focus = useCallback(
    (id: string) =>
      setWindows((prev) => {
        if (!prev[id]) return prev;
        zRef.current += 1;
        return { ...prev, [id]: { ...prev[id], z: zRef.current } };
      }),
    [],
  );
  const move = useCallback(
    (id: string, x: number, y: number) =>
      setWindows((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], x: Math.max(0, x), y: Math.max(0, y) } } : prev)),
    [],
  );
  const setMin = useCallback(
    (id: string, v: boolean) => setWindows((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], min: v } } : prev)),
    [],
  );
  const toggleMax = useCallback(
    (id: string) => setWindows((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], max: !prev[id].max } } : prev)),
    [],
  );

  const topId = useMemo(() => {
    let top: string | null = null;
    let z = -1;
    for (const id of order) {
      const w = windows[id];
      if (w && !w.min && w.z > z) {
        z = w.z;
        top = id;
      }
    }
    return top;
  }, [windows, order]);

  const value = useMemo(
    () => ({ windows, order, titles, topId, floating, register, unregister, setTitle, focus, move, setMin, toggleMax }),
    [windows, order, titles, topId, floating, register, unregister, setTitle, focus, move, setMin, toggleMax],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
