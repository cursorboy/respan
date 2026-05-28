// Run-history persistence using Node 24's built-in SQLite (node:sqlite) — a real
// typed SQL layer with zero native-module dependency. For a serverless deploy
// you'd point this at Postgres/Turso; the repository functions below are the only
// thing that would change.

import "server-only";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PersistedRun, PersistedVariant, RunMode } from "./types";

export type { PersistedRun, PersistedVariant } from "./types";

// node:sqlite is built into Node 22.5+/24 but may be flag-gated on some
// runtimes. Load it lazily and degrade gracefully (persistence becomes a no-op)
// rather than crashing the run route if it isn't available.
type DatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): { run(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown };
};
const requireFn = createRequire(import.meta.url);
let SqliteCtor: (new (path: string) => DatabaseSync) | null = null;
let sqliteUnavailable = false;

function loadSqlite(): (new (path: string) => DatabaseSync) | null {
  if (SqliteCtor || sqliteUnavailable) return SqliteCtor;
  try {
    SqliteCtor = requireFn("node:sqlite").DatabaseSync;
  } catch {
    sqliteUnavailable = true;
  }
  return SqliteCtor;
}

// Serverless filesystems are read-only except /tmp (ephemeral). Locally we use
// a persistent ./.data file. Durable cross-instance history would point this at
// Postgres/Turso — only this module changes.
const DB_PATH =
  process.env.PROMPTARENA_DB ||
  (process.env.VERCEL ? "/tmp/promptarena.db" : `${process.cwd()}/.data/promptarena.db`);

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync | null {
  if (db) return db;
  const Ctor = loadSqlite();
  if (!Ctor) return null;
  let instance: DatabaseSync;
  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    instance = new Ctor(DB_PATH);
  } catch {
    sqliteUnavailable = true;
    return null;
  }
  instance.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      mode TEXT NOT NULL,
      model TEXT NOT NULL,
      judge_criteria TEXT NOT NULL,
      ensemble INTEGER NOT NULL,
      variant_count INTEGER NOT NULL,
      case_count INTEGER NOT NULL,
      total_calls INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      winner_name TEXT,
      winner_metric REAL
    );
    CREATE TABLE IF NOT EXISTS run_variants (
      run_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      rank INTEGER NOT NULL,
      metric REAL NOT NULL,
      ci_low REAL,
      ci_high REAL,
      win_rate REAL,
      p_rank1 REAL,
      PRIMARY KEY (run_id, variant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
  `);
  db = instance;
  return db;
}

export function saveRun(run: PersistedRun): void {
  const d = getDb();
  if (!d) return; // persistence unavailable — degrade gracefully
  const insertRun = d.prepare(
    `INSERT OR REPLACE INTO runs
       (id, experiment_id, created_at, mode, model, judge_criteria, ensemble,
        variant_count, case_count, total_calls, cost_usd, winner_name, winner_metric)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertVariant = d.prepare(
    `INSERT OR REPLACE INTO run_variants
       (run_id, variant_id, name, prompt, rank, metric, ci_low, ci_high, win_rate, p_rank1)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  d.exec("BEGIN");
  try {
    insertRun.run(
      run.id,
      run.experimentId,
      run.createdAt,
      run.mode,
      run.model,
      run.judgeCriteria,
      run.ensemble,
      run.variantCount,
      run.caseCount,
      run.totalCalls,
      run.costUsd,
      run.winnerName,
      run.winnerMetric,
    );
    for (const v of run.variants) {
      insertVariant.run(
        run.id,
        v.variantId,
        v.name,
        v.prompt,
        v.rank,
        v.metric,
        v.ciLow,
        v.ciHigh,
        v.winRate,
        v.pRank1,
      );
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

export function listRuns(limit = 25): PersistedRun[] {
  const d = getDb();
  if (!d) return []; // persistence unavailable
  const runRows = d
    .prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
  if (runRows.length === 0) return [];

  const variantStmt = d.prepare(
    `SELECT * FROM run_variants WHERE run_id = ? ORDER BY rank ASC`,
  );

  return runRows.map((r) => {
    const variants = (variantStmt.all(r.id as string) as Record<string, unknown>[]).map(
      (v) => ({
        variantId: v.variant_id as string,
        name: v.name as string,
        prompt: v.prompt as string,
        rank: v.rank as number,
        metric: v.metric as number,
        ciLow: (v.ci_low as number) ?? null,
        ciHigh: (v.ci_high as number) ?? null,
        winRate: (v.win_rate as number) ?? null,
        pRank1: (v.p_rank1 as number) ?? null,
      }),
    );
    return {
      id: r.id as string,
      experimentId: r.experiment_id as string,
      createdAt: r.created_at as number,
      mode: r.mode as RunMode,
      model: r.model as string,
      judgeCriteria: r.judge_criteria as string,
      ensemble: r.ensemble as number,
      variantCount: r.variant_count as number,
      caseCount: r.case_count as number,
      totalCalls: r.total_calls as number,
      costUsd: r.cost_usd as number,
      winnerName: (r.winner_name as string) ?? null,
      winnerMetric: (r.winner_metric as number) ?? null,
      variants,
    };
  });
}
