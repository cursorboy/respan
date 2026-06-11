// A unique icon per app/window, by id.
import { Settings, Crown, Activity, Trophy, Grid3x3, History, FlaskConical, Bomb, AppWindow, GitCompare, FileText, Calculator as CalcIcon } from "lucide-react";

const ICON: Record<string, typeof Settings> = {
  setup: Settings,
  verdict: Crown,
  telemetry: Activity,
  leaderboard: Trophy,
  results: Grid3x3,
  history: History,
  playground: FlaskConical,
  minesweeper: Bomb,
  diff: GitCompare,
  notepad: FileText,
  calculator: CalcIcon,
};

const COLOR: Record<string, string> = {
  setup: "#5b6472",
  verdict: "#e0a400",
  telemetry: "#0e9bb0",
  leaderboard: "#1f86bd",
  results: "#263d5b",
  history: "#b06a00",
  playground: "#2e9e57",
  minesweeper: "#c00000",
  diff: "#7c3aed",
  notepad: "#3b66b5",
  calculator: "#4b5563",
};

export function AppIcon({
  id,
  size = 14,
  className,
  light,
}: {
  id: string;
  size?: number;
  className?: string;
  light?: boolean;
}) {
  const Icon = ICON[id] ?? AppWindow;
  return <Icon size={size} strokeWidth={2} className={className} style={{ color: light ? "#ffffff" : COLOR[id] ?? "#000" }} />;
}
