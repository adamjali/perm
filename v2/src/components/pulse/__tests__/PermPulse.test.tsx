import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { ActivityDay } from "@/lib/activityStats";
import { PermPulse } from "../PermPulse";

const day = (date: string, total: number, certified: number, denied = 0, withdrawn = total - certified - denied): ActivityDay =>
  ({ date, total, certified, denied, withdrawn });

const DAYS: ActivityDay[] = [
  day("2026-09-08", 700, 680, 10),
  day("2026-09-15", 800, 760, 20),
  day("2026-09-22", 900, 860, 25),
  day("2026-09-27", 8, 0, 7),
  day("2026-09-28", 712, 692, 8),
  day("2026-09-29", 989, 906, 62),
];

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("PermPulse", () => {
  const html = renderToStaticMarkup(<PermPulse days={DAYS} checkedAt={Date.UTC(2026, 8, 30, 8, 58)} />);

  it("leads with the newest day and compares it with the same weekday", () => {
    const t = text(html);
    expect(t).toContain("Decided on Tuesday, Sep 29");
    expect(t).toContain("989");
    // Tuesdays before it: 700, 800, 900, mean 800.
    expect(t).toContain("+24% vs a typical Tuesday (800)");
  });

  it("splits the day and says when DOL was last checked, in Eastern time", () => {
    const t = text(html);
    expect(t).toContain("906");
    expect(t).toContain("92% of the day");
    expect(t).toContain("Checked against DOL 4:58 AM ET, Sep 30");
  });

  it("carries every bar's numbers in a table a screen reader can read", () => {
    expect(html).toContain("<td>2026-09-29 </td><td>989 </td><td>906 </td><td>62 </td><td>21 </td>");
  });

  it("glues no two words together", () => {
    // Adjacent elements with no space between them read as one word to
    // anything that walks the DOM. Every block boundary carries a space.
    const glued = html.match(/[A-Za-z0-9]<\/(p|span|h2|dd|dt|figcaption|div)><[a-z][^>]*>[A-Za-z0-9]/g) ?? [];
    expect(glued).toEqual([]);
  });

  it("links through to the full record unless told not to", () => {
    expect(html).toContain('href="/perm-decision-activity"');
    const block = renderToStaticMarkup(
      <PermPulse days={DAYS} checkedAt={null} showLink={false} variant="block" />,
    );
    expect(block).not.toContain('href="/perm-decision-activity"');
    expect(text(block)).not.toContain("Checked against DOL");
  });

  it("renders nothing without a day on record", () => {
    expect(renderToStaticMarkup(<PermPulse days={[]} checkedAt={null} />)).toBe("");
  });
});
