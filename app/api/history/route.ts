// GET /api/history — recent runs with their leaderboards, for the
// score-over-time view. Reads from the local run history (node:sqlite).

import { listRuns } from "@/app/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ runs: listRuns(40) });
  } catch (err) {
    return Response.json(
      { runs: [], error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
