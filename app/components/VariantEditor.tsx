"use client";

import { X } from "lucide-react";
import { INPUT_PLACEHOLDER, type VariantSpec } from "@/app/lib/types";
import { variantMissingPlaceholder } from "@/app/lib/validate";

interface Props {
  variant: VariantSpec;
  index: number;
  canRemove: boolean;
  disabled: boolean;
  onChange: (patch: Partial<VariantSpec>) => void;
  onRemove: () => void;
}

export function VariantEditor({ variant, index, canRemove, disabled, onChange, onRemove }: Props) {
  const missing = variantMissingPlaceholder(variant.prompt);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="chip95 flex h-5 w-5 items-center justify-center font-mono text-[11px] font-bold text-accent">
          {String.fromCharCode(65 + index)}
        </span>
        <input
          value={variant.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={disabled}
          placeholder="Variant name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-ink outline-none focus:border-line2 focus:bg-panel2/60 disabled:opacity-60"
        />
        <button
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove variant"
          title={canRemove ? "Remove variant" : "Need at least two variants"}
          className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-faint"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <textarea
        value={variant.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        disabled={disabled}
        rows={3}
        spellCheck={false}
        placeholder={`Prompt template using ${INPUT_PLACEHOLDER}`}
        className="field95 w-full resize-y p-2 font-mono text-[12.5px] leading-relaxed text-ink outline-none disabled:opacity-60"
      />
      {missing && (
        <p className="mt-1 text-[11px] text-amber-700">
          Add <code className="font-mono">{INPUT_PLACEHOLDER}</code> where the test input goes.
        </p>
      )}
      <label className="mt-1.5 flex items-center gap-2 text-[11px] text-faint">
        <span className="shrink-0">Model</span>
        <input
          value={variant.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          disabled={disabled}
          spellCheck={false}
          placeholder="same as run model"
          className="field95 min-w-0 flex-1 px-1.5 py-0.5 font-mono text-[11px] text-ink outline-none disabled:opacity-60"
        />
      </label>
    </div>
  );
}
