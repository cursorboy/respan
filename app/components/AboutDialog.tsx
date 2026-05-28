"use client";

import { useEffect } from "react";
import { WinFlag } from "./WinFlag";

interface Props {
  open: boolean;
  experimentId: string;
  model?: string;
  mode: string;
  onClose: () => void;
}

export function AboutDialog({ open, experimentId, model, mode, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="win drawer-enter relative w-full max-w-md">
        <div className="win-title">
          <span>About PromptArena</span>
          <span className="win-controls" onPointerDown={(e) => e.stopPropagation()}>
            <button aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </span>
        </div>
        <div className="win-body">
          <div className="flex gap-4">
            <WinFlag size={56} className="shrink-0" />
            <div className="text-[13px] leading-relaxed text-ink">
              <p className="font-bold">PromptArena 95</p>
              <p className="mt-2 text-muted">
                A prompt-experiment workbench on the Respan gateway. Define variants, run them over a
                test set, and rank them — by an LLM judge (1–10) or a pairwise Bradley-Terry
                tournament with bootstrap confidence intervals.
              </p>
              <p className="mt-2 font-mono text-[11px] text-faint">
                mode: {mode} · model: {model ?? "—"}
              </p>
              {experimentId && (
                <p className="mt-1 font-mono text-[11px] text-faint">exp: {experimentId.slice(0, 18)}…</p>
              )}
              <p className="mt-3 text-[11px] text-faint">
                Every model call is a span in your Respan workspace. ⌘↵ runs an experiment.
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t-2 border-[#808080] pt-3">
            <button onClick={onClose} className="btn95 px-6 py-1 text-[13px]">
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
