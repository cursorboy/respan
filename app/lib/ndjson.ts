// Client-side: reads a fetch response body as newline-delimited JSON, yielding
// one parsed RunEvent per line as it arrives. Buffers across chunk boundaries
// so a line split between two network chunks is reassembled before parsing.

import type { RunEvent } from "./types";

export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<RunEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield JSON.parse(line) as RunEvent;
      }
    }
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as RunEvent;
  } finally {
    reader.releaseLock();
  }
}
