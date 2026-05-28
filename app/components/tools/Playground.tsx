"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Window } from "../Window";
import { formatUsd, usdFromTokens, DEFAULT_PRICE_PER_1K } from "@/app/lib/cost";

interface Result {
  output: string;
  tokens: number;
  latencyMs: number;
  model: string;
}

export function Playground({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<"inline" | "managed">("inline");
  const [prompt, setPrompt] = useState("Summarize in one sentence:\n\n{{input}}");
  const [input, setInput] = useState("The French Revolution began in 1789.");
  const [promptId, setPromptId] = useState("");
  const [version, setVersion] = useState("");
  const [model, setModel] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const field = "field95 w-full p-1.5 font-mono text-[12px] text-ink outline-none disabled:opacity-60";

  const fire = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, prompt, input, promptId, version, model: model.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? "Request failed.");
      else setResult(data as Result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Window id="playground" title="playground.exe" defaultX={300} defaultY={90} w={470} onClose={onClose}>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setSource("inline")}
          className={`px-2 py-1.5 text-[12px] ${source === "inline" ? "bevel-in bg-white font-bold text-accent" : "btn95 text-ink"}`}
        >
          Inline prompt
        </button>
        <button
          onClick={() => setSource("managed")}
          className={`px-2 py-1.5 text-[12px] ${source === "managed" ? "bevel-in bg-white font-bold text-accent" : "btn95 text-ink"}`}
        >
          Respan prompt by id
        </button>
      </div>

      {source === "inline" ? (
        <label className="mt-3 block text-[12px] text-muted">
          Prompt (use {"{{input}}"})
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} spellCheck={false} className={`${field} mt-1 resize-y`} />
        </label>
      ) : (
        <div className="mt-3 flex gap-2">
          <label className="flex-1 text-[12px] text-muted">
            Respan prompt_id
            <input value={promptId} onChange={(e) => setPromptId(e.target.value)} placeholder="prompt_xxxxx" className={`${field} mt-1`} />
          </label>
          <label className="w-24 text-[12px] text-muted">
            Version
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="latest" className={`${field} mt-1`} />
          </label>
        </div>
      )}

      <label className="mt-3 block text-[12px] text-muted">
        Input {"{{input}}"}
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} spellCheck={false} className={`${field} mt-1 resize-y`} />
      </label>

      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-[12px] text-muted">
          Model (optional)
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="run model" className={`${field} mt-1`} />
        </label>
        <button onClick={fire} disabled={running} className="btn95 flex items-center gap-1.5 px-4 py-1.5 text-[12px] text-ink disabled:opacity-50">
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
          Run
        </button>
      </div>

      <div className="mt-3 border-t-2 border-[#808080] pt-2">
        {error ? (
          <pre className="field95 whitespace-pre-wrap break-words bg-white p-2 font-mono text-[12px] text-[var(--color-bad)]">{error}</pre>
        ) : result ? (
          <>
            <pre className="field95 max-h-44 overflow-auto whitespace-pre-wrap break-words bg-white p-2 font-mono text-[12px] text-ink">
              {result.output || "(empty)"}
            </pre>
            <p className="mt-2 font-mono text-[11px] text-faint tnum">
              {result.tokens} tokens · {result.latencyMs}ms · {formatUsd(usdFromTokens(result.tokens, DEFAULT_PRICE_PER_1K))} · {result.model} · span logged in Respan
            </p>
          </>
        ) : (
          <p className="text-[12px] text-faint">
            Fire one call through the Respan gateway. Reference a deployed managed prompt by id, or test inline.
          </p>
        )}
      </div>
    </Window>
  );
}
