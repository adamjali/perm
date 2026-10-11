/**
 * DOL's disclosure file names, said in words. A reader learns nothing from
 * "PERM_Disclosure_Data_FY2026_Q3.xlsx, PERM_Disclosure_Data_New_Form_FY2024_Q4.xlsx";
 * the fiscal years the files cover is what the names carry.
 */
const FY = /FY_?(\d{4})(?:_Q([1-4]))?/i;
const ORDINAL = ["", "first", "second", "third", "fourth"] as const;

export function describeDisclosureFiles(files: readonly string[]): string {
  const read = files
    .map((f) => FY.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ fy: Number(m[1]), q: m[2] ? Number(m[2]) : 4 }));
  if (read.length === 0) {
    return files.length === 1 ? "one disclosure file" : `${files.length} disclosure files`;
  }
  const first = Math.min(...read.map((r) => r.fy));
  const last = Math.max(...read.map((r) => r.fy));
  const lastQ = Math.max(...read.filter((r) => r.fy === last).map((r) => r.q));
  const years = first === last ? `fiscal year ${last}` : `fiscal years ${first} to ${last}`;
  return lastQ < 4 ? `${years}, through the ${ORDINAL[lastQ]} quarter of ${last}` : years;
}
