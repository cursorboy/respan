"use client";

import { useRef, useState } from "react";
import { WinFlag } from "./WinFlag";

interface Props {
  initialKey: string;
  onContinue: (key: string) => void;
}

export function ApiKeySetup({ initialKey, onContinue }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [key, setKey] = useState(initialKey);
  const inputRef = useRef<HTMLInputElement>(null);

  const proceed = (k: string) => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onContinue(k), 260);
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
          proceed(key);
        }}
        className="win w-[440px] max-w-[92vw] shadow-[5px_5px_0_0_#0007]"
      >
        <div className="win-title">
          <span className="flex items-center gap-1.5">
            <WinFlag size={13} /> PromptArena 95 — Setup
          </span>
        </div>

        <div className="flex">
          {/* Art band */}
          <div
            className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-3 py-7"
            style={{ background: "var(--color-accent-glow)" }}
          >
            <WinFlag size={46} />
            <span className="display text-[22px] leading-none text-white">95</span>
          </div>

          {/* Form */}
          <div className="flex-1 p-5">
            <p className="display text-[17px] text-ink">PromptArena 95</p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">
              Enter your Respan API key to route model calls through Respan for cost tracking and observability.
            </p>

            <div className="mt-4">
              <label className="text-[12px] text-muted" htmlFor="setup-key">
                Respan API key
              </label>
              <input
                ref={inputRef}
                id="setup-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-res_…"
                spellCheck={false}
                autoFocus
                className="field95 mt-1 w-full p-1.5 font-mono text-[12px] text-ink outline-none"
              />
              <p className="mt-1 text-[11px] text-faint">
                Find it in your{" "}
                <a
                  href="https://app.respan.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-ink"
                >
                  Respan workspace settings
                </a>
                .
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="submit"
                className="btn95 w-full py-1.5 text-[13px] font-bold"
              >
                Log On →
              </button>
              <button
                type="button"
                onClick={() => proceed("")}
                className="text-center text-[11px] text-faint transition-colors hover:text-muted"
              >
                Use Piam&rsquo;s key &mdash; please don&rsquo;t spam, I&rsquo;m broke 🥺
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
