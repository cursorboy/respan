// Word-level diff between two strings via classic LCS (Wagner-Fischer table,
// then backtrack). Inputs are tokenized on whitespace boundaries with
// punctuation kept attached, which reads well for prompt templates.

export type DiffOp = "eq" | "add" | "del";

export interface DiffChunk {
  text: string;
  op: DiffOp;
}

function tokenize(s: string): string[] {
  // Split on whitespace, but keep the whitespace as its own token so the diff
  // can render the original spacing/newlines back faithfully.
  const out: string[] = [];
  const re = /(\s+|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(m[0]);
  return out;
}

export function wordDiff(a: string, b: string): DiffChunk[] {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;
  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack into ops in forward order.
  const ops: DiffChunk[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      ops.push({ text: A[i - 1], op: "eq" });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ text: A[i - 1], op: "del" });
      i--;
    } else {
      ops.push({ text: B[j - 1], op: "add" });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ text: A[i - 1], op: "del" });
    i--;
  }
  while (j > 0) {
    ops.push({ text: B[j - 1], op: "add" });
    j--;
  }
  ops.reverse();
  // Merge consecutive chunks with the same op so rendering is fewer nodes.
  const merged: DiffChunk[] = [];
  for (const c of ops) {
    const last = merged[merged.length - 1];
    if (last && last.op === c.op) last.text += c.text;
    else merged.push({ ...c });
  }
  return merged;
}
