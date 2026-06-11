// POST /api/run — runs the variant × case matrix and streams NDJSON.
//
// Phase 1 (both modes): generate every variant's output for every case, through
// a bounded worker pool, cached + retried.
// Phase 2: evaluate.
//   - absolute: judge each output 1–10 (ensemble of samples → mean + disagreement),
//     then bootstrap a mean score + CI per variant.
//   - arena: round-robin pairwise battles (order-swapped to cancel position bias),
//     then Bradley-Terry ratings + bootstrap CIs + P(rank 1).
// Live metrics (throughput, p50/p95 latency, cost, retries, cache hits) stream
// throughout. The run is cancellable via request.signal.

import type OpenAI from "openai";
import { getEnv, EnvError, type Env } from "@/app/lib/env";
import { makeClient, errorMessage, type RespanTag } from "@/app/lib/respan";
import { runPool, clamp } from "@/app/lib/pool";
import {
  buildGenerateMessages,
  buildJudgeMessages,
  parseJudge,
  buildBattleMessages,
  parseBattle,
} from "@/app/lib/prompts";
import { callModel, callModelStream } from "@/app/lib/llm";
import { MetricsAggregator } from "@/app/lib/metrics";
import { validateRun } from "@/app/lib/validate";
import { plannedCalls } from "@/app/lib/cost";
import { mean, stddev } from "@/app/lib/stats";
import { buildBattleTasks, perCellWinRate, type CaseBattle } from "@/app/lib/arena";
import { saveRun, type PersistedVariant } from "@/app/lib/db";
import {
  aggregateWinMatrix,
  bootstrapArena,
  bootstrapMeans,
  pairwiseWinRates,
} from "@/app/lib/ratings";
import {
  cellKey,
  DEFAULT_CONCURRENCY,
  type CellKey,
  type RunEvent,
  type RunRequest,
} from "@/app/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Arena runs can stream for a few minutes (variants × cases × ensemble + judging).
// Vercel: Hobby caps at 60s, Pro defaults to 300s. The Pro/Enterprise ceiling is
// higher; bump here if you upgrade. The client cancels via AbortSignal regardless.
export const maxDuration = 300;

const METRICS_THROTTLE_MS = 200;

export async function POST(req: Request): Promise<Response> {
  let env: Env;
  try {
    env = getEnv();
  } catch (err) {
    const message = err instanceof EnvError ? err.message : errorMessage(err);
    return Response.json({ error: message }, { status: 500 });
  }

  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    return Response.json({ error: "Request body was not valid JSON." }, { status: 400 });
  }
  const invalid = validateRun(body);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const resolvedApiKey = body.apiKey?.trim() || env.apiKey;
  const missing: string[] = [];
  if (!resolvedApiKey) missing.push("RESPAN_API_KEY");
  const resolvedModel = body.model?.trim() || env.model;
  if (!resolvedModel) missing.push("RESPAN_MODEL");
  if (missing.length > 0) {
    return Response.json(
      {
        error:
          `Missing required value(s): ${missing.join(", ")}. ` +
          `Set them in .env.local or enter them in the Connection panel.`,
      },
      { status: 400 },
    );
  }

  const client = makeClient({ ...env, apiKey: resolvedApiKey });
  const model = resolvedModel;
  const judgeModel = body.judgeModel?.trim() || model;
  const mode = body.mode;
  const ensemble = Math.max(1, body.ensemble ?? 1);
  const concurrency = clamp(body.concurrency ?? DEFAULT_CONCURRENCY, 1, 16);
  const signal = req.signal;
  const encoder = new TextEncoder();

  const planned = plannedCalls(mode, body.variants.length, body.cases.length, ensemble);
  const metrics = new MetricsAggregator(planned.total, env.pricePer1k);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastMetricsAt = 0;
      const variantById = new Map(body.variants.map((v) => [v.id, v]));
      let summary: { winnerName: string | null; winnerMetric: number | null; variants: PersistedVariant[] } | null = null;

      const emit = (event: RunEvent) => {
        if (closed || signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      const emitMetrics = (force = false) => {
        const now = performance.now();
        if (!force && now - lastMetricsAt < METRICS_THROTTLE_MS) return;
        lastMetricsAt = now;
        emit({ type: "metrics", snapshot: metrics.snapshot() });
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      emit({
        type: "run_start",
        experimentId: body.experimentId,
        mode,
        model,
        pricePer1k: env.pricePer1k,
        totalCalls: planned.total,
        variantCount: body.variants.length,
        caseCount: body.cases.length,
        dashboardUrl: env.dashboardUrl,
      });

      const tag = (variant: string, caseIndex: number, role: RespanTag["role"]): RespanTag => ({
        experimentId: body.experimentId,
        variant,
        caseIndex,
        role,
        customerId: env.customerId,
      });

      // ---- Phase 1: generation ----
      const outputs = new Map<CellKey, string>();
      const genTasks = body.variants.flatMap((variant) =>
        body.cases.map((input, caseIndex) => async () => {
          try {
            const res = await callModelStream(client, {
              // Per-variant model override → makes a variant a (prompt × model)
              // pair, routed through Respan to whichever provider hosts it.
              model: variant.model?.trim() || model,
              messages: buildGenerateMessages(variant.prompt, input),
              tag: tag(variant.id, caseIndex, "generate"),
              signal,
              metrics,
              // Stream each token straight into the matching matrix cell so the
              // detail drawer and telemetry react live as the gateway responds.
              onDelta: (delta) => emit({ type: "gen_token", variantId: variant.id, caseIndex, delta }),
            });
            outputs.set(cellKey(variant.id, caseIndex), res.output);
            emit({
              type: "gen_done",
              variantId: variant.id,
              caseIndex,
              output: res.output,
              latencyMs: res.latencyMs,
              tokens: res.tokens,
              cached: res.cached,
            });
          } catch (err) {
            if (!signal.aborted) {
              emit({
                type: "gen_error",
                variantId: variant.id,
                caseIndex,
                message: errorMessage(err),
              });
            }
          } finally {
            emitMetrics();
          }
        }),
      );
      await runPool(genTasks, concurrency, signal);
      if (signal.aborted) return finish();

      // ---- Phase 2: evaluation ----
      if (mode === "absolute") {
        await runAbsolute();
      } else {
        await runArena();
      }
      if (signal.aborted) return finish();

      finish();

      function finish() {
        emitMetrics(true);
        const snap = metrics.snapshot();
        if (!signal.aborted && summary) {
          try {
            saveRun({
              id: body.experimentId,
              experimentId: body.experimentId,
              createdAt: Date.now(),
              mode,
              model,
              judgeCriteria: body.judgeCriteria.trim(),
              ensemble,
              variantCount: body.variants.length,
              caseCount: body.cases.length,
              totalCalls: planned.total,
              costUsd: snap.costUsd,
              winnerName: summary.winnerName,
              winnerMetric: summary.winnerMetric,
              variants: summary.variants,
            });
          } catch {
            /* persistence is best-effort; never break the run */
          }
        }
        if (signal.aborted) emit({ type: "run_aborted", completed: snap.callsDone });
        else emit({ type: "run_done", completed: snap.callsDone, errored: snap.errors });
        close();
      }

      async function runAbsolute() {
        const judgeTemp = ensemble === 1 ? 0 : 0.6;
        const perVariantScores: Record<string, number[]> = {};
        for (const v of body.variants) perVariantScores[v.id] = [];

        const tasks = body.variants.flatMap((variant) =>
          body.cases.map((input, caseIndex) => async () => {
            const output = outputs.get(cellKey(variant.id, caseIndex));
            if (output === undefined) {
              emit({
                type: "score_error",
                variantId: variant.id,
                caseIndex,
                message: "no generation to score",
              });
              return;
            }
            const scores: number[] = [];
            let reason = "";
            let tokens = 0;
            let latency = 0;
            for (let s = 0; s < ensemble; s++) {
              if (signal.aborted) return;
              try {
                const res = await callModel(client, {
                  model: judgeModel,
                  messages: buildJudgeMessages(body.judgeCriteria, input, output),
                  temperature: judgeTemp,
                  responseFormatJson: true,
                  tag: tag(variant.id, caseIndex, "judge"),
                  signal,
                  metrics,
                });
                const parsed = parseJudge(res.output);
                scores.push(parsed.score);
                if (!reason) reason = parsed.reason;
                tokens += res.tokens;
                latency += res.latencyMs;
              } catch (err) {
                if (signal.aborted) return;
                // a single bad sample shouldn't sink the cell
                if (ensemble === 1) {
                  emit({
                    type: "score_error",
                    variantId: variant.id,
                    caseIndex,
                    message: errorMessage(err),
                  });
                }
              } finally {
                emitMetrics();
              }
            }
            if (scores.length === 0) {
              if (ensemble > 1) {
                emit({
                  type: "score_error",
                  variantId: variant.id,
                  caseIndex,
                  message: "all judge samples failed",
                });
              }
              return;
            }
            const score = mean(scores);
            perVariantScores[variant.id].push(score);
            emit({
              type: "score_done",
              variantId: variant.id,
              caseIndex,
              score,
              stddev: stddev(scores),
              samples: scores.length,
              latencyMs: latency,
              tokens,
              reason,
            });
          }),
        );
        await runPool(tasks, concurrency, signal);
        if (signal.aborted) return;

        const means = bootstrapMeans(perVariantScores);
        emit({ type: "result", result: { mode: "absolute", means } });

        const ranked = [...means].sort((a, b) => b.mean - a.mean);
        summary = {
          winnerName: ranked[0] ? variantById.get(ranked[0].variantId)?.name ?? null : null,
          winnerMetric: ranked[0]?.mean ?? null,
          variants: ranked.map((m, i) => {
            const v = variantById.get(m.variantId);
            return {
              variantId: m.variantId,
              name: v?.name ?? m.variantId,
              prompt: v?.prompt ?? "",
              rank: i + 1,
              metric: m.mean,
              ciLow: m.ciLow,
              ciHigh: m.ciHigh,
              winRate: null,
              pRank1: null,
            };
          }),
        };
      }

      async function runArena() {
        const judgeTemp = ensemble === 1 ? 0 : 0.6;
        const ids = body.variants.map((v) => v.id);
        const battles: CaseBattle[] = [];
        const tasks = buildBattleTasks(ids, body.cases.length, ensemble).map((bt) => async () => {
          const outA = outputs.get(cellKey(bt.firstId, bt.caseIndex));
          const outB = outputs.get(cellKey(bt.secondId, bt.caseIndex));
          if (outA === undefined || outB === undefined) {
            emit({
              type: "battle_error",
              caseIndex: bt.caseIndex,
              a: bt.firstId,
              b: bt.secondId,
              message: "missing generation",
            });
            return;
          }
          try {
            const res = await callModel(client, {
              model: judgeModel,
              messages: buildBattleMessages(body.judgeCriteria, body.cases[bt.caseIndex], outA, outB),
              temperature: judgeTemp,
              responseFormatJson: true,
              tag: tag(`${bt.firstId}__vs__${bt.secondId}`, bt.caseIndex, "battle"),
              signal,
              metrics,
            });
            const winner = parseBattle(res.output);
            battles.push({ caseIndex: bt.caseIndex, a: bt.firstId, b: bt.secondId, winner });
            emit({
              type: "battle_done",
              caseIndex: bt.caseIndex,
              a: bt.firstId,
              b: bt.secondId,
              winner,
              latencyMs: res.latencyMs,
              tokens: res.tokens,
              reason: "",
            });
          } catch (err) {
            if (!signal.aborted) {
              emit({
                type: "battle_error",
                caseIndex: bt.caseIndex,
                a: bt.firstId,
                b: bt.secondId,
                message: errorMessage(err),
              });
            }
          } finally {
            emitMetrics();
          }
        });
        await runPool(tasks, concurrency, signal);
        if (signal.aborted) return;

        const ratings = bootstrapArena(
          battles.map(({ a, b, winner }) => ({ a, b, winner })),
          ids,
        );
        const matrix = aggregateWinMatrix(
          battles.map(({ a, b, winner }) => ({ a, b, winner })),
          ids,
        );
        const pairwise = pairwiseWinRates(matrix).map((row) =>
          row.map((v) => (Number.isNaN(v) ? null : v)),
        );
        emit({
          type: "result",
          result: {
            mode: "arena",
            ratings,
            ids,
            pairwise,
            perCellWinRate: perCellWinRate(battles),
          },
        });

        const ranked = [...ratings].sort((a, b) => b.rating - a.rating);
        summary = {
          winnerName: ranked[0] ? variantById.get(ranked[0].variantId)?.name ?? null : null,
          winnerMetric: ranked[0]?.rating ?? null,
          variants: ranked.map((r, i) => {
            const v = variantById.get(r.variantId);
            return {
              variantId: r.variantId,
              name: v?.name ?? r.variantId,
              prompt: v?.prompt ?? "",
              rank: i + 1,
              metric: r.rating,
              ciLow: r.ciLow,
              ciHigh: r.ciHigh,
              winRate: r.winRate,
              pRank1: r.pRank1,
            };
          }),
        };
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
