"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { respanDashboardUrl } from "@/app/lib/dashboard";
import {
  cellKey,
  DEFAULT_CONCURRENCY,
  MAX_CASES,
  MAX_ENSEMBLE,
  MAX_VARIANTS,
  MIN_VARIANTS,
  type AbsoluteResult,
  type ArenaResult,
  type CellKey,
  type MatrixCell,
  type MetricsSnapshot,
  type RunEvent,
  type RunMode,
  type RunRequest,
  type VariantSpec,
} from "@/app/lib/types";
import { parseCases, validateRun } from "@/app/lib/validate";
import { estimateRun, DEFAULT_PRICE_PER_1K } from "@/app/lib/cost";
import { csvFirstColumn } from "@/app/lib/csv";
import { readNdjson } from "@/app/lib/ndjson";
import { loadState, saveState } from "@/app/lib/persist";
import { ConfigPanel } from "./ConfigPanel";
import { RunControls } from "./RunControls";
import { MetricsBar } from "./MetricsBar";
import { Leaderboard } from "./Leaderboard";
import { Matrix } from "./Matrix";
import { DetailDrawer } from "./DetailDrawer";
import { Verdict } from "./Verdict";
import { HistoryPanel } from "./HistoryPanel";
import { DesktopProvider } from "./desktop";
import { Window } from "./Window";
import { WinFlag } from "./WinFlag";
import { Taskbar } from "./Taskbar";
import { AboutDialog } from "./AboutDialog";
import { ApiKeySetup } from "./ApiKeySetup";
import { DesktopIcons } from "./DesktopIcons";
import { exportCsv, exportJson } from "@/app/lib/export";
import { Playground } from "./tools/Playground";
import { Minesweeper } from "./tools/Minesweeper";
import { VariantDiff } from "./VariantDiff";
import { Notepad } from "./tools/Notepad";
import { Calculator } from "./tools/Calculator";
import { BootSplash } from "./BootSplash";
import { playStartup, playError } from "@/app/lib/sounds";

const MAX_SERIES = 240;

function newId(): string {
  return crypto.randomUUID();
}

// Stable ids for the seed variants so server and client render identically
// (crypto.randomUUID during render would cause a hydration mismatch). New
// variants added via the UI use randomUUID, which only runs on the client.
function defaultVariants(): VariantSpec[] {
  return [
    { id: "seed-direct", name: "Direct", prompt: "Answer concisely and correctly:\n\n{{input}}" },
    {
      id: "seed-stepwise",
      name: "Step by step",
      prompt: "Think through this step by step, then give a clear final answer:\n\n{{input}}",
    },
  ];
}

const DEFAULT_CASES = [
  "What is 17 × 24?",
  "Name three causes of the French Revolution.",
  "Write a haiku about the ocean.",
].join("\n");

const DEFAULT_CRITERIA = "Is the response correct, clear, and directly responsive to the input?";

interface RunInfo {
  model: string;
  pricePer1k: number;
  dashboardUrl?: string;
}

export default function Workbench() {
  const [variants, setVariants] = useState<VariantSpec[]>(defaultVariants);
  const [casesText, setCasesText] = useState(DEFAULT_CASES);
  const [judgeCriteria, setJudgeCriteria] = useState(DEFAULT_CRITERIA);
  const [mode, setMode] = useState<RunMode>("arena");
  const [ensemble, setEnsemble] = useState(1);

  const [cells, setCells] = useState<Record<CellKey, MatrixCell>>({});
  const [result, setResult] = useState<ArenaResult | AbsoluteResult | null>(null);
  const [metricsLatest, setMetricsLatest] = useState<MetricsSnapshot | null>(null);
  const [metricsSeries, setMetricsSeries] = useState<MetricsSnapshot[]>([]);
  const [experimentId, setExperimentId] = useState("");
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<CellKey | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [csvNote, setCsvNote] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [judgeModel, setJudgeModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [firstVisit, setFirstVisit] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [minesweeperOpen, setMinesweeperOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  // Boot splash gated by sessionStorage so it plays once per tab session, not every refresh.
  const [booting, setBooting] = useState<boolean | null>(null);
  // Win95 login gate — shown on every full page load (no persistence), so any
  // refresh re-triggers the "boot" experience.
  const [showLogin, setShowLogin] = useState(true);
  const [evolveBusy, setEvolveBusy] = useState(false);
  const [evolveCasesBusy, setEvolveCasesBusy] = useState(false);
  const [actualCost, setActualCost] = useState<{ usd: number; tokens: number; count: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const completeSetup = useCallback((key: string) => {
    playStartup();
    try {
      localStorage.setItem("promptarena.apiKey", key);
      if (!localStorage.getItem("promptarena.visited")) {
        localStorage.setItem("promptarena.visited", "1");
        setFirstVisit(true);
      }
    } catch { /* private mode */ }
    if (key) setApiKey(key);
    setShowLogin(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBooting(sessionStorage.getItem("promptarena.booted") !== "1");
    // Pre-populate API key from localStorage so returning users skip re-entry.
    try {
      const saved = localStorage.getItem("promptarena.apiKey");
      if (saved) setApiKey(saved);
      if (!localStorage.getItem("promptarena.visited")) setFirstVisit(true);
    } catch { /* private mode */ }
  }, []);

  // Error chime when a banner pops up — sensory feedback for failures.
  useEffect(() => {
    if (banner) playError();
  }, [banner]);

  const finishBoot = useCallback(() => {
    try {
      sessionStorage.setItem("promptarena.booted", "1");
    } catch {
      /* private mode */
    }
    setBooting(false);
  }, []);

  useEffect(() => {
    const saved = loadState();
    if (!saved) return;
    if (saved.variants?.length) setVariants(saved.variants);
    if (typeof saved.casesText === "string") setCasesText(saved.casesText);
    if (typeof saved.judgeCriteria === "string") setJudgeCriteria(saved.judgeCriteria);
    if (saved.mode) setMode(saved.mode);
    if (saved.ensemble) setEnsemble(saved.ensemble);
    if (saved.cells) setCells(saved.cells);
    if (saved.result) setResult(saved.result);
    if (saved.metrics) setMetricsLatest(saved.metrics);
    if (saved.experimentId) setExperimentId(saved.experimentId);
    if (saved.model) setRunInfo({ model: saved.model, pricePer1k: saved.pricePer1k });
  }, []);

  const { cases, truncated } = useMemo(() => parseCases(casesText), [casesText]);

  useEffect(() => {
    if (running) return;
    saveState({
      variants,
      casesText,
      judgeCriteria,
      mode,
      ensemble,
      cells,
      result,
      metrics: metricsLatest,
      experimentId,
      model: runInfo?.model ?? "",
      pricePer1k: runInfo?.pricePer1k ?? DEFAULT_PRICE_PER_1K,
      ts: Date.now(),
    });
  }, [variants, casesText, judgeCriteria, mode, ensemble, cells, result, metricsLatest, experimentId, runInfo, running]);

  const validationError = useMemo(
    () => validateRun({ mode, variants, cases, judgeCriteria, ensemble }),
    [mode, variants, cases, judgeCriteria, ensemble],
  );

  const pricePer1k = runInfo?.pricePer1k ?? DEFAULT_PRICE_PER_1K;
  const estimate = useMemo(
    () => estimateRun(mode, variants.length, cases.length, ensemble, pricePer1k),
    [mode, variants.length, cases.length, ensemble, pricePer1k],
  );

  // ---- config mutations ----
  const updateVariant = useCallback((id: string, patch: Partial<VariantSpec>) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);
  const addVariant = useCallback(() => {
    setVariants((prev) =>
      prev.length >= MAX_VARIANTS
        ? prev
        : [...prev, { id: newId(), name: `Variant ${prev.length + 1}`, prompt: "{{input}}" }],
    );
  }, []);
  const removeVariant = useCallback((id: string) => {
    setVariants((prev) => (prev.length <= MIN_VARIANTS ? prev : prev.filter((v) => v.id !== id)));
  }, []);
  const importCsv = useCallback(async (file: File) => {
    setCsvNote(null);
    const all = csvFirstColumn(await file.text());
    if (all.length === 0) {
      setCsvNote("No usable rows found in that CSV.");
      return;
    }
    const kept = all.slice(0, MAX_CASES);
    setCasesText(kept.join("\n"));
    setCsvNote(
      all.length > MAX_CASES
        ? `Imported ${kept.length} of ${all.length} rows (capped at ${MAX_CASES}).`
        : `Imported ${kept.length} case${kept.length === 1 ? "" : "s"}.`,
    );
  }, []);

  // ---- the run ----
  const applyEvent = useCallback((event: RunEvent) => {
    switch (event.type) {
      case "run_start":
        setExperimentId(event.experimentId);
        setRunInfo({ model: event.model, pricePer1k: event.pricePer1k, dashboardUrl: event.dashboardUrl });
        break;
      case "gen_token":
        // Live token streaming: append the delta and flip the cell into
        // "running" so the detail drawer renders text as it arrives.
        setCells((prev) => {
          const k = cellKey(event.variantId, event.caseIndex);
          const cur = prev[k] ?? { genStatus: "pending" };
          return { ...prev, [k]: { ...cur, genStatus: "running", output: (cur.output ?? "") + event.delta } };
        });
        break;
      case "gen_done":
        patchCell(setCells, event.variantId, event.caseIndex, {
          genStatus: "done",
          output: event.output,
          genLatencyMs: event.latencyMs,
          genTokens: event.tokens,
          cached: event.cached,
        });
        break;
      case "gen_error":
        patchCell(setCells, event.variantId, event.caseIndex, {
          genStatus: "error",
          genError: event.message,
        });
        break;
      case "score_done":
        patchCell(setCells, event.variantId, event.caseIndex, {
          scoreStatus: "done",
          score: event.score,
          stddev: event.stddev,
          samples: event.samples,
          reason: event.reason,
          judgeLatencyMs: event.latencyMs,
          judgeTokens: event.tokens,
        });
        break;
      case "score_error":
        patchCell(setCells, event.variantId, event.caseIndex, {
          scoreStatus: "error",
          scoreError: event.message,
        });
        break;
      case "battle_done":
      case "battle_error":
        break; // per-cell win rates arrive with the result
      case "metrics":
        setMetricsLatest(event.snapshot);
        setMetricsSeries((prev) => {
          const next = [...prev, event.snapshot];
          return next.length > MAX_SERIES ? next.slice(-MAX_SERIES) : next;
        });
        break;
      case "result":
        setResult(event.result);
        if (event.result.mode === "arena") {
          const wr = event.result.perCellWinRate;
          setCells((prev) => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(wr)) {
              const key = k as CellKey;
              next[key] = { ...(next[key] ?? { genStatus: "done" }), winRate: v };
            }
            return next;
          });
        }
        break;
      case "run_done":
      case "run_aborted":
        break;
    }
  }, []);

  const run = useCallback(async () => {
    if (validateRun({ mode, variants, cases, judgeCriteria, ensemble })) return;

    const expId = newId();
    const seeded: Record<CellKey, MatrixCell> = {};
    for (const v of variants) {
      for (let i = 0; i < cases.length; i++) seeded[cellKey(v.id, i)] = { genStatus: "pending" };
    }

    setBanner(null);
    setSelected(null);
    setExperimentId(expId);
    setRunInfo(null);
    setResult(null);
    setMetricsLatest(null);
    setMetricsSeries([]);
    setActualCost(null);
    setCells(seeded);
    setRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const payload: RunRequest = {
      experimentId: expId,
      mode,
      variants,
      cases,
      judgeCriteria: judgeCriteria.trim(),
      ensemble,
      judgeModel: judgeModel.trim() || undefined,
      concurrency: DEFAULT_CONCURRENCY,
      model: model.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
    };

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
        setBanner(typeof data?.error === "string" ? data.error : `Request failed (${res.status}).`);
        setCells({});
        return;
      }
      if (!res.body) throw new Error("No response body to stream.");
      for await (const event of readNdjson(res.body)) applyEvent(event);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setBanner((err as Error)?.message ?? "Run failed.");
    } finally {
      setRunning(false);
      abortRef.current = null;
      setHistoryRefresh((n) => n + 1);
      // Pull the real billed cost from Respan once spans are ingested.
      // Spans are eventually-consistent; try after a short delay, then once more.
      fetchActualCost(expId);
    }
  }, [mode, variants, cases, judgeCriteria, ensemble, judgeModel, applyEvent]);

  const fetchActualCost = useCallback(async (expId: string) => {
    const tryOnce = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/cost?experimentId=${encodeURIComponent(expId)}`);
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.found) {
          setActualCost({ usd: data.costUsd, tokens: data.tokens, count: data.requestCount });
          return true;
        }
      } catch {
        /* network blip — caller will retry */
      }
      return false;
    };
    await new Promise((r) => setTimeout(r, 2500)); // ingestion lag
    if (await tryOnce()) return;
    await new Promise((r) => setTimeout(r, 5000));
    await tryOnce();
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  // Ask the gateway to propose substantially better variants based on the
  // current ones + judge criteria, then append them. Self-improving loop.
  const evolve = useCallback(async () => {
    if (evolveBusy || running || variants.length >= MAX_VARIANTS) return;
    setEvolveBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: experimentId || undefined,
          variants,
          cases,
          judgeCriteria: judgeCriteria.trim(),
          count: Math.min(2, MAX_VARIANTS - variants.length),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner(typeof data?.error === "string" ? data.error : `Evolve failed (${res.status}).`);
        return;
      }
      const proposals: { name: string; prompt: string }[] = data.variants ?? [];
      if (proposals.length === 0) {
        setBanner("Evolve returned no usable variants.");
        return;
      }
      setVariants((prev) => {
        const room = MAX_VARIANTS - prev.length;
        return [
          ...prev,
          ...proposals.slice(0, room).map((p) => ({ id: newId(), name: p.name, prompt: p.prompt })),
        ];
      });
    } catch (err) {
      setBanner((err as Error)?.message ?? "Evolve failed.");
    } finally {
      setEvolveBusy(false);
    }
  }, [evolveBusy, running, variants, cases, judgeCriteria, experimentId]);

  // Ask the gateway to propose new discriminating test cases.
  const evolveCases = useCallback(async () => {
    if (evolveCasesBusy || running || cases.length >= MAX_CASES) return;
    setEvolveCasesBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/evolve-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: experimentId || undefined,
          variants,
          cases,
          judgeCriteria: judgeCriteria.trim(),
          count: Math.min(3, MAX_CASES - cases.length),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner(typeof data?.error === "string" ? data.error : `Generate failed (${res.status}).`);
        return;
      }
      const proposals: string[] = data.cases ?? [];
      if (proposals.length === 0) {
        setBanner("Generate returned no usable cases.");
        return;
      }
      setCasesText((prev) => {
        const trimmed = prev.replace(/\s+$/, "");
        const sep = trimmed.length === 0 ? "" : "\n";
        const room = MAX_CASES - cases.length;
        return trimmed + sep + proposals.slice(0, room).join("\n");
      });
    } catch (err) {
      setBanner((err as Error)?.message ?? "Generate failed.");
    } finally {
      setEvolveCasesBusy(false);
    }
  }, [evolveCasesBusy, running, variants, cases, judgeCriteria, experimentId]);

  const clearRun = useCallback(() => {
    setCells({});
    setResult(null);
    setMetricsLatest(null);
    setMetricsSeries([]);
    setExperimentId("");
    setRunInfo(null);
    setBanner(null);
    setSelected(null);
  }, []);

  const selectedCell = selected ? cells[selected] : null;
  const selectedMeta = useMemo(() => {
    if (!selected) return null;
    const [variantId, idxStr] = selected.split(":");
    const variant = variants.find((v) => v.id === variantId);
    const caseIndex = Number(idxStr);
    return variant ? { variant, caseIndex, input: cases[caseIndex] ?? "" } : null;
  }, [selected, variants, cases]);

  const hasResults = result != null || Object.keys(cells).length > 0;

  return (
    <DesktopProvider>
    {booting && <BootSplash onDone={finishBoot} />}
    {!booting && showLogin && <ApiKeySetup initialKey={apiKey} onContinue={completeSetup} />}
    <div className="min-h-screen bench-bg pb-12">
      <header className="sticky top-0 z-20 border-b-2 border-[#808080] bg-panel">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <WinFlag size={18} />
            <span className="display text-[14px] text-ink">
              Prompt<span className="text-accent">Arena</span>
            </span>
            <span className="hidden font-mono text-[11px] text-muted lg:inline">
              rank prompt variants on real traffic · every call a span in Respan
            </span>
          </div>
          <ExperimentChip
            experimentId={experimentId}
            model={runInfo?.model}
            mode={mode}
            dashboardUrl={runInfo?.dashboardUrl}
            actualCost={actualCost}
          />
        </div>
      </header>

      {banner && (
        <div className="animate-fade-up fixed left-1/2 top-14 z-30 max-w-[90vw] -translate-x-1/2 border-2 border-[#808080] bg-red-50 px-4 py-2 text-sm text-red-700 shadow-[3px_3px_0_0_#0006]">
          {banner}
        </div>
      )}

      {/* The desktop: windows float here on large screens, stack on small. */}
      <main className="relative mx-auto flex max-w-[1500px] flex-col gap-4 px-2 py-3 lg:block lg:min-h-[1340px]">
        <DesktopIcons onOpen={(app) => (app === "playground" ? setPlaygroundOpen(true) : setMinesweeperOpen(true))} />
        <Window id="setup" title="setup.cfg" defaultX={12} defaultY={12} w={336} bodyClassName="">
          <div className="overflow-y-auto px-3 pt-3 lg:max-h-[calc(100dvh-160px)]">
            <ConfigPanel
              variants={variants}
              casesText={casesText}
              judgeCriteria={judgeCriteria}
              mode={mode}
              ensemble={ensemble}
              caseCount={cases.length}
              truncated={truncated}
              csvNote={csvNote}
              disabled={running}
              onUpdateVariant={updateVariant}
              onAddVariant={addVariant}
              onRemoveVariant={removeVariant}
              onCasesTextChange={setCasesText}
              onJudgeCriteriaChange={setJudgeCriteria}
              onModeChange={setMode}
              onEnsembleChange={setEnsemble}
              judgeModel={judgeModel}
              onJudgeModelChange={setJudgeModel}
              onImportCsv={importCsv}
              onEvolve={evolve}
              evolveBusy={evolveBusy}
              onEvolveCases={evolveCases}
              evolveCasesBusy={evolveCasesBusy}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              model={model}
              onModelChange={setModel}
            />
          </div>
          <div className="px-3 pb-3">
            <RunControls
              estimate={estimate}
              running={running}
              validationError={validationError}
              hasResults={hasResults}
              onRun={run}
              onCancel={cancel}
            />
          </div>
        </Window>

        <Verdict
          mode={mode}
          result={result}
          running={running}
          variants={variants}
          estimate={estimate}
          validationError={validationError}
        />

        {hasResults && (
          <>
            {(running || metricsLatest) && (
              <MetricsBar latest={metricsLatest} series={metricsSeries} running={running} />
            )}
            <Leaderboard mode={mode} variants={variants} result={result} model={runInfo?.model} cells={cells} cases={cases} />
            <Matrix mode={mode} variants={variants} cases={cases} cells={cells} selected={selected} onSelect={setSelected} />
          </>
        )}

        <HistoryPanel mode={mode} refreshKey={historyRefresh} defaultMin={firstVisit} />

        {playgroundOpen && <Playground onClose={() => setPlaygroundOpen(false)} />}
        {minesweeperOpen && <Minesweeper onClose={() => setMinesweeperOpen(false)} />}
        {diffOpen && <VariantDiff variants={variants} onClose={() => setDiffOpen(false)} />}
        {notepadOpen && <Notepad onClose={() => setNotepadOpen(false)} />}
        {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
      </main>

      <DetailDrawer
        mode={mode}
        cell={selectedCell ?? null}
        variantName={selectedMeta?.variant.name ?? ""}
        variantId={selectedMeta?.variant.id}
        caseIndex={selectedMeta?.caseIndex ?? 0}
        caseInput={selectedMeta?.input ?? ""}
        pricePer1k={pricePer1k}
        experimentId={experimentId || undefined}
        dashboardUrl={runInfo?.dashboardUrl}
        onClose={() => setSelected(null)}
      />

      <AboutDialog
        open={aboutOpen}
        experimentId={experimentId}
        model={runInfo?.model}
        mode={mode}
        onClose={() => setAboutOpen(false)}
      />
      <Taskbar
        running={running}
        hasResults={hasResults}
        onNewRun={clearRun}
        onRun={run}
        onCancel={cancel}
        onExportCsv={() => exportCsv({ mode, experimentId, model: runInfo?.model ?? "", variants, cases, cells, result })}
        onExportJson={() => exportJson({ mode, experimentId, model: runInfo?.model ?? "", variants, cases, cells, result })}
        onAbout={() => setAboutOpen(true)}
        onPlayground={() => setPlaygroundOpen(true)}
        onMinesweeper={() => setMinesweeperOpen(true)}
        onDiff={() => setDiffOpen(true)}
        onNotepad={() => setNotepadOpen(true)}
        onCalculator={() => setCalcOpen(true)}
      />
    </div>
    </DesktopProvider>
  );
}

function patchCell(
  setCells: React.Dispatch<React.SetStateAction<Record<CellKey, MatrixCell>>>,
  variantId: string,
  caseIndex: number,
  patch: Partial<MatrixCell>,
) {
  const key = cellKey(variantId, caseIndex);
  setCells((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { genStatus: "pending" }), ...patch } }));
}

function ExperimentChip({
  experimentId,
  model,
  mode,
  dashboardUrl,
  actualCost,
}: {
  experimentId: string;
  model?: string;
  mode: RunMode;
  dashboardUrl?: string;
  actualCost: { usd: number; tokens: number; count: number } | null;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(experimentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`chip95 px-2 py-1 font-mono ${mode === "arena" ? "font-bold text-accent" : "text-muted"}`}>
        {mode}
      </span>
      {model && (
        <span className="chip95 hidden px-2 py-1 font-mono text-muted md:inline">{model}</span>
      )}
      {experimentId ? (
        <>
          <button
            onClick={copy}
            title="Copy experiment_id to find this run in your Respan dashboard"
            className="chip95 flex items-center gap-1.5 px-2 py-1 font-mono text-ink active:translate-y-px"
          >
            <span className="text-muted">experiment_id</span>
            <span className="max-w-[150px] truncate">{experimentId}</span>
            {copied ? (
              <Check size={12} strokeWidth={2.5} className="text-accent-glow" />
            ) : (
              <Copy size={12} strokeWidth={2} className="text-accent" />
            )}
          </button>
          {actualCost && (
            <span
              title={`Actual billed cost from Respan · ${actualCost.tokens.toLocaleString()} tokens across ${actualCost.count} spans`}
              className="chip95 px-2 py-1 font-mono text-[11px] font-bold text-[var(--color-good)]"
            >
              ${actualCost.usd.toFixed(4)} real
            </span>
          )}
          {dashboardUrl && (
            <a
              href={respanDashboardUrl({ base: dashboardUrl, experimentId })}
              target="_blank"
              rel="noopener noreferrer"
              title="Open this experiment's spans in the Respan dashboard"
              className="chip95 flex items-center gap-1 px-1.5 py-1 font-mono text-accent-glow active:translate-y-px"
            >
              <ExternalLink size={11} strokeWidth={2.5} />
              <span className="hidden md:inline">Respan</span>
            </a>
          )}
        </>
      ) : (
        <span className="text-muted">no run yet</span>
      )}
    </div>
  );
}
