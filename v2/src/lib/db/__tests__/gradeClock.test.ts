import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn();
const exec = vi.fn();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec }));

const { gradeOpenPredictions } = await import("../predictions");

// A wage request DOL decided Monday Oct 12 2026 (Columbus Day), first seen by
// the morning sweep at 5:40 AM EDT Tuesday the 13th.
const SEEN = Date.UTC(2026, 9, 13, 9, 40);

describe("gradeOpenPredictions: each method on its own clock", () => {
  beforeEach(() => {
    rows.mockReset();
    exec.mockReset();
    exec.mockResolvedValue(1);
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM estimate_predictions WHERE outcome IS NULL")) {
        return [
          { id: "a", program: "pwd", case_number: "P-100-26180-000001" },
          { id: "b", program: "pwd", case_number: "P-100-26180-000001" },
        ];
      }
      if (sql.includes("FROM pwd_case_status")) {
        return [{ case_number: "P-100-26180-000001", current_status: "DETERMINATION ISSUED", fetched_at: SEEN }];
      }
      if (sql.includes("FROM pwd_case_events")) return [{ case_number: "P-100-26180-000001", t: String(SEEN) }];
      return [];
    });
  });

  it("grades the working-day method on DOL's day and every other on the sweep's", async () => {
    await gradeOpenPredictions();
    const updates = exec.mock.calls.filter(([sql]) => String(sql).includes("UPDATE estimate_predictions SET decided_on"));
    const dol = updates.find(([sql]) => String(sql).includes("model IN"));
    const rest = updates.find(([sql]) => !String(sql).includes("model IN"));
    // Ours and Rival D's wage-request range both date DOL's day, so both are graded on it.
    expect(dol?.[1]).toEqual(["2026-10-12", "DETERMINATION ISSUED", expect.any(String), "pwd", "P-100-26180-000001", "pwd-workday", "rival-pwd-range"]);
    expect(rest?.[1]?.[0]).toBe("2026-10-13");
    // The DOL-day update runs first, so the general one only reaches what it left.
    expect(updates.indexOf(dol!)).toBeLessThan(updates.indexOf(rest!));
  });
});
