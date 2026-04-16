export interface ParsedBillRow {
  name: string;
  dayOfMonth: number;
  amountCents: number;
  error?: string;
}

/**
 * Parses tab-delimited text into bill rows.
 * Each line format: name\tday\tamount
 * Blank/whitespace-only lines are skipped.
 * Amount may include leading `$` and thousands `,` separators.
 */
export function parseImportText(text: string): ParsedBillRow[] {
  const results: ParsedBillRow[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue; // skip blank lines

    const parts = line.split('\t');
    const name = (parts[0] ?? '').trim();
    const dayRaw = (parts[1] ?? '').trim();
    const amountRaw = (parts[2] ?? '').trim();

    if (!name && !dayRaw && !amountRaw) continue;

    const errors: string[] = [];

    if (!name) errors.push('name is required');

    const dayNum = parseInt(dayRaw, 10);
    if (!dayRaw || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      errors.push('day must be 1–31');
    }

    const cleaned = amountRaw.replace(/[$,\s]/g, '');
    const amountNum = parseFloat(cleaned);
    if (!amountRaw || isNaN(amountNum) || amountNum <= 0) {
      errors.push('amount must be a positive number');
    }

    if (errors.length > 0) {
      results.push({ name: name || '(blank)', dayOfMonth: dayNum || 0, amountCents: 0, error: errors.join('; ') });
    } else {
      results.push({ name, dayOfMonth: dayNum, amountCents: Math.round(amountNum * 100) });
    }
  }

  return results;
}
