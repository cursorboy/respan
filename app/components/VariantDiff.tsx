"use client";

import { useMemo, useState, useEffect } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Window } from "./Window";
import { wordDiff } from "@/app/lib/diff";
import type { VariantSpec } from "@/app/lib/types";

// Side-by-side variant comparison with word-level highlights. Defaults to the
// first two variants; the user picks via the two dropdowns. Swap reverses A↔B.
export function VariantDiff({ variants, onClose }: { variants: VariantSpec[]; onClose: () => void }) {
  const [a, setA] = useState(variants[0]?.id ?? "");
  const [b, setB] = useState(variants[1]?.id ?? variants[0]?.id ?? "");

  useEffect(() => {
    if (!variants.find((v) => v.id === a)) setA(variants[0]?.id ?? "");
    if (!variants.find((v) => v.id === b)) setB(variants[1]?.id ?? variants[0]?.id ?? "");
  }, [variants, a, b]);

  const va = variants.find((v) => v.id === a);
  const vb = variants.find((v) => v.id === b);

  const chunks = useMemo(() => wordDiff(va?.prompt ?? "", vb?.prompt ?? ""), [va?.prompt, vb?.prompt]);
  const adds = chunks.filter((c) => c.op === "add").reduce((s, c) => s + c.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const dels = chunks.filter((c) => c.op === "del").reduce((s, c) => s + c.text.trim().split(/\s+/).filter(Boolean).length, 0);

  return (
    <Window id="diff" title="diff.exe" defaultX={120} defaultY={80} w={620} onClose={onClose}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex items-center gap-1.5">
          <span className="text-muted">A</span>
          <select value={a} onChange={(e) => setA(e.target.value)} className="field95 px-1.5 py-0.5 text-[12px] outline-none">
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name || v.id}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setA(b);
            setB(a);
          }}
          title="Swap A ↔ B"
          className="btn95 flex h-6 w-7 items-center justify-center"
        >
          <ArrowLeftRight size={12} strokeWidth={2} />
        </button>
        <label className="flex items-center gap-1.5">
          <span className="text-muted">B</span>
          <select value={b} onChange={(e) => setB(e.target.value)} className="field95 px-1.5 py-0.5 text-[12px] outline-none">
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name || v.id}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-mono text-[11px] text-faint">
          <span className="text-red-600">−{dels}</span> · <span className="text-emerald-600">+{adds}</span>
        </span>
      </div>

      <div className="bevel-in bg-white px-3 py-2">
        {a === b ? (
          <p className="py-6 text-center text-[12px] text-faint">Pick two different variants to compare.</p>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed">
            {chunks.map((c, i) =>
              c.op === "eq" ? (
                <span key={i}>{c.text}</span>
              ) : c.op === "add" ? (
                <span key={i} className="bg-emerald-100 text-emerald-900">{c.text}</span>
              ) : (
                <span key={i} className="bg-red-100 text-red-800 line-through">{c.text}</span>
              ),
            )}
          </pre>
        )}
      </div>

      <p className="mt-2 text-[10px] text-faint">
        <span className="bg-red-100 px-1 text-red-800 line-through">red</span> = only in A ·{" "}
        <span className="bg-emerald-100 px-1 text-emerald-900">green</span> = only in B
      </p>
    </Window>
  );
}
