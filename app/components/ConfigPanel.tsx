"use client";

import { useRef } from "react";
import { Plus, FileUp, Sparkles } from "lucide-react";
import {
  MAX_CASES,
  MAX_ENSEMBLE,
  MAX_VARIANTS,
  MIN_VARIANTS,
  type RunMode,
  type VariantSpec,
} from "@/app/lib/types";
import { VariantEditor } from "./VariantEditor";

interface Props {
  variants: VariantSpec[];
  casesText: string;
  judgeCriteria: string;
  mode: RunMode;
  ensemble: number;
  caseCount: number;
  truncated: boolean;
  csvNote: string | null;
  disabled: boolean;
  onUpdateVariant: (id: string, patch: Partial<VariantSpec>) => void;
  onAddVariant: () => void;
  onRemoveVariant: (id: string) => void;
  onCasesTextChange: (text: string) => void;
  onJudgeCriteriaChange: (text: string) => void;
  onModeChange: (mode: RunMode) => void;
  onEnsembleChange: (n: number) => void;
  judgeModel: string;
  onJudgeModelChange: (m: string) => void;
  onImportCsv: (file: File) => void;
  /** Optional self-improving loop: ask the gateway to propose better variants. */
  onEvolve?: () => void;
  evolveBusy?: boolean;
  /** Optional: ask the gateway to propose new test cases that discriminate variants. */
  onEvolveCases?: () => void;
  evolveCasesBusy?: boolean;
}

export function ConfigPanel(props: Props) {
  const {
    variants,
    casesText,
    judgeCriteria,
    mode,
    ensemble,
    caseCount,
    truncated,
    csvNote,
    disabled,
    onUpdateVariant,
    onAddVariant,
    onRemoveVariant,
    onCasesTextChange,
    onJudgeCriteriaChange,
    onModeChange,
    onEnsembleChange,
    judgeModel,
    onJudgeModelChange,
    onImportCsv,
    onEvolve,
    evolveBusy,
    onEvolveCases,
    evolveCasesBusy,
  } = props;
  const fileRef = useRef<HTMLInputElement>(null);

  const field =
    "field95 w-full resize-y p-2 font-mono text-[12.5px] leading-relaxed text-ink outline-none disabled:opacity-60";

  return (
    <div className="flex flex-col">
      {/* Evaluation */}
      <Section title="How to judge">
        <div className="grid grid-cols-2 gap-1.5">
          <ModeButton active={mode === "absolute"} disabled={disabled} onClick={() => onModeChange("absolute")} title="Absolute" sub="score 1–10" />
          <ModeButton active={mode === "arena"} disabled={disabled} onClick={() => onModeChange("arena")} title="Arena" sub="pairwise battles" />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          {mode === "arena"
            ? "Every pair battles head-to-head per case (order-swapped). Ranked by Bradley-Terry rating with confidence intervals."
            : "Each output is scored 1–10 by the judge. Ranked by bootstrapped mean score."}
        </p>
        <label className="mt-3 flex items-center justify-between text-[13px]">
          <span className="text-muted">
            Judge ensemble <span className="font-mono text-ink tnum">{ensemble}×</span>
          </span>
          <input
            type="range"
            min={1}
            max={MAX_ENSEMBLE}
            value={ensemble}
            disabled={disabled}
            onChange={(e) => onEnsembleChange(Number(e.target.value))}
            className="ml-3 w-32 accent-[var(--color-accent)]"
          />
        </label>
        <label className="mt-3 block text-[13px]">
          <span className="text-muted">
            Judge model <span className="text-faint">(optional)</span>
          </span>
          <input
            value={judgeModel}
            onChange={(e) => onJudgeModelChange(e.target.value)}
            disabled={disabled}
            spellCheck={false}
            placeholder="same as run model"
            className="field95 mt-1 w-full p-1.5 font-mono text-[12px] text-ink outline-none disabled:opacity-60"
          />
        </label>
      </Section>

      {/* Variants */}
      <Section title="Variants" hint={`${variants.length} / ${MAX_VARIANTS}`}>
        <div className="flex flex-col gap-5">
          {variants.map((v, i) => (
            <VariantEditor
              key={v.id}
              variant={v}
              index={i}
              canRemove={variants.length > MIN_VARIANTS}
              disabled={disabled}
              onChange={(patch) => onUpdateVariant(v.id, patch)}
              onRemove={() => onRemoveVariant(v.id)}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1.5">
          <button
            onClick={onAddVariant}
            disabled={disabled || variants.length >= MAX_VARIANTS}
            className="btn95 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={13} strokeWidth={2} /> Add variant
          </button>
          <button
            onClick={onEvolve}
            disabled={disabled || evolveBusy || !onEvolve || variants.length >= MAX_VARIANTS}
            title="Ask the gateway to propose a better variant based on the current ones + criteria"
            className="btn95 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-accent-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={13} strokeWidth={2} className={evolveBusy ? "animate-pulse-run" : ""} />
            {evolveBusy ? "Evolving…" : "Auto-evolve"}
          </button>
        </div>
      </Section>

      {/* Test set */}
      <Section
        title="Test set"
        hint={`${caseCount} / ${MAX_CASES}`}
        action={
          <div className="flex items-center gap-3">
            {onEvolveCases && (
              <button
                onClick={onEvolveCases}
                disabled={disabled || evolveCasesBusy || caseCount >= MAX_CASES}
                title="Ask the gateway to propose cases that distinguish variants"
                className="flex items-center gap-1 text-[11px] font-bold text-accent-glow transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles size={12} strokeWidth={2} className={evolveCasesBusy ? "animate-pulse-run" : ""} />
                {evolveCasesBusy ? "generating…" : "generate"}
              </button>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent disabled:opacity-40"
            >
              <FileUp size={12} strokeWidth={2} /> import CSV
            </button>
          </div>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportCsv(file);
            e.target.value = "";
          }}
        />
        <textarea
          value={casesText}
          onChange={(e) => onCasesTextChange(e.target.value)}
          disabled={disabled}
          rows={6}
          spellCheck={false}
          placeholder="One test input per line"
          className={field}
        />
        <p className="mt-1.5 text-[11px] text-faint">
          One input per line.{" "}
          {truncated && <span className="text-amber-700">Only the first {MAX_CASES} are used.</span>}
          {csvNote && <span className="text-emerald-600"> {csvNote}</span>}
        </p>
      </Section>

      {/* Judge */}
      <Section title="Judge criteria" last>
        <textarea
          value={judgeCriteria}
          onChange={(e) => onJudgeCriteriaChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="How should outputs be judged?"
          className={field}
        />
        <p className="mt-1.5 text-[11px] text-faint">
          A single judge is noisy. Arena mode and an ensemble reduce that, but read scores as a signal.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  last,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`border-line py-5 first:pt-0 ${last ? "" : "border-b"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-ink">{title}</h2>
        <div className="flex items-center gap-3">
          {hint && <span className="font-mono text-[11px] text-faint tnum">{hint}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 text-left disabled:opacity-60 ${
        active ? "bevel-in bg-white font-bold text-accent" : "btn95 text-ink"
      }`}
    >
      <div className="text-[13px] font-medium">{title}</div>
      <div className="text-[10px] opacity-80">{sub}</div>
    </button>
  );
}
