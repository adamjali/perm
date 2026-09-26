import { describe, expect, it } from "vitest";

import { assembleSameDay, dayKey, groupOf } from "./sameDay";

const c = (serial: string, status: string, office = "G-100") => ({
  caseNumber: `${office}-26015-${serial}`,
  status,
  employerName: "ACME",
});

describe("groupOf", () => {
  it("groups DOL's words by what happened", () => {
    expect(groupOf("CERTIFIED")).toBe("certified");
    expect(groupOf("CERTIFIED - EXPIRED")).toBe("certified");
    expect(groupOf("DENIED - BALCA DISMISSED")).toBe("denied");
    expect(groupOf("WITHDRAWN")).toBe("withdrawn");
    expect(groupOf("ANALYST REVIEW")).toBe("inLine");
    expect(groupOf("RFI ISSUED")).toBe("aside");
    expect(groupOf(null)).toBe("aside");
  });
});

describe("dayKey", () => {
  it("reads the office and day code, and refuses the old short form", () => {
    expect(dayKey("g-100-26015-000123")).toEqual({ office: "G-100", code: "26015" });
    expect(dayKey("A-23043-00641")).toBeNull();
  });
});

describe("assembleSameDay", () => {
  const day = [
    ...Array.from({ length: 12 }, (_, k) => c(String(100000 + k * 7).padStart(6, "0"), k % 3 === 0 ? "CERTIFIED" : "ANALYST REVIEW")),
    c("100030", "RFI ISSUED", "G-200"),
  ];
  const me = day[6]!.caseNumber;

  it("counts the whole day, every office", () => {
    const s = assembleSameDay(me, "2026-01-15", day)!;
    expect(s.total).toBe(13);
    expect(s.counts.certified + s.counts.inLine + s.counts.aside).toBe(13);
    expect(s.counts.aside).toBe(1);
  });

  it("takes neighbours from this case's own office, in serial order, this one marked", () => {
    const s = assembleSameDay(me, "2026-01-15", day, 3)!;
    expect(s.nearby).toHaveLength(7);
    expect(s.nearby.filter((n) => n.isThis)).toHaveLength(1);
    expect(s.nearby[3]!.isThis).toBe(true);
    expect(s.nearby.every((n) => n.caseNumber.startsWith("G-100-"))).toBe(true);
    const nums = s.nearby.map((n) => n.caseNumber);
    expect([...nums].sort()).toEqual(nums);
  });

  it("clips at the ends of the day rather than padding", () => {
    const s = assembleSameDay(day[0]!.caseNumber, "2026-01-15", day, 3)!;
    expect(s.nearby[0]!.isThis).toBe(true);
    expect(s.nearby).toHaveLength(4);
  });

  it("still counts the day when this case isn't in the list", () => {
    const s = assembleSameDay("G-100-26015-999999", "2026-01-15", day)!;
    expect(s.total).toBe(13);
    expect(s.nearby).toEqual([]);
  });
});
