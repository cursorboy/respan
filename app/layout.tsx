import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Win95 UI font (Pixelated MS Sans Serif) is self-hosted via @font-face in
// globals.css. JetBrains Mono is used only for tabular data.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PromptArena — rank prompt variants on real traffic",
  description:
    "Define prompt variants, run them through the Respan gateway, and rank with a pairwise Bradley-Terry tournament and confidence intervals. Every call a span.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
