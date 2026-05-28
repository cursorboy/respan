"use client";

import type { MatrixCell, RunMode } from "@/app/lib/types";
import { scoreBorder, scoreColor, scoreTint } from "@/app/lib/score";

interface Props {
  mode: RunMode;
  cell: MatrixCell | undefined;
  selected: boolean;
  onClick: () => void;
}

export function Cell({ mode, cell, selected, onClick }: Props) {
  const ring = selected ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : "";

  // Errors first.
  if (cell?.genStatus === "error" || cell?.scoreStatus === "error") {
    return (
      <button
        onClick={onClick}
        title={cell.genError ?? cell.scoreError}
        className={`flex aspect-square flex-col items-center justify-center rounded-md border border-red-200 bg-red-50 transition-transform hover:-translate-y-0.5 ${ring}`}
      >
        <span className="text-base text-red-600">!</span>
      </button>
    );
  }

  // Arena: color by win rate once the result lands.
  if (mode === "arena" && typeof cell?.winRate === "number") {
    const s = cell.winRate * 9 + 1; // 0..1 -> 1..10 for the color ramp
    return (
      <button
        onClick={onClick}
        className={`animate-cell-pop group relative flex aspect-square flex-col items-center justify-center rounded-md border transition-transform hover:-translate-y-0.5 ${ring}`}
        style={{ background: scoreTint(s), borderColor: scoreBorder(s) }}
        title="View output and battle record"
      >
        <span className="font-mono text-lg font-semibold leading-none" style={{ color: scoreColor(Math.min(10, s + 1)) }}>
          {Math.round(cell.winRate * 100)}%
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted">win</span>
      </button>
    );
  }

  // Absolute: color by score.
  if (mode === "absolute" && typeof cell?.score === "number") {
    const totalMs = (cell.judgeLatencyMs ?? 0);
    const label = Number.isInteger(cell.score) ? String(cell.score) : cell.score.toFixed(1);
    return (
      <button
        onClick={onClick}
        className={`animate-cell-pop group relative flex aspect-square flex-col items-center justify-center rounded-md border transition-transform hover:-translate-y-0.5 ${ring}`}
        style={{ background: scoreTint(cell.score), borderColor: scoreBorder(cell.score) }}
        title="View output and judge rationale"
      >
        <span className="font-mono text-xl font-semibold leading-none" style={{ color: scoreColor(Math.min(10, cell.score + 1)) }}>
          {label}
        </span>
        {cell.samples && cell.samples > 1 ? (
          <span className="mt-0.5 font-mono text-[9px] text-muted">±{(cell.stddev ?? 0).toFixed(1)}</span>
        ) : (
          <span className="mt-0.5 font-mono text-[9px] text-muted">{totalMs}ms</span>
        )}
      </button>
    );
  }

  // Judging / battling in progress.
  if (cell?.scoreStatus === "running") {
    return (
      <button
        onClick={onClick}
        className={`flex aspect-square items-center justify-center rounded-md border border-accent/30 bg-accent/5 ${ring}`}
        title="judging…"
      >
        <span className="animate-pulse-run font-mono text-[10px] text-accent">judging</span>
      </button>
    );
  }

  // Generated, awaiting evaluation (arena before battles resolve).
  if (cell?.genStatus === "done") {
    return (
      <button
        onClick={onClick}
        className={`flex aspect-square items-center justify-center rounded-md border border-line2 bg-panel2/60 transition-transform hover:-translate-y-0.5 ${ring}`}
        title="Generated — awaiting evaluation"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
      </button>
    );
  }

  if (cell?.genStatus === "running") {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md border border-accent/30 bg-accent/5">
        <span className="animate-pulse-run h-2 w-2 rounded-full bg-accent-glow" />
      </div>
    );
  }

  // pending / idle
  return (
    <div className="flex aspect-square items-center justify-center rounded-md border border-line bg-panel2/40">
      <span className="animate-pulse-run h-1.5 w-1.5 rounded-full bg-line2" />
    </div>
  );
}
