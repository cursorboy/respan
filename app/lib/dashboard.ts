// Pure URL-building helper for Respan dashboard deep links. Lives outside
// respan.ts because that file is server-only; this is safe in client bundles.

export interface DashboardLinkOpts {
  /** Base URL of the dashboard, no trailing slash (env-configurable). */
  base: string;
  experimentId?: string;
  variant?: string;
  caseIndex?: number;
}

/**
 * Builds a /logs link pre-loaded with the span's metadata. The exact filter
 * shape varies by dashboard version — the env var `RESPAN_DASHBOARD_URL` can
 * override the base, and these params live on the URL whether the dashboard
 * auto-applies them or the user reads them off and pastes into the filter UI.
 */
export function respanDashboardUrl(opts: DashboardLinkOpts): string {
  const qs = new URLSearchParams();
  if (opts.experimentId) qs.set("experiment_id", opts.experimentId);
  if (opts.variant) qs.set("variant", opts.variant);
  if (typeof opts.caseIndex === "number") qs.set("case_index", String(opts.caseIndex));
  const q = qs.toString();
  return q ? `${opts.base}/logs?${q}` : `${opts.base}/logs`;
}
