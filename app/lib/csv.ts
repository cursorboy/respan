// Minimal CSV parser (no dependency). Handles quoted fields, escaped quotes
// (""), and newlines inside quotes. Used by the test-set CSV import — we take
// the first column of each row as a test case.

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++; // CRLF
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Returns the trimmed, non-empty first column of each CSV row. A header row is
 * not assumed — the user can prune the textarea afterwards.
 */
export function csvFirstColumn(text: string): string[] {
  return parseCsv(text)
    .map((r) => (r[0] ?? "").trim())
    .filter((cell) => cell.length > 0);
}
