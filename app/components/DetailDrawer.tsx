"use client";

import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import type { MatrixCell, RunMode } from "@/app/lib/types";
import { formatUsd, usdFromTokens } from "@/app/lib/cost";
import { scoreColor } from "@/app/lib/score";
import { respanDashboardUrl } from "@/app/lib/dashboard";

interface Props {
  mode: RunMode;
  cell: MatrixCell | null;
  variantName: string;
  variantId?: string;
  caseIndex: number;
  caseInput: string;
  pricePer1k: number;
  experimentId?: string;
  dashboardUrl?: string;
  onClose: () => void;
}

export function DetailDrawer({
  mode,
  cell,
  variantName,
  variantId,
  caseIndex,
  caseInput,
  pricePer1k,
  experimentId,
  dashboardUrl,
  onClose,
}: Props) {
  const open = cell != null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !cell) return null;

  const tokens = (cell.judgeTokens ?? 0);
  const errored = cell.genStatus === "error" || cell.scoreStatus === "error";

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="drawer-enter relative flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{variantName}</div>
            <div className="mt-0.5 font-mono text-xs text-muted">case {caseIndex + 1}</div>
          </div>
          <div className="flex items-center gap-3">
            {mode === "absolute" && typeof cell.score === "number" && (
              <span className="font-mono text-2xl font-semibold leading-none" style={{ color: scoreColor(Math.min(10, cell.score + 1)) }}>
                {Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)}
                <span className="text-sm text-muted">/10</span>
              </span>
            )}
            {mode === "arena" && typeof cell.winRate === "number" && (
              <span className="font-mono text-2xl font-semibold leading-none" style={{ color: scoreColor(cell.winRate * 9 + 2) }}>
                {Math.round(cell.winRate * 100)}%
              </span>
            )}
            {dashboardUrl && experimentId && (
              <a
                href={respanDashboardUrl({ base: dashboardUrl, experimentId, variant: variantId, caseIndex })}
                target="_blank"
                rel="noopener noreferrer"
                title="Open this exact span in the Respan dashboard"
                className="chip95 flex items-center gap-1 px-1.5 py-1 font-mono text-[11px] text-accent-glow active:translate-y-px"
              >
                <ExternalLink size={11} strokeWidth={2.5} /> Respan
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line2 hover:text-ink"
            >
              esc
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Field label="Input">
            <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] text-ink/90">{caseInput}</pre>
          </Field>

          {cell.genStatus === "error" ? (
            <Field label="Generation error">
              <pre className="whitespace-pre-wrap break-words rounded-md border border-red-200 bg-red-50 p-3 font-mono text-[12.5px] text-red-700">
                {cell.genError}
              </pre>
            </Field>
          ) : (
            <Field label={cell.cached ? "Output (cached)" : "Output"}>
              <pre className="whitespace-pre-wrap break-words rounded-md border border-line bg-bg/50 p-3 font-mono text-[12.5px] text-ink/90">
                {cell.output || "—"}
              </pre>
            </Field>
          )}

          {mode === "absolute" && cell.scoreStatus === "error" && (
            <Field label="Judge error">
              <pre className="whitespace-pre-wrap break-words rounded-md border border-red-200 bg-red-50 p-3 font-mono text-[12.5px] text-red-700">
                {cell.scoreError}
              </pre>
            </Field>
          )}

          {mode === "absolute" && cell.reason && (
            <Field label={`Judge rationale${cell.samples && cell.samples > 1 ? ` · ${cell.samples} samples` : ""}`}>
              <p className="rounded-md border border-line bg-bg/50 p-3 text-[13px] leading-relaxed text-ink/85">{cell.reason}</p>
              {cell.samples && cell.samples > 1 && (
                <p className="mt-1 font-mono text-[11px] text-muted">judge disagreement σ = {(cell.stddev ?? 0).toFixed(2)}</p>
              )}
            </Field>
          )}

          {mode === "arena" && typeof cell.winRate === "number" && (
            <Field label="Arena record">
              <p className="rounded-md border border-line bg-bg/50 p-3 text-[13px] leading-relaxed text-ink/85">
                This output won{" "}
                <span className="font-mono text-ink">{Math.round(cell.winRate * 100)}%</span> of its head-to-head
                battles for this case. Overall ranking is on the leaderboard.
              </p>
            </Field>
          )}

          {!errored && (
            <Field label="Metrics">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="gen latency" value={`${cell.genLatencyMs ?? 0}ms`} />
                <Stat label="gen tokens" value={String(cell.genTokens ?? 0)} />
                {mode === "absolute" && <Stat label="judge latency" value={`${cell.judgeLatencyMs ?? 0}ms`} />}
                {mode === "absolute" && <Stat label="judge tokens" value={String(tokens)} />}
                <Stat label="gen cost" value={formatUsd(usdFromTokens(cell.genTokens ?? 0, pricePer1k))} />
              </div>
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[12px] font-medium text-faint">{label}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-bg/40 px-3 py-2">
      <div className="font-mono text-sm text-ink tnum">{value}</div>
      <div className="mt-0.5 text-[10px] text-faint">{label}</div>
    </div>
  );
}
