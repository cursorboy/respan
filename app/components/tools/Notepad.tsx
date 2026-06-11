"use client";

import { useEffect, useRef, useState } from "react";
import { Window } from "../Window";

// Minimal Win95 Notepad: title bar shows the "filename", body is a textarea,
// content auto-saves to localStorage so it survives across reloads in the same
// browser. No menubar yet — File menu would be the next obvious add.

const STORAGE_KEY = "promptarena.notepad.v1";
const NAME_KEY = "promptarena.notepad.name.v1";

export function Notepad({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState<string>("");
  const [name, setName] = useState<string>("Untitled");
  const [dirty, setDirty] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(localStorage.getItem(STORAGE_KEY) ?? "");
    setName(localStorage.getItem(NAME_KEY) || "Untitled");
  }, []);

  // Debounced autosave: write 500ms after the last keystroke.
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, text);
      setDirty(false);
    }, 500);
    return () => clearTimeout(id);
  }, [text, dirty]);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  return (
    <Window id="notepad" title={`${name}${dirty ? " *" : ""} — notepad.exe`} defaultX={180} defaultY={120} w={460} onClose={onClose}>
      <div className="mb-2 flex items-center gap-2">
        <label className="text-[11px] text-faint">File</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value || "Untitled")}
          className="field95 flex-1 px-1.5 py-0.5 font-mono text-[12px] outline-none"
        />
        <button
          onClick={() => {
            setText("");
            setDirty(true);
            ta.current?.focus();
          }}
          className="btn95 px-2 py-0.5 text-[11px]"
        >
          New
        </button>
      </div>
      <textarea
        ref={ta}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        rows={14}
        spellCheck={false}
        placeholder="Type your experiment notes here…"
        className="field95 w-full resize-y p-2 font-mono text-[12.5px] leading-relaxed outline-none"
      />
      <p className="mt-1 text-[10px] text-faint">
        {text.length.toLocaleString()} chars · {text.split(/\s+/).filter(Boolean).length} words · autosaves locally
      </p>
    </Window>
  );
}
