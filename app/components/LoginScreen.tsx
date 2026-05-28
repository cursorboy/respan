"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { WinFlag } from "./WinFlag";

// Windows-95 style logon screen, shown over the teal desktop on every page load.
// Deliberately NOT a dismissable window: no close control, the panel is the
// gate — you log on to continue. No password, just the Log On button.
export function LoginScreen({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 260); // let the press register, then dissolve in
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bench-bg transition-opacity duration-300 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enter();
        }}
        className="win w-[440px] max-w-[92vw] shadow-[5px_5px_0_0_#0007]"
      >
        <div className="win-title">
          <span className="flex items-center gap-1.5">
            <WinFlag size={13} /> Log On to PromptArena
          </span>
        </div>

        <div className="flex">
          {/* Classic setup-wizard art band */}
          <div
            className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-3 py-7"
            style={{ background: "var(--color-accent-glow)" }}
          >
            <WinFlag size={46} />
            <span className="display text-[22px] leading-none text-white">95</span>
          </div>

          {/* Logon form */}
          <div className="flex-1 p-5">
            <p className="display text-[17px] text-ink">PromptArena 95</p>
            <p className="mt-1.5 text-[12px] leading-snug text-ink">
              Rank prompt variants on real traffic. Every call is a span in Respan.
            </p>

            <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-2 text-[12px]">
              <label htmlFor="logon-user">User name:</label>
              <div id="logon-user" className="field95 flex items-center gap-1.5 px-2 py-1 font-mono">
                <User size={12} strokeWidth={2} className="text-accent-glow" />
                Administrator
              </div>
            </div>

            <p className="mt-3 text-[11px] text-faint">No password required &mdash; click Log On to continue.</p>

            <div className="mt-4 flex justify-end">
              <button ref={btnRef} type="submit" className="btn95 min-w-[110px] px-4 py-1.5 text-[13px] font-bold">
                Log On
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
