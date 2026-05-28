"use client";

import { Crown } from "lucide-react";
import type { AbsoluteResult, ArenaResult, RunMode, VariantSpec } from "@/app/lib/types";
import { formatUsd, type RunEstimate } from "@/app/lib/cost";
import { CountUp } from "./CountUp";
import { Window } from "./Window";

interface Props {
  mode: RunMode;
  result: ArenaResult | AbsoluteResult | null;
  running: boolean;
  variants: VariantSpec[];
  estimate: RunEstimate;
  validationError: string | null;
}

interface Ranked {
  name: string;
  value: number;
  ciLow: number;
  ciHigh: number;
  pRank1?: number;
}

export function Verdict({ mode, result, running, variants, estimate, validationError }: Props) {
  const nameOf = (id: string) => variants.find((v) => v.id === id)?.name ?? id;

  if (running && !result) {
    return (
      <Window id="verdict" title="result.exe" defaultX={364} defaultY={12} w={620} bodyClassName="win-body min-h-[200px]">
        <p className="font-mono text-xs uppercase tracking-wide text-faint">Running the {mode}…</p>
        <h1 className="display mt-3 text-2xl text-ink md:text-3xl">Finding the winner</h1>
        <p className="mt-4 max-w-md font-mono text-[13px] leading-relaxed text-muted">
          Generating every output and {mode === "arena" ? "running head-to-head battles" : "scoring each one"}. Results
          resolve below as they land.
        </p>
      </Window>
    );
  }

  if (!result) {
    return (
      <Window id="verdict" title="welcome.exe" defaultX={364} defaultY={12} w={620} bodyClassName="win-body min-h-[260px]">
        <h1 className="display text-3xl text-ink md:text-[2.6rem]">Which prompt wins?</h1>
        <p className="mt-5 max-w-md font-mono text-[13px] leading-relaxed text-muted">
          Define your variants and a test set, then run the {mode === "arena" ? "arena" : "evaluation"}. Every output is
          judged and the variants are ranked with confidence intervals.
        </p>
        {validationError ? (
          <p className="bevel-in mt-6 inline-block bg-white px-3 py-1.5 font-mono text-xs text-[var(--color-bad)]">
            {validationError}
          </p>
        ) : (
          <p className="mt-6 font-mono text-xs text-faint">
            {estimate.calls} calls · ~{formatUsd(estimate.estUsd)} · every call a span in Respan
          </p>
        )}
      </Window>
    );
  }

  const rows: Ranked[] =
    result.mode === "arena"
      ? [...result.ratings]
          .sort((a, b) => b.rating - a.rating)
          .map((r) => ({ name: nameOf(r.variantId), value: r.rating, ciLow: r.ciLow, ciHigh: r.ciHigh, pRank1: r.pRank1 }))
      : [...result.means]
          .sort((a, b) => b.mean - a.mean)
          .map((m) => ({ name: nameOf(m.variantId), value: m.mean, ciLow: m.ciLow, ciHigh: m.ciHigh }));

  const winner = rows[0];
  const runner = rows[1];
  const isArena = result.mode === "arena";
  const unit = isArena ? "Elo" : "pts";
  const delta = runner ? winner.value - runner.value : 0;
  const confident = runner ? (isArena ? (winner.pRank1 ?? 0) >= 0.9 : winner.ciLow > runner.ciHigh) : true;
  const deltaStr = isArena ? Math.round(delta).toString() : delta.toFixed(1);

  return (
    <Window id="verdict" title="result.exe" defaultX={364} defaultY={12} w={620}>
      <p className="font-mono text-xs uppercase tracking-wide text-faint">Winner</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="display flex items-center gap-3 text-3xl text-ink md:text-[2.6rem]">
          <Crown className="text-accent" size={28} strokeWidth={2.5} />
          {winner.name}
        </h1>
        <CountUp
          value={winner.value}
          decimals={isArena ? 0 : 1}
          className="font-mono text-3xl font-bold text-accent tnum md:text-4xl"
        />
      </div>
      <p className="mt-5 max-w-2xl font-mono text-[13px] leading-relaxed text-muted">
        {!runner ? (
          <>the only ranked variant.</>
        ) : confident ? (
          <>
            leads <span className="font-semibold text-ink">{runner.name}</span> by{" "}
            <span className="font-semibold text-ink tnum">{deltaStr}</span> {unit}
            {isArena && typeof winner.pRank1 === "number" && (
              <>
                {" · "}
                <span className="font-semibold text-accent tnum">{Math.round(winner.pRank1 * 100)}%</span> sure it&apos;s #1
              </>
            )}
            .
          </>
        ) : (
          <>
            edges <span className="font-semibold text-ink">{runner.name}</span> by{" "}
            <span className="font-semibold tnum">{deltaStr}</span> {unit}, but the lead is{" "}
            <span className="font-semibold text-[var(--color-warn)]">within noise</span> — run more cases.
          </>
        )}
      </p>
    </Window>
  );
}
