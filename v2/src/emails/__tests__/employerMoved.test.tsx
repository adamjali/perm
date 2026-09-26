// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { EmployerMoved, mixSegments } from "../EmployerMoved";

describe("the employer alert's pending bar", () => {
  it("runs in the site's order, sums to 100 and keeps a tiny group visible", () => {
    const segs = mixSegments({ pending: 1000, queue: 990, review: 9, appeal: 1 });
    expect(segs.map((s) => s.group)).toEqual(["review", "appeal", "queue"]);
    expect(segs.reduce((a, s) => a + s.w, 0)).toBe(100);
    expect(segs.find((s) => s.group === "appeal")!.w).toBeGreaterThanOrEqual(2);
    expect(mixSegments({ pending: 0, queue: 0, review: 0, appeal: 0 })).toEqual([]);
  });

  it("names who acted and prints no reason", async () => {
    const html = await render(
      EmployerMoved({
        employerName: "Small Co",
        employerUrl: "https://permtracker.app/perm-employers/small-co",
        moves: [{ dateLabel: "Sep 25", sentence: "12 of its cases were withdrawn by the employer", tone: "neutral" }],
        mix: null,
        asOf: "September 25, 2026",
        unsubscribeUrl: "https://permtracker.app/employer-alert/unsubscribe?token=U",
      }),
    );
    expect(html).toContain("withdrawn by the employer");
    expect(html).toContain("DOL gives no reason");
    expect(html).not.toMatch(/suspend|investigat|fraud/i);
  });
});
