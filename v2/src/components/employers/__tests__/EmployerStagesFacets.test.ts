import { describe, expect, it } from "vitest";

import { STAGE_FACETS, largestGroup } from "../EmployerStagesTable";
import type { EmployerStageRow } from "@/lib/employerStages";

function row(byStatus: Record<string, number>): EmployerStageRow {
  const review = Object.values(byStatus).reduce((a, b) => a + b, 0);
  return { name: "ACME", slug: "acme", pending: review + 10, review, share: 0.5, byStatus } as unknown as EmployerStageRow;
}

describe("the census's status-group filters", () => {
  it("names the largest group outside the queue", () => {
    expect(largestGroup(row({ "APPLICATION ON HOLD": 5, "RFI ISSUED": 2 }))).toBe("On hold");
    expect(largestGroup(row({ "RECONSIDERATION APPEALS": 3, "BALCA APPEALS": 3, "RFI ISSUED": 5 }))).toBe("Appeals");
    expect(largestGroup(row({ "NORD ISSUED": 1 }))).toBe("Other review");
    expect(largestGroup(row({}))).toBeNull();
  });

  it("breaks a tie toward the earlier group, so a row can't flip", () => {
    expect(largestGroup(row({ "APPLICATION ON HOLD": 2, "RFI ISSUED": 2 }))).toBe("On hold");
  });

  it("says yes or no for holds and appeals", () => {
    const hold = STAGE_FACETS.find((f) => f.key === "hold")!;
    const app = STAGE_FACETS.find((f) => f.key === "appeals")!;
    expect(hold.value(row({ "APPLICATION ON HOLD": 1 }))).toBe("Some on hold");
    expect(app.value(row({ "APPLICATION ON HOLD": 1 }))).toBe("No appeals");
  });
});
