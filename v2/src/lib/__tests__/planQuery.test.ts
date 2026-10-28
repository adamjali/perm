import { describe, expect, it } from "vitest";

import { parsePlanQuery, PLAN_QUEUE_FROM, planQueryHref } from "../planQuery";

const TODAY = "2026-10-28";
const q = (s: string) => parsePlanQuery(new URLSearchParams(s), TODAY);

describe("parsePlanQuery", () => {
  it("takes a filed wage request, a filed PERM and a priority date's line", () => {
    expect(q("pwd=2026-07-01&perm=2026-01-15&pd=2026-01-15&cat=EB3&country=india")).toEqual({
      pwd: "2026-07-01",
      perm: "2026-01-15",
      line: { pd: "2026-01-15", category: "EB3", country: "india" },
    });
  });

  it("asks the line about an old priority date, which the queues never reach", () => {
    expect(q("pd=2014-03-02&cat=EB2&country=india")).toEqual({ line: { pd: "2014-03-02", category: "EB2", country: "india" } });
  });

  it("refuses a day after today, and a queue day before the queues reach", () => {
    expect(q("perm=2026-10-29")).toEqual({ error: "dates can't be after today" });
    expect(q("pd=2026-10-29&cat=EB2&country=india")).toEqual({ error: "dates can't be after today" });
    expect(q("perm=2022-12-31")).toEqual({ error: expect.stringContaining(PLAN_QUEUE_FROM) });
  });

  it("refuses a malformed date, an unknown line, a line with no date and a question with nothing to ask", () => {
    expect(q("pwd=2026-7-1")).toEqual({ error: "dates must be YYYY-MM-DD" });
    expect(q("pd=2026-01-15&cat=EB1&country=india")).toHaveProperty("error");
    expect(q("pd=2026-01-15&cat=EB2&country=mars")).toHaveProperty("error");
    expect(q("pd=2026-01-15")).toHaveProperty("error");
    expect(q("cat=EB2&country=india")).toEqual({ error: expect.stringContaining("priority date") });
    expect(q("")).toHaveProperty("error");
  });
});

describe("planQueryHref", () => {
  it("asks only what it has", () => {
    expect(planQueryHref({})).toBeNull();
    expect(planQueryHref({ pwd: "2026-07-01" })).toBe("/api/plan?pwd=2026-07-01");
    expect(planQueryHref({ line: { pd: "2015-01-15", category: "EB2", country: "worldwide" } })).toBe(
      "/api/plan?pd=2015-01-15&cat=EB2&country=worldwide",
    );
  });

  it("round-trips through the parser", () => {
    const asked = { pwd: "2026-07-01", perm: "2026-01-15", line: { pd: "2026-01-15", category: "EB3", country: "china" } } as const;
    const href = planQueryHref(asked)!;
    expect(parsePlanQuery(new URL(href, "https://x").searchParams, TODAY)).toEqual(asked);
  });
});
