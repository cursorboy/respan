"use client";

import { cellKey, type CellKey, type MatrixCell, type RunMode, type VariantSpec } from "@/app/lib/types";
import { Cell } from "./Cell";
import { Window } from "./Window";

interface Props {
  mode: RunMode;
  variants: VariantSpec[];
  cases: string[];
  cells: Record<CellKey, MatrixCell>;
  selected: CellKey | null;
  onSelect: (key: CellKey) => void;
}

export function Matrix({ mode, variants, cases, cells, selected, onSelect }: Props) {
  const gridTemplateColumns = `minmax(120px, 160px) repeat(${cases.length}, minmax(52px, 92px))`;

  return (
    <Window id="results" title="results.dat" defaultX={1000} defaultY={12} w={444}>
      <div className="mb-3 flex items-baseline justify-end">
        <span className="font-mono text-[11px] text-faint">
          {mode === "arena" ? "per-case win rate · " : ""}click a cell for detail
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-fit gap-1.5" style={{ gridTemplateColumns }}>
          <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
            variant ╲ case
          </div>
          {cases.map((input, i) => (
            <div key={i} title={input} className="truncate px-1 pb-1 text-center font-mono text-[11px] text-muted">
              {i + 1}
            </div>
          ))}

          {variants.map((variant, vi) => (
            <Row
              key={variant.id}
              mode={mode}
              variant={variant}
              index={vi}
              cases={cases}
              cells={cells}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </Window>
  );
}

function Row({
  mode,
  variant,
  index,
  cases,
  cells,
  selected,
  onSelect,
}: {
  mode: RunMode;
  variant: VariantSpec;
  index: number;
  cases: string[];
  cells: Record<CellKey, MatrixCell>;
  selected: CellKey | null;
  onSelect: (key: CellKey) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 overflow-hidden pr-1">
        <span className="chip95 flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[11px] font-bold text-accent">
          {String.fromCharCode(65 + index)}
        </span>
        <span className="truncate text-[13px] text-ink" title={variant.name}>
          {variant.name}
        </span>
      </div>
      {cases.map((_, ci) => {
        const key = cellKey(variant.id, ci);
        return (
          <Cell
            key={key}
            mode={mode}
            cell={cells[key]}
            selected={selected === key}
            onClick={() => onSelect(key)}
          />
        );
      })}
    </>
  );
}
