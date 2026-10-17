import { describe, expect, it } from "vitest";
import { ON_HOLD, pendingSentence, sponsorSentence, whereTheyStand } from "@/lib/pendingSnippet";

const counts = (pending: number, hold = 0) => ({
  pending,
  stages: [
    { status: "ANALYST REVIEW", n: pending - hold },
    ...(hold > 0 ? [{ status: ON_HOLD, n: hold }] : []),
  ],
});

describe("pendingSentence", () => {
  it("leads with the waiting count and names the holds", () => {
    expect(pendingSentence("Adobe Inc.", counts(218, 216))).toBe(
      "Adobe Inc. has 218 PERM cases waiting with DOL, 216 of them on hold.",
    );
  });

  it("says all of them when every waiting case is on hold", () => {
    expect(pendingSentence("Acme", counts(1831, 1831))).toBe(
      "Acme has 1,831 PERM cases waiting with DOL, all of them on hold.",
    );
  });

  it("is singular for one case", () => {
    expect(pendingSentence("Acme", counts(1))).toBe("Acme has 1 PERM case waiting with DOL.");
    expect(pendingSentence("Acme", counts(1, 1))).toBe("Acme has 1 PERM case waiting with DOL, on hold.");
  });

  it("says nothing about holds when there are none", () => {
    expect(pendingSentence("Acme", counts(12))).toBe("Acme has 12 PERM cases waiting with DOL.");
  });

  it("returns null with nothing waiting, so the page keeps its other description", () => {
    expect(pendingSentence("Acme", counts(0))).toBeNull();
    expect(pendingSentence("Acme", null)).toBeNull();
  });
});

describe("whereTheyStand", () => {
  it("agrees with the count", () => {
    expect(whereTheyStand(counts(5))).toBe("where they stand");
    expect(whereTheyStand(counts(1))).toBe("where it stands");
  });
});

describe("sponsorSentence", () => {
  it("answers from the year's filings and names the newest", () => {
    expect(sponsorSentence("Adobe Inc.", 412, "2026-10-02")).toBe(
      "Adobe Inc. sponsors green cards: it filed 412 PERM cases in the last 12 months, the newest on October 2, 2026.",
    );
    expect(sponsorSentence("Acme", 1, null)).toBe("Acme sponsors green cards: it filed 1 PERM case in the last 12 months.");
  });

  it("says nothing without a filing in the year: that isn't proof it won't sponsor", () => {
    expect(sponsorSentence("Acme", 0, "2026-10-02")).toBeNull();
    expect(sponsorSentence("Acme", null)).toBeNull();
  });
});
