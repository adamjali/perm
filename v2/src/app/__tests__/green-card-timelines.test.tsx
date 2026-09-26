import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/convexStatic", () => ({ queryStatic: vi.fn() }));

import { queryStatic } from "@/lib/convexStatic";
import { computeMetrics, summarizeRfes, toBoardRow, type TimelineRecord } from "@/lib/communityTimeline";
import Page from "../(site)/(public)/green-card-timelines/page";

/**
 * The public board page. What must hold: nothing that identifies a case
 * reaches the markup, the board stays shut below its threshold and says why,
 * every stage says whether it is DOL's record or self-reported, and a Convex
 * outage renders a sentence, not a crash.
 */

const rec = (i: number, over: Partial<TimelineRecord> = {}): TimelineRecord => ({
  public: true,
  updatedAt: Date.UTC(2026, 8, 1),
  permFiledOn: "2025-06-17",
  permCertifiedOn: "2026-04-02",
  permCertifiedSource: "disclosure",
  category: "eb3",
  country: "india",
  route: "adjustment",
  premium: true,
  i140FiledOn: "2026-04-10",
  i140ApprovedOn: `2026-04-${String(18 + (i % 5)).padStart(2, "0")}`,
  rfeForm: i === 0 ? "i140" : undefined,
  rfeReason: i === 0 ? "ability-to-pay" : undefined,
  rfeOutcome: i === 0 ? "approved" : undefined,
  ...over,
});

function boardOf(records: TimelineRecord[], opensAt = 25) {
  const shared = records.filter((r) => r.public);
  return {
    total: records.length,
    shared: shared.length,
    opensAt,
    open: shared.length >= opensAt,
    metrics: computeMetrics(records),
    rfe: summarizeRfes(records),
    rows: shared.length >= opensAt ? shared.map(toBoardRow) : [],
  };
}

async function html() {
  return renderToStaticMarkup(await Page());
}

beforeEach(() => {
  vi.mocked(queryStatic).mockReset();
});

describe("/green-card-timelines", () => {
  it("keeps the board shut below the threshold and says how many are shared", async () => {
    vi.mocked(queryStatic).mockResolvedValue(boardOf(Array.from({ length: 6 }, (_, i) => rec(i))) as never);
    const out = await html();
    expect(out).toContain("Opens at 25 shared timelines. 6 so far.");
    expect(out).not.toContain("<table");
  });

  it("opens with rows at the threshold and prints no exact PERM date", async () => {
    vi.mocked(queryStatic).mockResolvedValue(boardOf(Array.from({ length: 25 }, (_, i) => rec(i))) as never);
    const out = await html();
    expect(out).toContain("<table");
    expect(out).not.toContain("2025-06-17");
    expect(out).not.toContain("2026-04-02");
    expect(out).not.toMatch(/G-\d{3}-\d{5}/);
  });

  it("labels each stage with whose record it is and prints a median only with enough timelines", async () => {
    vi.mocked(queryStatic).mockResolvedValue(boardOf(Array.from({ length: 6 }, (_, i) => rec(i))) as never);
    const out = await html();
    expect(out).toMatch(/PERM filed to certified.*?DOL&#x27;s record/s);
    expect(out).toMatch(/I-140 filed to approved, premium.*?self-reported/s);
    expect(out).toContain("Median 289 days");
    expect(out).toContain("a median needs 5, and this stage has 0");
  });

  it("lists RFE reasons, and renders a sentence when Convex can't be reached", async () => {
    vi.mocked(queryStatic).mockResolvedValue(boardOf([rec(0)]) as never);
    expect(await html()).toContain("The employer&#x27;s ability to pay the wage");
    vi.mocked(queryStatic).mockRejectedValue(new Error("down"));
    expect(await html()).toContain("can&#x27;t be read right now");
  });
});
