// Prompt construction + judge-output parsing. Pure functions, no I/O.

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { INPUT_PLACEHOLDER } from "./types";

/** Substitutes the test input into a variant template. */
export function renderVariant(prompt: string, input: string): string {
  return prompt.split(INPUT_PLACEHOLDER).join(input);
}

export function buildGenerateMessages(
  prompt: string,
  input: string,
): ChatCompletionMessageParam[] {
  return [{ role: "user", content: renderVariant(prompt, input) }];
}

export function buildJudgeMessages(
  criteria: string,
  input: string,
  output: string,
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content:
        "You are a strict, impartial evaluator. Score the OUTPUT against the " +
        "CRITERIA on an integer scale from 1 (worst) to 10 (best). Judge only how " +
        "well the OUTPUT satisfies the CRITERIA for the given INPUT; do not reward " +
        "length or confidence on their own. Respond with ONLY a JSON object of the " +
        'exact shape {"score": <integer 1-10>, "reason": "<one or two sentences>"}. ' +
        "No prose, no markdown, no code fences.",
    },
    {
      role: "user",
      content: `CRITERIA:\n${criteria}\n\nINPUT:\n${input}\n\nOUTPUT:\n${output}`,
    },
  ];
}

export interface JudgeResult {
  score: number;
  reason: string;
}

/**
 * Parses the judge's response into a {score, reason}. Tolerates stray prose or
 * code fences by extracting the first {...} block. Throws if no valid integer
 * score in 1..10 can be found — the caller turns that into a cell error so the
 * run continues.
 */
export function parseJudge(raw: string): JudgeResult {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("judge returned non-JSON output");
    obj = JSON.parse(match[0]);
  }

  if (typeof obj !== "object" || obj === null) {
    throw new Error("judge output was not a JSON object");
  }

  const record = obj as Record<string, unknown>;
  const score = Math.round(Number(record.score));
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    throw new Error(`judge score out of range: ${JSON.stringify(record.score)}`);
  }

  return {
    score,
    reason: typeof record.reason === "string" ? record.reason : "",
  };
}

// ---- Pairwise battle (arena mode) ----

export function buildBattleMessages(
  criteria: string,
  input: string,
  outputA: string,
  outputB: string,
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content:
        "You are a strict, impartial judge comparing two responses to the same INPUT. " +
        "Decide which response better satisfies the CRITERIA. Judge only quality against " +
        "the criteria; ignore length, position, and which one is labelled A or B. Respond " +
        'with ONLY a JSON object of the exact shape {"winner": "A" | "B" | "tie", "reason": ' +
        '"<one sentence>"}. Use "tie" only when they are genuinely indistinguishable. No ' +
        "prose, no markdown.",
    },
    {
      role: "user",
      content:
        `CRITERIA:\n${criteria}\n\nINPUT:\n${input}\n\n` +
        `RESPONSE A:\n${outputA}\n\nRESPONSE B:\n${outputB}`,
    },
  ];
}

/** Parses the battle judge's verdict into "a" | "b" | "tie" (relative to A/B as presented). */
export function parseBattle(raw: string): "a" | "b" | "tie" {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("battle judge returned non-JSON output");
    obj = JSON.parse(match[0]);
  }
  if (typeof obj !== "object" || obj === null) {
    throw new Error("battle judge output was not a JSON object");
  }
  const winner = String((obj as Record<string, unknown>).winner ?? "").trim().toLowerCase();
  if (winner === "a") return "a";
  if (winner === "b") return "b";
  if (winner === "tie" || winner === "draw" || winner === "equal") return "tie";
  throw new Error(`battle judge returned an unrecognized winner: ${winner}`);
}
