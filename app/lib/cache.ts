// Content-addressed cache for deterministic model calls. Keyed by a hash of
// (model, temperature, messages), so re-running an experiment with an unchanged
// variant+input reuses the prior generation instead of paying for it again.
// Process-scoped, bounded LRU.

import "server-only";
import { createHash } from "node:crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface CachedCall {
  output: string;
  tokens: number;
}

const MAX_ENTRIES = 2000;
const store = new Map<string, CachedCall>();

export function cacheKey(
  model: string,
  temperature: number,
  messages: ChatCompletionMessageParam[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ model, temperature, messages }))
    .digest("hex");
}

export function cacheGet(key: string): CachedCall | undefined {
  const hit = store.get(key);
  if (hit) {
    // refresh recency
    store.delete(key);
    store.set(key, hit);
  }
  return hit;
}

export function cacheSet(key: string, value: CachedCall): void {
  if (store.has(key)) store.delete(key);
  store.set(key, value);
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}
