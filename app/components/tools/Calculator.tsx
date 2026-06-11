"use client";

import { useState, useCallback, useEffect } from "react";
import { Window } from "../Window";

// Classic Win95 four-function calculator. State machine: an accumulator, a
// pending op, and a "just-entered-op" flag that resets the display on the next
// digit. Keyboard support: digits, + - * / = Enter . Backspace c/C.
type Op = "+" | "−" | "×" | "÷";

export function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [justOp, setJustOp] = useState(false);

  const clear = useCallback(() => {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setJustOp(false);
  }, []);

  const inputDigit = useCallback(
    (d: string) => {
      setDisplay((prev) => {
        if (justOp || prev === "0") {
          setJustOp(false);
          return d;
        }
        if (prev.length >= 14) return prev;
        return prev + d;
      });
    },
    [justOp],
  );

  const inputDot = useCallback(() => {
    setDisplay((prev) => {
      if (justOp) {
        setJustOp(false);
        return "0.";
      }
      return prev.includes(".") ? prev : prev + ".";
    });
  }, [justOp]);

  const applyOp = useCallback(
    (a: number, b: number, o: Op): number => {
      switch (o) {
        case "+":
          return a + b;
        case "−":
          return a - b;
        case "×":
          return a * b;
        case "÷":
          return b === 0 ? NaN : a / b;
      }
    },
    [],
  );

  const setBinary = useCallback(
    (next: Op) => {
      const cur = parseFloat(display);
      if (acc == null) {
        setAcc(cur);
      } else if (op && !justOp) {
        const r = applyOp(acc, cur, op);
        setAcc(r);
        setDisplay(formatNumber(r));
      }
      setOp(next);
      setJustOp(true);
    },
    [acc, op, display, justOp, applyOp],
  );

  const equals = useCallback(() => {
    if (acc == null || op == null) return;
    const cur = parseFloat(display);
    const r = applyOp(acc, cur, op);
    setDisplay(formatNumber(r));
    setAcc(null);
    setOp(null);
    setJustOp(true);
  }, [acc, op, display, applyOp]);

  // Keyboard support — only when this window is the topmost focus so we don't
  // hijack typing in other windows. Skip the parent-focus check by attaching
  // to the window and ignoring if the active element is a text input elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key >= "0" && e.key <= "9") inputDigit(e.key);
      else if (e.key === ".") inputDot();
      else if (e.key === "+") setBinary("+");
      else if (e.key === "-") setBinary("−");
      else if (e.key === "*") setBinary("×");
      else if (e.key === "/") setBinary("÷");
      else if (e.key === "Enter" || e.key === "=") equals();
      else if (e.key === "Backspace") setDisplay((d) => (d.length <= 1 ? "0" : d.slice(0, -1)));
      else if (e.key === "Escape" || e.key === "c" || e.key === "C") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputDigit, inputDot, setBinary, equals, clear]);

  const Btn = ({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) => (
    <button onClick={onClick} className={`btn95 h-10 text-[14px] font-bold ${className}`}>
      {label}
    </button>
  );

  return (
    <Window id="calculator" title="calc.exe" defaultX={220} defaultY={140} w={240} onClose={onClose}>
      <div className="bevel-in mb-2 bg-white px-2 py-1 text-right">
        <span className="font-mono text-[20px] tabular-nums text-ink">{display}</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <Btn label="C" onClick={clear} className="!text-red-700" />
        <Btn label="←" onClick={() => setDisplay((d) => (d.length <= 1 ? "0" : d.slice(0, -1)))} />
        <Btn label="±" onClick={() => setDisplay((d) => (d === "0" ? d : d.startsWith("-") ? d.slice(1) : "-" + d))} />
        <Btn label="÷" onClick={() => setBinary("÷")} className="!text-accent-glow" />
        {(["7", "8", "9"] as const).map((d) => (
          <Btn key={d} label={d} onClick={() => inputDigit(d)} />
        ))}
        <Btn label="×" onClick={() => setBinary("×")} className="!text-accent-glow" />
        {(["4", "5", "6"] as const).map((d) => (
          <Btn key={d} label={d} onClick={() => inputDigit(d)} />
        ))}
        <Btn label="−" onClick={() => setBinary("−")} className="!text-accent-glow" />
        {(["1", "2", "3"] as const).map((d) => (
          <Btn key={d} label={d} onClick={() => inputDigit(d)} />
        ))}
        <Btn label="+" onClick={() => setBinary("+")} className="!text-accent-glow" />
        <Btn label="0" onClick={() => inputDigit("0")} className="col-span-2" />
        <Btn label="." onClick={inputDot} />
        <Btn label="=" onClick={equals} className="!font-bold !text-[var(--color-good)]" />
      </div>
    </Window>
  );
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  // Trim trailing zeros without scientific notation for typical results.
  const s = n.toString();
  if (s.length <= 14) return s;
  return n.toPrecision(12).replace(/\.?0+$/, "");
}
