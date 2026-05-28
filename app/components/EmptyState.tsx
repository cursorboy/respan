"use client";

import { FlaskConical } from "lucide-react";
import { formatUsd, type RunEstimate } from "@/app/lib/cost";

interface Props {
  validationError: string | null;
  estimate: RunEstimate;
}

export function EmptyState({ validationError, estimate }: Props) {
  return (
    <div className="surface flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-panel/30 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel2 text-accent">
        <FlaskConical size={22} strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold text-ink">No run yet</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Define your prompt variants and a test set on the left, then run the experiment. Every
        variant is tried against every case, scored by an LLM judge, and ranked with confidence
        intervals as the matrix fills in live.
      </p>

      {validationError ? (
        <p className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {validationError}
        </p>
      ) : (
        <p className="mt-5 text-xs text-muted">
          Ready to run <span className="font-mono text-ink">{estimate.calls}</span> calls
          {" · "}~<span className="font-mono text-ink">{formatUsd(estimate.estUsd)}</span> est.
          {" · "}every call lands as a span in Respan
        </p>
      )}
    </div>
  );
}
