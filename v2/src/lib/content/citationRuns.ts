/**
 * Splits text into runs so a section citation ("§ 656.17(f)(3)") can be kept on
 * one line. Browsers may break a line between ")(" in "(f)(3)", which strands
 * half a citation; a sample document's citations render inside no-wrap spans.
 * The text is unchanged: joining the runs gives back the input exactly.
 */
export interface TextRun {
  text: string;
  cite: boolean;
}

// "§" or "§§", a space (regular or no-break), the section, its subsections.
const SECTION_CITE = /§§?[ \u00a0]\d+\.\d+(?:\([A-Za-z0-9]+\))*/g;

export function citationRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const m of text.matchAll(SECTION_CITE)) {
    const at = m.index ?? 0;
    if (at > last) runs.push({ text: text.slice(last, at), cite: false });
    runs.push({ text: m[0], cite: true });
    last = at + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), cite: false });
  return runs;
}
