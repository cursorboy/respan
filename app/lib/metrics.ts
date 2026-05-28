// Live run metrics. Tracks throughput, latency percentiles, tokens, cost,
// retries, cache hits, and errors, and produces snapshots streamed to the UI.

import { percentile } from "./stats";
import { usdFromTokens } from "./cost";
import type { MetricsSnapshot } from "./types";

export class MetricsAggregator {
  private start = performance.now();
  private inFlight = 0;
  private callsDone = 0;
  private latencies: number[] = [];
  private tokens = 0;
  private retries = 0;
  private cacheHits = 0;
  private errors = 0;

  constructor(
    private readonly callsTotal: number,
    private readonly pricePer1k: number,
  ) {}

  startCall(): void {
    this.inFlight++;
  }

  endCall(latencyMs: number, tokens: number): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.callsDone++;
    this.latencies.push(latencyMs);
    this.tokens += tokens;
  }

  failCall(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.callsDone++;
    this.errors++;
  }

  cacheHit(tokens: number): void {
    this.callsDone++;
    this.cacheHits++;
    this.tokens += tokens;
  }

  recordRetry(): void {
    this.retries++;
  }

  snapshot(): MetricsSnapshot {
    const elapsedMs = performance.now() - this.start;
    const seconds = elapsedMs / 1000;
    return {
      elapsedMs: Math.round(elapsedMs),
      callsTotal: this.callsTotal,
      callsDone: this.callsDone,
      inFlight: this.inFlight,
      throughput: seconds > 0 ? this.callsDone / seconds : 0,
      p50: Math.round(percentile(this.latencies, 50)),
      p95: Math.round(percentile(this.latencies, 95)),
      tokens: this.tokens,
      costUsd: usdFromTokens(this.tokens, this.pricePer1k),
      retries: this.retries,
      cacheHits: this.cacheHits,
      errors: this.errors,
    };
  }
}
