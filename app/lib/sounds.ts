// Tiny synthesized sound effects via the Web Audio API. No external assets
// (keeps the deploy lean) — every sound is a few oscillator nodes scheduled in
// the future. All entry points are no-ops on the server and degrade silently
// if AudioContext is unavailable or user gesture hasn't unlocked it.
"use client";

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  // Some browsers start the context in a "suspended" state until the first
  // user gesture; this resume is a no-op once it's running.
  ctx.resume().catch(() => undefined);
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
}

function note(freq: number, durMs: number, delayMs = 0, type: OscillatorType = "sine", gain = 0.12) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.05);
}

/** Classic ascending startup chime (C-E-G-C arpeggio). */
export function playStartup() {
  note(523.25, 350, 0, "triangle", 0.1);
  note(659.25, 350, 120, "triangle", 0.1);
  note(783.99, 400, 240, "triangle", 0.12);
  note(1046.5, 700, 380, "triangle", 0.14);
}

/** Ta-da! — for Minesweeper wins. Two ascending chord hits. */
export function playWin() {
  [523.25, 659.25, 783.99].forEach((f) => note(f, 220, 0, "triangle", 0.09));
  [659.25, 783.99, 1046.5].forEach((f) => note(f, 520, 200, "triangle", 0.12));
}

/** Descending error chime. */
export function playError() {
  note(523.25, 260, 0, "square", 0.07);
  note(415.3, 260, 130, "square", 0.07);
  note(329.63, 320, 260, "square", 0.08);
}

/** Tiny click for icon double-press, taskbar buttons, etc. */
export function playClick() {
  note(1800, 50, 0, "square", 0.04);
}
