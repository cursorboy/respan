"use client";

import { Activity } from "lucide-react";
import { formatUsd } from "@/app/lib/cost";
import type { MetricsSnapshot } from "@/app/lib/types";
import { Sparkline } from "./Sparkline";
import { Window } from "./Window";

interface Props {
  latest: MetricsSnapshot | null;
  series: MetricsSnapshot[];
  running: boolean;
}

export function MetricsBar({ latest, series, running }: Props) {
  if (!latest) return null;
  const throughput = series.map((s) => s.throughput);
  const progress = latest.callsTotal > 0 ? latest.callsDone / latest.callsTotal : 0;

  return (
    <Window id="telemetry" title="telemetry.sys" defaultX={364} defaultY={304} w={620}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase text-faint">
          <Activity size={13} className="text-accent" strokeWidth={2} />
          {running && <span className="animate-pulse-run h-1.5 w-1.5 bg-accent" />}
          live
        </span>
        <span className="font-mono text-xs text-faint tnum">
          {latest.callsDone}/{latest.callsTotal} calls · {(latest.elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="mt-3 h-px w-full bg-line">
        <div
          className="h-px bg-accent transition-[width] duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <Stat label="throughput" value={`${latest.throughput.toFixed(1)}/s`} />
        <Stat label="in flight" value={String(latest.inFlight)} />
        <Stat label="p50" value={`${latest.p50}ms`} />
        <Stat label="p95" value={`${latest.p95}ms`} />
        <Stat label="tokens" value={compact(latest.tokens)} />
        <Stat label="cost" value={formatUsd(latest.costUsd)} />
        <Stat label="cache" value={String(latest.cacheHits)} tone="good" />
        <Stat label="retries" value={String(latest.retries)} tone={latest.retries ? "warn" : undefined} />
        <Stat label="errors" value={String(latest.errors)} tone={latest.errors ? "bad" : undefined} />
        <div className="ml-auto self-end">
          <Sparkline values={throughput} color="var(--color-accent-glow)" width={130} height={30} />
        </div>
      </div>
    </Window>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-600" : "text-ink";
  return (
    <div>
      <div className={`font-mono text-lg font-medium tnum ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-faint">{label}</div>
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
