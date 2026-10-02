import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BulletinRelease } from "../BulletinRelease";
import { releaseByDay, releaseSummary, type FirstCapture } from "@/lib/bulletinRelease";

/** Twelve bulletins, first captured on the 3rd, then the 8th to the 18th. */
const CAPTURES: FirstCapture[] = [3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((d, i) => {
  const m = i + 1; // bulletin months 2025-01 .. 2025-12, captured the month before
  const prior = m === 1 ? "2024-12" : `2025-${String(m - 1).padStart(2, "0")}`;
  return { month: `2025-${String(m).padStart(2, "0")}`, captured: `${prior}-${String(d).padStart(2, "0")}` };
});
const rows = releaseByDay(CAPTURES);
const summary = releaseSummary(CAPTURES)!;

describe("BulletinRelease", () => {
  it("states the half and nine-in-ten days with proper ordinals", () => {
    render(<BulletinRelease rows={rows} summary={summary} next="2026-10" measured="2026-09-26" today="2026-08-01" />);
    // 6 of 12 by the 12th, 11 of 12 (0.92) by the 17th.
    expect(screen.getByText("12th")).toBeInTheDocument();
    expect(screen.getByText("17th")).toBeInTheDocument();
    expect(document.body.textContent).toContain("The earliest came out by the 3rd.");
    expect(document.body.textContent).not.toContain("more were first captured only after");
  });

  it("names how many bulletins it set aside as no evidence, and why", () => {
    const withLate = [...CAPTURES, { month: "2016-05", captured: "2017-12-03" }];
    render(
      <BulletinRelease rows={releaseByDay(withLate)} summary={releaseSummary(withLate)!} next="2026-10" measured="2026-09-26" today="2026-08-01" />,
    );
    expect(document.body.textContent).toMatch(/Of the 12 bulletins the archive caught/);
    expect(document.body.textContent).toMatch(/1 more was first captured only after their month began/);
  });

  it("says how many were out by today when today is in the month before", () => {
    render(<BulletinRelease rows={rows} summary={summary} next="2026-10" measured="2026-09-26" today="2026-09-14" />);
    expect(document.body.textContent).toMatch(/Today is September 14\. In at least 8 of the 12 months with evidence/);
  });

  it("says the bulletin probably isn't out yet when none was this early", () => {
    render(<BulletinRelease rows={rows} summary={summary} next="2026-10" measured="2026-09-26" today="2026-09-01" />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/Today is September 1\. None of the 12 bulletins with evidence was out this early/);
    expect(text).toMatch(/October 2026 bulletin probably isn.t out yet/);
    expect(text).not.toMatch(/may well be up/);
  });

  it("says most came later when fewer than half were out by today", () => {
    // 2 of 12 by the 8th.
    render(<BulletinRelease rows={rows} summary={summary} next="2026-10" measured="2026-09-26" today="2026-09-08" />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/In at least 2 of the 12 months with evidence/);
    expect(text).toMatch(/may be up already, though most came later/);
    expect(text).not.toMatch(/may well be up/);
  });

  it("says nothing about today once the reader is past the month before", () => {
    render(<BulletinRelease rows={rows} summary={summary} next="2026-10" measured="2026-09-26" today="2026-10-02" />);
    expect(document.body.textContent).not.toContain("Today is");
  });

  it("draws one bar per day, each with its own hover detail", () => {
    const { container } = render(
      <BulletinRelease rows={rows} summary={summary} next="2026-10" measured="2026-09-26" today="2026-08-01" />,
    );
    const days = container.querySelectorAll("svg g[data-tip]");
    expect(days).toHaveLength(31);
    // 6 of the 12 were out by the 12th (the half day the summary states).
    expect(days[11]!.getAttribute("data-tip")).toBe("By the 12th of the month before\n6 of 12 bulletins out");
    // The detail lives in ChartTips, so no rect carries an SVG <title> as well.
    expect(container.querySelector("svg rect title")).toBeNull();
  });
});
