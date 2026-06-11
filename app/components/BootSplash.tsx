"use client";

import { useEffect, useState } from "react";
import { WinFlag } from "./WinFlag";

// Shown once per browser session (sessionStorage-gated) before the logon
// screen. Black background, Windows flag, "Starting Windows 95...", little
// pulsing progress bar — ~1.8s, then fades into the login.
export function BootSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1500);
    const t2 = setTimeout(onDone, 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black transition-opacity duration-300 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <WinFlag size={96} />
        <p className="text-[12px] text-white/80">
          Microsoft<sup className="text-[8px]">®</sup>
        </p>
        <p className="text-[42px] font-bold leading-none tracking-tight text-white">
          Windows<span className="ml-1 text-[#3aa6f2]">95</span>
        </p>
        <p className="mt-2 text-[12px] text-white/80">Starting PromptArena 95…</p>
        <div className="mt-3 h-[6px] w-[200px] overflow-hidden bg-white/15">
          <div className="boot-progress h-full w-[40%] bg-white/85" />
        </div>
      </div>
    </div>
  );
}
