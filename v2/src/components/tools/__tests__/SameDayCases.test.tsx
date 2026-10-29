import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SameDayCases } from "../SameDayCases";
import type { SameDay } from "@/lib/sameDay";

const DAY: SameDay = {
  day: "2024-11-26",
  total: 10,
  counts: { certified: 6, denied: 1, withdrawn: 1, aside: 1, inLine: 1 },
  nearby: [
    { caseNumber: "G-100-24331-501744", status: "WITHDRAWN", employerName: null, group: "withdrawn", isThis: false },
    { caseNumber: "G-100-24331-501745", status: "DENIED", employerName: null, group: "denied", isThis: false },
    { caseNumber: "G-100-24331-501888", status: "CERTIFIED", employerName: null, group: "certified", isThis: true },
  ],
};

describe("SameDayCases", () => {
  // A number on a status fill is black in both themes. Withdrawn's number had stayed white in dark mode from
  // when withdrawn was slate; on today's purple that's 4.0:1 (axe, Oct 29 2026), where black is 5.3:1.
  it("sets every neighbour's number in black, the withdrawn purple included, in both themes", () => {
    render(<SameDayCases data={DAY} />);
    for (const n of DAY.nearby) {
      const link = screen.getByTitle(new RegExp(n.caseNumber));
      expect(link.className, n.status ?? "").toContain("text-black");
      expect(link.className, n.status ?? "").not.toMatch(/dark:text-white/);
    }
  });
});
