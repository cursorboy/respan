// Shared config validation, used by the client (gate the Run button, inline
// warnings) and the server route (reject bad requests with 400). No server-only
// imports, so it is safe in client bundles.

import {
  INPUT_PLACEHOLDER,
  MAX_CALLS,
  MAX_CASES,
  MAX_ENSEMBLE,
  MAX_VARIANTS,
  MIN_VARIANTS,
  type RunMode,
  type RunRequest,
  type VariantSpec,
} from "./types";
import { plannedCalls } from "./cost";

export function parseCases(text: string): { cases: string[]; truncated: boolean } {
  const all = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return { cases: all.slice(0, MAX_CASES), truncated: all.length > MAX_CASES };
}

export function variantMissingPlaceholder(prompt: string): boolean {
  return !prompt.includes(INPUT_PLACEHOLDER);
}

/** Single human-readable error if the run can't proceed, else null. */
export function validateRun(req: Partial<RunRequest>): string | null {
  const variants: VariantSpec[] = req.variants ?? [];
  const cases: string[] = req.cases ?? [];
  const judgeCriteria = (req.judgeCriteria ?? "").trim();
  const mode: RunMode = req.mode ?? "absolute";
  const ensemble = req.ensemble ?? 1;

  if (variants.length < MIN_VARIANTS) {
    return `Add at least ${MIN_VARIANTS} prompt variants to compare.`;
  }
  if (variants.length > MAX_VARIANTS) {
    return `At most ${MAX_VARIANTS} variants are allowed.`;
  }
  for (const v of variants) {
    if (!v.prompt.trim()) return `Variant "${v.name || v.id}" is empty.`;
    if (variantMissingPlaceholder(v.prompt)) {
      return `Variant "${v.name || v.id}" must include the ${INPUT_PLACEHOLDER} placeholder.`;
    }
  }
  if (cases.length < 1) return "Add at least one test case (one input per line).";
  if (cases.length > MAX_CASES) return `At most ${MAX_CASES} test cases are allowed.`;
  if (!judgeCriteria) return "Describe the judge criteria so outputs can be scored.";
  if (ensemble < 1 || ensemble > MAX_ENSEMBLE) {
    return `Ensemble size must be between 1 and ${MAX_ENSEMBLE}.`;
  }
  if (mode !== "absolute" && mode !== "arena") return "Unknown run mode.";

  const { total } = plannedCalls(mode, variants.length, cases.length, ensemble);
  if (total > MAX_CALLS) {
    return `This run needs ${total} model calls (cap ${MAX_CALLS}). Reduce variants, cases, or ensemble — or switch off arena mode.`;
  }
  return null;
}
