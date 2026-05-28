"use client";

import { FilePlus, FileDown, Info, ExternalLink, Play, Square, FlaskConical, Bomb } from "lucide-react";

export interface StartMenuActions {
  running: boolean;
  hasResults: boolean;
  onNewRun: () => void;
  onRun: () => void;
  onCancel: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onAbout: () => void;
  onPlayground: () => void;
  onMinesweeper: () => void;
}

export function StartMenu({ onClose, ...a }: StartMenuActions & { onClose: () => void }) {
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div className="bevel-out absolute bottom-[calc(100%-2px)] left-0 z-50 flex w-[270px] bg-panel">
      <div className="flex w-9 items-end justify-center bg-[var(--color-accent-glow)] pb-3">
        <span className="font-bold tracking-wide text-white [writing-mode:vertical-rl] rotate-180 text-[15px]">
          PromptArena<span className="text-[#8ec5ff]"> 95</span>
        </span>
      </div>
      <div className="flex-1 py-1">
        {a.running ? (
          <Item icon={<Square size={15} fill="currentColor" />} label="Cancel run" onClick={run(a.onCancel)} />
        ) : (
          <Item icon={<Play size={15} fill="currentColor" />} label="Run experiment" onClick={run(a.onRun)} />
        )}
        <Item icon={<FilePlus size={15} />} label="New run" onClick={run(a.onNewRun)} />
        <Divider />
        <Item icon={<FlaskConical size={15} />} label="Playground" onClick={run(a.onPlayground)} />
        <Item icon={<Bomb size={15} />} label="Minesweeper" onClick={run(a.onMinesweeper)} />
        <Divider />
        <Item icon={<FileDown size={15} />} label="Export results (CSV)" onClick={run(a.onExportCsv)} disabled={!a.hasResults} />
        <Item icon={<FileDown size={15} />} label="Export results (JSON)" onClick={run(a.onExportJson)} disabled={!a.hasResults} />
        <Divider />
        <Item icon={<Info size={15} />} label="About PromptArena…" onClick={run(a.onAbout)} />
        <Item
          icon={<ExternalLink size={15} />}
          label="Respan Docs"
          onClick={run(() => window.open("https://respan.ai/docs", "_blank", "noopener"))}
        />
      </div>
    </div>
  );
}

function Item({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-2 py-1.5 text-left text-[13px] text-ink hover:bg-[var(--color-accent-glow)] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
    >
      <span className="flex w-5 justify-center">{icon}</span>
      {label}
    </button>
  );
}

function Divider() {
  return <div className="mx-2 my-1 border-t border-[#808080]" />;
}
