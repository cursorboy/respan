"use client";

import type { VariantSpec } from "@/app/lib/types";
import { scoreColor, scoreTint } from "@/app/lib/score";

interface Props {
  variants: VariantSpec[];
  ids: string[];
  /** pairwise[i][j] = P(i beats j); null on the diagonal. */
  pairwise: (number | null)[][];
}

// Head-to-head win-rate heatmap: cell (row i, col j) = how often i beat j.
export function WinMatrix({ variants, ids, pairwise }: Props) {
  const labelFor = (id: string) => {
    const idx = variants.findIndex((v) => v.id === id);
    return idx >= 0 ? String.fromCharCode(65 + idx) : id.slice(0, 2);
  };
  const cols = `28px repeat(${ids.length}, minmax(34px, 52px))`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[13px] font-medium text-muted">Head-to-head win rate</h3>
        <span className="text-[11px] text-faint">row beats column</span>
      </div>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: cols }}>
        <div />
        {ids.map((id) => (
          <div key={`h-${id}`} className="text-center font-mono text-[11px] text-muted">
            {labelFor(id)}
          </div>
        ))}
        {ids.map((rowId, i) => (
          <Row key={rowId} label={labelFor(rowId)} row={pairwise[i] ?? []} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, row }: { label: string; row: (number | null)[] }) {
  return (
    <>
      <div className="flex items-center justify-center font-mono text-[11px] text-muted">{label}</div>
      {row.map((v, j) => {
        if (v === null || Number.isNaN(v as number)) {
          return <div key={j} className="flex aspect-square items-center justify-center rounded bg-panel2 text-[10px] text-faint">—</div>;
        }
        const s = v * 9 + 1;
        return (
          <div
            key={j}
            className="flex aspect-square items-center justify-center rounded font-mono text-[10px] tnum"
            style={{ background: scoreTint(s), color: scoreColor(s) }}
            title={`${Math.round(v * 100)}%`}
          >
            {Math.round(v * 100)}
          </div>
        );
      })}
    </>
  );
}
