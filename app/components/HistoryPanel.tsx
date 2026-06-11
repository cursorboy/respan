"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import type { PersistedRun, RunMode } from "@/app/lib/types";
import { formatUsd } from "@/app/lib/cost";
import { Sparkline } from "./Sparkline";
import { Window } from "./Window";

interface Props {
  mode: RunMode;
  refreshKey: number;
  defaultMin?: boolean;
}

export function HistoryPanel({ mode, refreshKey, defaultMin }: Props) {
  const [runs, setRuns] = useState<PersistedRun[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRuns(Array.isArray(d.runs) ? d.runs : []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Per-variant-name metric series for the current mode (oldest → newest).
  const series = useMemo(() => {
    const modeRuns = runs.filter((r) => r.mode === mode).slice().reverse();
    const byName = new Map<string, number[]>();
    for (const run of modeRuns) {
      for (const v of run.variants) {
        if (!byName.has(v.name)) byName.set(v.name, []);
        byName.get(v.name)!.push(v.metric);
      }
    }
    return [...byName.entries()].filter(([, vals]) => vals.length >= 2).slice(0, 6);
  }, [runs, mode]);

  // Always render the window (so it's reachable from the taskbar / Start menu
  // even on a fresh Vercel deploy where /tmp is empty). Empty + loading states
  // show a friendly placeholder instead of unmounting.
  return (
    <Window id="history" title="history.log" defaultX={1000} defaultY={470} w={444} defaultMin={defaultMin}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[11px] text-faint">
          {loaded ? `${runs.length} run${runs.length === 1 ? "" : "s"}` : "loading…"}
        </span>
        <span className="font-mono text-[11px] text-faint">{mode === "arena" ? "rating" : "mean score"} over time</span>
      </div>

      {loaded && runs.length === 0 && (
        <div className="bevel-in flex flex-col items-center gap-1 bg-panel2/60 px-4 py-6 text-center">
          <p className="text-[12px] font-bold text-ink">No runs yet.</p>
          <p className="text-[11px] text-faint">
            Kick off an experiment from <span className="font-mono">setup.cfg</span> — every run lands here.
          </p>
        </div>
      )}

      {series.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {series.map(([name, vals]) => {
            const last = vals[vals.length - 1];
            const prev = vals[vals.length - 2];
            const delta = last - prev;
            return (
              <div key={name} className="rounded-lg bg-panel2/40 p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-ink" title={name}>{name}</span>
                  <span className={`flex items-center gap-0.5 font-mono text-[10px] ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(mode === "arena" ? Math.round(delta) : Number(delta.toFixed(1)))}
                  </span>
                </div>
                <Sparkline values={vals} width={140} height={28} animate />
              </div>
            );
          })}
        </div>
      )}

      <div className="divide-y divide-line">
        {runs.slice(0, 6).map((run) => (
          <div key={run.id} className="flex items-center gap-3 py-2 text-xs">
            <span className="text-faint">{timeAgo(run.createdAt)}</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${run.mode === "arena" ? "bg-accent/15 text-accent" : "bg-line2/40 text-muted"}`}>
              {run.mode}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-ink" title={run.winnerName ?? ""}>
              <Trophy size={12} className="shrink-0 text-accent" strokeWidth={2} />
              <span className="truncate">{run.winnerName ?? "—"}</span>
            </span>
            <span className="font-mono text-faint tnum">{formatUsd(run.costUsd)}</span>
          </div>
        ))}
      </div>
    </Window>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
