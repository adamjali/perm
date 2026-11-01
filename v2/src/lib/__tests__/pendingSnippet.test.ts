import { describe, expect, it } from "vitest";
import { ON_HOLD, pendingSentence, profileLine, whereTheyStand } from "@/lib/pendingSnippet";

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

describe("profileLine", () => {
  it("says the year and the queue in one sentence, without repeating the name the heading carries", () => {
    expect(profileLine(1698, "2026-10-30", counts(1368))).toBe(
      "Sponsors green cards: 1,698 PERM cases filed in the last 12 months, the newest on October 30, 2026, and 1,368 waiting with DOL.",
    );
    expect(profileLine(412, "2026-10-02", counts(218, 216))).toBe(
      "Sponsors green cards: 412 PERM cases filed in the last 12 months, the newest on October 2, 2026, and 218 waiting with DOL, 216 of them on hold.",
    );
  });

  it("keeps whichever half it has", () => {
    expect(profileLine(1, null, null)).toBe("Sponsors green cards: 1 PERM case filed in the last 12 months.");
    expect(profileLine(0, null, counts(3))).toBe("3 PERM cases waiting with DOL.");
    expect(profileLine(null, null, counts(1, 1))).toBe("1 PERM case waiting with DOL, on hold.");
    expect(profileLine(0, "2026-10-02", null)).toBeNull();
  });
});
