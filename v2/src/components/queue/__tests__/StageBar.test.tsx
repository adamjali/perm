import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageBar, StageLegend, stageTip } from "../StageBar";
import type { StageGroup } from "../stages";

/** A segment's hover detail names the DOL statuses the bar folds together. */
const STAGES: StageGroup[] = [
  { stage: "analyst", count: 1200, statuses: [{ status: "ANALYST REVIEW", count: 1200, isFinal: false }] },
  {
    stage: "held",
    count: 90,
    statuses: [
      { status: "APPLICATION ON HOLD", count: 60, isFinal: false },
      { status: "RFI ISSUED", count: 30, isFinal: false },
    ],
  },
  { stage: "appeal", count: 0, statuses: [] },
];

describe("StageBar tooltips", () => {
  it("lists the folded statuses only where a segment folds more than one", () => {
    expect(stageTip(STAGES[0]!, 1290, "Filed in March 2026")).toBe(
      "Filed in March 2026\nAnalyst review: 1,200 cases\nOf 1,290 pending",
    );
    expect(stageTip(STAGES[1]!, 1290)).toBe(
      "Out of filing order: 90 cases\nAPPLICATION ON HOLD: 60\nRFI ISSUED: 30\nOf 1,290 pending",
    );
  });

  it("puts one tip on every drawn segment and none on an empty one", () => {
    const { container } = render(<StageBar stages={STAGES} scale="composition" tipHeading="Filed in March 2026" />);
    const tips = [...container.querySelectorAll("[data-tip]")].map((el) => el.getAttribute("data-tip"));
    expect(tips).toHaveLength(2);
    expect(tips[0]).toMatch(/^Filed in March 2026\n/);
  });
});

describe("StageBar in a translated page", () => {
  it("words the hover detail in the page's language, DOL's statuses as printed", () => {
    expect(stageTip(STAGES[1]!, 1290, "Presentados en marzo de 2026", "es")).toBe(
      "Presentados en marzo de 2026\nFuera del orden de presentación: 90 casos\nAPPLICATION ON HOLD: 60\nRFI ISSUED: 30\nDe 1290 pendientes",
    );
    expect(stageTip(STAGES[0]!, 1290, undefined, "ko")).toBe("심사관 검토: 1,200건\n대기 중 1,290건 중");
  });

  it("labels the legend in the page's language", () => {
    const { container } = render(<StageLegend stages={STAGES} lang="vi" />);
    expect(container.textContent).toContain("Chuyên viên xét duyệt");
    expect(container.textContent).toContain("Ngoài thứ tự nộp");
  });
});
