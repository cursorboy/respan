"use client";

import { useCallback, useEffect, useState } from "react";
import { Window } from "../Window";

const COLS = 9;
const ROWS = 9;
const MINES = 10;
const N = COLS * ROWS;

interface Cell {
  mine: boolean;
  rev: boolean;
  flag: boolean;
  adj: number;
}

type Status = "ready" | "playing" | "won" | "lost";

const NUM_COLOR = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000000", "#808080"];

function emptyBoard(): Cell[] {
  return Array.from({ length: N }, () => ({ mine: false, rev: false, flag: false, adj: 0 }));
}

function neighbors(i: number): number[] {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push(nr * COLS + nc);
    }
  return out;
}

function placeMines(board: Cell[], safe: number): Cell[] {
  const b = board.map((c) => ({ ...c }));
  const forbidden = new Set([safe, ...neighbors(safe)]);
  let placed = 0;
  while (placed < MINES) {
    const i = Math.floor(Math.random() * N);
    if (b[i].mine || forbidden.has(i)) continue;
    b[i].mine = true;
    placed++;
  }
  for (let i = 0; i < N; i++) b[i].adj = neighbors(i).filter((n) => b[n].mine).length;
  return b;
}

function floodReveal(board: Cell[], start: number): Cell[] {
  const b = board.map((c) => ({ ...c }));
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (b[i].rev || b[i].flag) continue;
    b[i].rev = true;
    if (b[i].adj === 0 && !b[i].mine) for (const n of neighbors(i)) if (!b[n].rev) stack.push(n);
  }
  return b;
}

export function Minesweeper({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [status, setStatus] = useState<Status>("ready");
  const [time, setTime] = useState(0);

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setStatus("ready");
    setTime(0);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setTime((t) => Math.min(999, t + 1)), 1000);
    return () => clearInterval(id);
  }, [status]);

  const flags = board.filter((c) => c.flag).length;

  const reveal = (i: number) => {
    if (status === "won" || status === "lost") return;
    if (board[i].rev || board[i].flag) return;
    let b = board;
    if (status === "ready") {
      b = placeMines(board, i);
      setStatus("playing");
    }
    if (b[i].mine) {
      const dead = b.map((c) => ({ ...c, rev: c.rev || c.mine }));
      dead[i] = { ...dead[i], rev: true };
      setBoard(dead);
      setStatus("lost");
      return;
    }
    const next = floodReveal(b, i);
    const revealedSafe = next.filter((c) => c.rev && !c.mine).length;
    setBoard(next);
    if (revealedSafe === N - MINES) {
      setStatus("won");
      setBoard(next.map((c) => (c.mine ? { ...c, flag: true } : c)));
    }
  };

  const toggleFlag = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    if (status === "won" || status === "lost" || board[i].rev) return;
    setBoard((prev) => prev.map((c, j) => (j === i ? { ...c, flag: !c.flag } : c)));
  };

  const face = status === "lost" ? ":(" : status === "won" ? "B)" : ":)";
  const digits = (n: number) => String(Math.max(0, Math.min(999, n))).padStart(3, "0");

  return (
    <Window id="minesweeper" title="minesweeper" defaultX={520} defaultY={150} w={232} onClose={onClose}>
      <div className="bevel-in bg-panel p-1.5">
        <div className="bevel-in mb-1.5 flex items-center justify-between bg-panel px-1.5 py-1">
          <span className="bg-black px-1 py-0.5 font-mono text-[16px] font-bold tabular-nums text-red-500">
            {digits(MINES - flags)}
          </span>
          <button onClick={reset} className="btn95 h-6 w-7 text-[13px] font-bold leading-none">
            {face}
          </button>
          <span className="bg-black px-1 py-0.5 font-mono text-[16px] font-bold tabular-nums text-red-500">{digits(time)}</span>
        </div>
        <div className="grid w-fit" style={{ gridTemplateColumns: `repeat(${COLS}, 22px)` }}>
          {board.map((cell, i) =>
            cell.rev ? (
              <div
                key={i}
                className="flex h-[22px] w-[22px] items-center justify-center border border-[#808080] font-mono text-[13px] font-bold leading-none"
                style={{ background: cell.mine && status === "lost" ? "#ff0000" : "#bdbdbd", color: NUM_COLOR[cell.adj] }}
              >
                {cell.mine ? "●" : cell.adj > 0 ? cell.adj : ""}
              </div>
            ) : (
              <button
                key={i}
                onClick={() => reveal(i)}
                onContextMenu={(e) => toggleFlag(e, i)}
                className="bevel-out h-[22px] w-[22px] bg-panel text-[12px] leading-none text-[var(--color-bad)]"
              >
                {cell.flag ? "⚑" : ""}
              </button>
            ),
          )}
        </div>
        {status === "won" ? (
          <p className="mt-1.5 text-center text-[12px] font-bold text-[var(--color-good)]">★ You swept it! You win! ★</p>
        ) : status === "lost" ? (
          <p className="mt-1.5 text-center text-[12px] font-bold text-[var(--color-bad)]">Boom! Game over — hit the face to retry</p>
        ) : (
          <p className="mt-1.5 text-center text-[10px] text-faint">left-click reveal · right-click flag</p>
        )}
      </div>
    </Window>
  );
}
