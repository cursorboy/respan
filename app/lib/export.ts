// Client-side export of a run's results to CSV (per-cell detail) and JSON (full dump).

import { cellKey, type AbsoluteResult, type ArenaResult, type CellKey, type MatrixCell, type RunMode, type VariantSpec } from "./types";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface ExportPayload {
  mode: RunMode;
  experimentId: string;
  model: string;
  variants: VariantSpec[];
  cases: string[];
  cells: Record<CellKey, MatrixCell>;
  result: ArenaResult | AbsoluteResult | null;
}

/** Per-cell detail CSV: one row per variant × case. */
export function buildCsv(p: ExportPayload): string {
  const header = [
    "variant",
    "case_index",
    "input",
    "output",
    p.mode === "arena" ? "win_rate" : "score",
    "gen_tokens",
    "gen_ms",
    "cached",
    "error",
  ];
  const rows: string[] = [header.join(",")];
  for (const v of p.variants) {
    for (let i = 0; i < p.cases.length; i++) {
      const c = p.cells[cellKey(v.id, i)];
      if (!c) continue;
      const metric = p.mode === "arena" ? (c.winRate != null ? c.winRate.toFixed(3) : "") : c.score ?? "";
      rows.push(
        [
          csvEscape(v.name),
          i + 1,
          csvEscape(p.cases[i]),
          csvEscape(c.output ?? ""),
          metric,
          c.genTokens ?? "",
          c.genLatencyMs ?? "",
          c.cached ? "yes" : "no",
          csvEscape(c.genError ?? c.scoreError ?? ""),
        ].join(","),
      );
    }
  }
  return rows.join("\n");
}

/** Full structured dump including the leaderboard. */
export function buildJson(p: ExportPayload): string {
  const cells = Object.entries(p.cells).map(([key, c]) => {
    const [variantId, caseIndex] = key.split(":");
    return { variantId, caseIndex: Number(caseIndex), ...c };
  });
  return JSON.stringify(
    {
      experimentId: p.experimentId,
      mode: p.mode,
      model: p.model,
      exportedAt: new Date().toISOString(),
      variants: p.variants,
      cases: p.cases,
      result: p.result,
      cells,
    },
    null,
    2,
  );
}

export function download(filename: string, content: string, mime: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(p: ExportPayload): void {
  download(`promptarena-${p.experimentId.slice(0, 8) || "run"}.csv`, buildCsv(p), "text/csv");
}

export function exportJson(p: ExportPayload): void {
  download(`promptarena-${p.experimentId.slice(0, 8) || "run"}.json`, buildJson(p), "application/json");
}
