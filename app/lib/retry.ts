// Retry with exponential backoff + jitter for transient gateway failures.
// Honors an abort signal and the Retry-After header when present.

import "server-only";
import OpenAI from "openai";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === undefined || RETRYABLE_STATUS.has(err.status);
  }
  // Network errors (fetch failures) have no status — worth a retry.
  return err instanceof Error && !(err.name === "AbortError");
}

function retryAfterMs(err: unknown): number | null {
  if (err instanceof OpenAI.APIError && err.headers) {
    const raw =
      typeof (err.headers as Headers).get === "function"
        ? (err.headers as Headers).get("retry-after")
        : (err.headers as Record<string, string>)["retry-after"];
    if (raw) {
      const seconds = Number(raw);
      if (Number.isFinite(seconds)) return seconds * 1000;
    }
  }
  return null;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 4,
    baseDelayMs = 400,
    maxDelayMs = 8000,
    signal,
    onRetry,
  }: {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    signal: AbortSignal;
    onRetry?: (attempt: number, delayMs: number) => void;
  },
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (signal.aborted || attempt >= retries || !isRetryable(err)) throw err;
      attempt++;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.25;
      const delay = retryAfterMs(err) ?? backoff + jitter;
      onRetry?.(attempt, delay);
      await sleep(delay, signal);
    }
  }
}
