"use client";

import { useState } from "react";
import { Rocket, Check, Loader2 } from "lucide-react";

interface Props {
  name: string;
  promptText: string;
  model?: string;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "variant";
}

// Promotes the winning variant to a deployed Respan managed prompt version.
export function PromoteButton({ name, promptText, model }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [info, setInfo] = useState("");

  const promote = async () => {
    setState("loading");
    setInfo("");
    try {
      const res = await fetch("/api/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `promptarena_${slug(name)}`, promptText, model }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setInfo(data?.error ?? "Promotion failed.");
        return;
      }
      setState("done");
      setInfo(`deployed · ${data.promptId} v${data.version}`);
    } catch (e) {
      setState("error");
      setInfo((e as Error).message);
    }
  };

  if (state === "done") {
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 font-mono text-[10px] text-emerald-700" title={info}>
        <Check size={12} strokeWidth={2.5} /> {info}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={promote}
        disabled={state === "loading"}
        title="Create + deploy this variant as a managed prompt version in Respan"
        className="btn95 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-ink disabled:opacity-50"
      >
        {state === "loading" ? (
          <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
        ) : (
          <Rocket size={12} strokeWidth={2} />
        )}
        {state === "loading" ? "promoting…" : "Promote to Respan"}
      </button>
      {state === "error" && (
        <span className="max-w-[220px] truncate text-[10px] text-red-600" title={info}>
          {info}
        </span>
      )}
    </span>
  );
}
