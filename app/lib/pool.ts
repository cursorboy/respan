// A bounded-concurrency worker pool. Fixed workers pull from a shared index;
// `next++` is atomic in single-threaded JS, so no locking is needed. Workers
// stop claiming new tasks once the signal aborts. Each task is responsible for
// catching its own errors, so one failure never rejects the whole pool.

export async function runPool(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
  signal: AbortSignal,
): Promise<void> {
  let next = 0;

  async function worker(): Promise<void> {
    while (!signal.aborted) {
      const i = next++;
      if (i >= tasks.length) return;
      await tasks[i]();
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
