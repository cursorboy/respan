"use client";

import { useMemo } from "react";
import { Crown } from "lucide-react";
import type { AbsoluteResult, ArenaResult, RunMode, VariantSpec } from "@/app/lib/types";
import { WinMatrix } from "./WinMatrix";
import { PromoteButton } from "./PromoteButton";
import { CountUp } from "./CountUp";
import { Window } from "./Window";

interface Props {
  mode: RunMode;
  variants: VariantSpec[];
  result: ArenaResult | AbsoluteResult | null;
  model?: string;
}

interface Row {
  variantId: string;
  name: string;
  variantModel?: string;
  value: number;
  ciLow: number;
  ciHigh: number;
  pRank1?: number;
  winRate?: number;
}

export function Leaderboard({ mode, variants, result, model }: Props) {
  const rows = useMemo<Row[]>(() => {
    if (!result) return [];
    const lookup = (id: string) => variants.find((v) => v.id === id);
    const baseOf = (id: string) => {
      const v = lookup(id);
      return { name: v?.name ?? id, variantModel: v?.model?.trim() || undefined };
    };
    if (result.mode === "arena") {
      return [...result.ratings]
        .sort((a, b) => b.rating - a.rating)
        .map((r) => ({ variantId: r.variantId, ...baseOf(r.variantId), value: r.rating, ciLow: r.ciLow, ciHigh: r.ciHigh, pRank1: r.pRank1, winRate: r.winRate }));
    }
    return [...result.means]
      .sort((a, b) => b.mean - a.mean)
      .map((m) => ({ variantId: m.variantId, ...baseOf(m.variantId), value: m.mean, ciLow: m.ciLow, ciHigh: m.ciHigh }));
  }, [result, variants]);

  if (!result || rows.length === 0) return null;

  const domainMin = Math.min(...rows.map((r) => r.ciLow));
  const domainMax = Math.max(...rows.map((r) => r.ciHigh));
  const pad = (domainMax - domainMin) * 0.1 || 1;
  const lo = domainMin - pad;
  const hi = domainMax + pad;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const fmt = (v: number) => (mode === "arena" ? String(Math.round(v)) : v.toFixed(1));
  const winner = rows[0];

  return (
    <Window id="leaderboard" title="leaderboard" defaultX={364} defaultY={486} w={620}>
      <div className="flex items-baseline justify-end">
        <span className="font-mono text-[11px] text-faint">
          {mode === "arena" ? "Bradley-Terry rating" : "mean score"} · 95% CI
        </span>
      </div>

      <div className="mt-1 divide-y divide-line">
        {rows.map((row, rank) => (
          <div
            key={row.variantId}
            className="relative py-4"
            style={{ animation: "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards", animationDelay: `${rank * 80}ms` }}
          >
            {rank === 0 && <span className="animate-bar-grow absolute -left-3 top-3 bottom-3 w-[3px] rounded-full bg-accent" />}
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-4 font-mono text-xs text-faint tnum">{rank + 1}</span>
                {rank === 0 && <Crown size={15} className="shrink-0 text-accent" strokeWidth={2} />}
                <span className="truncate text-[15px] font-medium text-ink">{row.name}</span>
                {row.variantModel && (
                  <span
                    title="Per-variant model override (routed through Respan)"
                    className="chip95 shrink-0 px-1.5 py-0.5 font-mono text-[10px] text-accent-glow"
                  >
                    {row.variantModel}
                  </span>
                )}
                {mode === "arena" && typeof row.winRate === "number" && (
                  <span className="shrink-0 font-mono text-[11px] text-faint tnum">{Math.round(row.winRate * 100)}% wins</span>
                )}
              </div>
              <CountUp
                value={row.value}
                decimals={mode === "arena" ? 0 : 1}
                className="font-mono text-2xl font-semibold tnum md:text-[28px]"
                style={{ color: rank === 0 ? "var(--color-accent)" : "var(--color-ink)" }}
              />
            </div>

            <div className="mt-2.5 flex items-center gap-3 pl-[26px]">
              <div className="relative h-3.5 flex-1">
                <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line2" />
                <div
                  className="animate-ci-grow absolute h-[5px] rounded-full"
                  style={{
                    left: `${pct(row.ciLow)}%`,
                    width: `${Math.max(0.5, pct(row.ciHigh) - pct(row.ciLow))}%`,
                    top: "calc(50% - 2.5px)",
                    background: rank === 0 ? "var(--color-accent)" : "var(--color-line2)",
                    opacity: rank === 0 ? 0.6 : 0.9,
                  }}
                />
                <div
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
                  style={{ left: `${pct(row.value)}%`, background: rank === 0 ? "var(--color-accent)" : "var(--color-muted)" }}
                />
              </div>
              <span className="shrink-0 font-mono text-[11px] text-faint tnum">
                [{fmt(row.ciLow)}, {fmt(row.ciHigh)}]
                {mode === "arena" && typeof row.pRank1 === "number" && <> · P#1 {Math.round(row.pRank1 * 100)}%</>}
              </span>
            </div>
          </div>
        ))}
      </div>

      {result.mode === "arena" && (
        <div className="mt-6">
          <WinMatrix variants={variants} ids={result.ids} pairwise={result.pairwise} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[13px] text-muted">Ship the leader: deploy it as a managed Respan prompt.</span>
        <PromoteButton
          name={winner.name}
          promptText={variants.find((v) => v.id === winner.variantId)?.prompt ?? ""}
          model={winner.variantModel ?? model}
        />
      </div>
    </Window>
  );
}
