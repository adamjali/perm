import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RfiJourney } from "../StepByStep";
import type { StageStats } from "@/lib/db/stageStats";

const path = {
  since: "2026-08-26",
  entered: 120,
  inRfi: 40,
  repliedWaiting: 20,
  decided: { certified: 45, denied: 5, withdrawn: 10, other: 0 },
  afterReply: { certified: 30, denied: 3, withdrawn: 2, other: 0 },
};
const stats = { rfiPath: path } as unknown as StageStats;
const days = [
  { date: "2026-08-20", total: 1000, certified: 0, denied: 0, withdrawn: 0 },
  { date: "2026-09-01", total: 600, certified: 540, denied: 30, withdrawn: 30 },
  { date: "2026-10-01", total: 400, certified: 380, denied: 10, withdrawn: 10 },
];

describe("RfiJourney's comparison", () => {
  it("sets the RFI cases' certified share beside every PERM case over the same weeks", () => {
    render(<RfiJourney stats={stats} clock={null} observed={days} />);
    expect(screen.getByText("How many were certified: RFI cases against every PERM case")).toBeTruthy();
    // 45 of 60 RFI cases; 920 of 1,000 cases from Aug 26 on (the Aug 20 day is before the record).
    const block = screen.getByText("How many were certified: RFI cases against every PERM case").parentElement!;
    const shares = [...block.querySelectorAll("dd")].map((d) => d.textContent);
    expect(shares).toEqual(["75%", "92%"]);
    expect(screen.getByText(/of the 60 that ended since/)).toBeTruthy();
    expect(screen.getByText(/of the 1,000 that ended since/)).toBeTruthy();
  });

  it("draws nothing when too few RFI cases have ended", () => {
    const few = { rfiPath: { ...path, inRfi: 85, decided: { certified: 20, denied: 2, withdrawn: 3, other: 0 }, afterReply: { certified: 10, denied: 0, withdrawn: 0, other: 0 } } } as unknown as StageStats;
    render(<RfiJourney stats={few} clock={null} observed={days} />);
    expect(screen.queryByText(/RFI cases against every PERM case/)).toBeNull();
  });

  it("draws nothing without our record of every case", () => {
    render(<RfiJourney stats={stats} clock={null} />);
    expect(screen.queryByText(/RFI cases against every PERM case/)).toBeNull();
  });
});
