/**
 * An employer's headcount and founding year as its own applications give them.
 *
 * Each PERM application types the employer's headcount and the year it began
 * (Form 9089, Section C), and one form can carry a slip: Cloudera's newest
 * decided case says 14 employees where its filings around it say 784 to 805.
 * So the figure is the middle of the newest applications that carry one, and
 * the year the one they give most often (the newest such year on a tie). A
 * headcount of 0 or a year before 1700 is a slip and doesn't count.
 */

/** How many of the newest applications the figure is read from. */
export const SIZE_SAMPLE = 50;

export interface EmployerSizeRow {
  emp_payroll: unknown;
  emp_year: unknown;
}

export interface EmployerSize {
  employees: number | null;
  since: number | null;
  /** Applications that gave a headcount, of the newest read. */
  basis: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** The typical headcount and founding year from an employer's newest applications, newest first. Pure. */
export function typicalEmployerSize(rowsNewestFirst: EmployerSizeRow[]): EmployerSize | null {
  const heads: number[] = [];
  const years = new Map<number, number>();
  const firstSeen = new Map<number, number>();
  rowsNewestFirst.slice(0, SIZE_SAMPLE).forEach((r, i) => {
    const e = num(r.emp_payroll);
    if (e !== null && e > 0) heads.push(e);
    const y = num(r.emp_year);
    if (y !== null && y >= 1700) {
      years.set(y, (years.get(y) ?? 0) + 1);
      if (!firstSeen.has(y)) firstSeen.set(y, i);
    }
  });
  let since: number | null = null;
  for (const [y, n] of years) {
    if (since === null) { since = y; continue; }
    const best = years.get(since)!;
    if (n > best || (n === best && firstSeen.get(y)! < firstSeen.get(since)!)) since = y;
  }
  const employees = median(heads);
  if (employees === null && since === null) return null;
  return { employees, since, basis: heads.length };
}

/** The note under the headcount: the founding year when there is one, else where the figure comes from. */
export function sizeNote(size: Pick<EmployerSize, "basis" | "since">): string {
  if (size.since) return `In business since ${size.since}`;
  return size.basis > 1 ? `Typical of its ${size.basis} newest filings` : "On its newest filing";
}
