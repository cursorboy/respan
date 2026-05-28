"use client";

import { useEffect } from "react";
import { Play, Square, RotateCw } from "lucide-react";
import { formatUsd, type RunEstimate } from "@/app/lib/cost";

interface Props {
  estimate: RunEstimate;
  running: boolean;
  validationError: string | null;
  hasResults: boolean;
  onRun: () => void;
  onCancel: () => void;
}

export function RunControls({ estimate, running, validationError, hasResults, onRun, onCancel }: Props) {
  const canRun = !running && !validationError;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canRun) {
        e.preventDefault();
        onRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canRun, onRun]);

  return (
    <div className="border-t-2 border-[#808080] pt-3">
      <div className="mb-2.5 flex items-baseline justify-between text-xs">
        <span className="text-muted">
          <span className="font-mono text-ink tnum">{estimate.calls}</span> model calls
        </span>
        <span className="text-muted">
          ~<span className="font-mono text-ink tnum">{formatUsd(estimate.estUsd)}</span> est.
        </span>
      </div>

      {running ? (
        <button
          onClick={onCancel}
          className="btn95 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] text-[var(--color-bad)]"
        >
          <Square size={14} strokeWidth={2} fill="currentColor" />
          Cancel run
        </button>
      ) : (
        <button
          onClick={onRun}
          disabled={!canRun}
          className="btn95 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasResults ? <RotateCw size={15} strokeWidth={2.5} /> : <Play size={15} strokeWidth={2.5} fill="currentColor" />}
          {hasResults ? "Run again" : "Run experiment"}
          <span className="font-mono text-[11px] font-normal opacity-70">⌘↵</span>
        </button>
      )}

      {validationError && !running && (
        <p className="mt-2 text-center text-[11px] text-amber-700">{validationError}</p>
      )}
    </div>
  );
}
