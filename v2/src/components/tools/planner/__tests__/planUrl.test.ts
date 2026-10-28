import { describe, expect, it } from "vitest";

import { milestonesUpTo, planHref, planPatch, readPlanUrl, requiredMilestones } from "../planUrl";

const TODAY = "2026-10-28";
const read = (s: string) => readPlanUrl(new URLSearchParams(s), TODAY);

describe("readPlanUrl", () => {
  it("plans from today with nothing in the address", () => {
    expect(read("")).toEqual({ where: "start", known: {}, startOn: TODAY, category: "EB2", country: "worldwide", premium: false, route: "aos" });
  });

  it("reads the route, adjustment of status unless the address says consular processing", () => {
    expect(read("route=cp").route).toBe("cp");
    expect(read("route=elsewhere").route).toBe("aos");
    expect(planPatch({ route: "cp" }).route).toBe("cp");
    // The default leaves the address clean.
    expect(planPatch({ route: "aos" }).route).toBeNull();
  });

  it("reads every date up to where the case is, and ignores the ones past it", () => {
    const s = read("where=perm-certified&pwdf=2025-01-02&pwdi=2025-05-01&pd=2025-08-01&cert=2026-06-01&i140f=2026-07-01");
    expect(s.known).toEqual({ pwdFiled: "2025-01-02", pwdIssued: "2025-05-01", permFiled: "2025-08-01", permCertified: "2026-06-01" });
  });

  it("keeps the links made before the new keys working", () => {
    // The case page linked a certified case as date=<decision>&pd=<filing>, a filed one as date=<filing>.
    expect(read("where=perm-certified&date=2026-09-01&pd=2025-10-20").known).toEqual({ permFiled: "2025-10-20", permCertified: "2026-09-01" });
    expect(read("where=perm-filed&date=2026-01-15").known).toEqual({ permFiled: "2026-01-15" });
    // "I-140 approved" took the priority date as `date`.
    expect(read("where=i140-approved&date=2025-12-15").known).toEqual({ permFiled: "2025-12-15" });
    expect(read("date=2026-12-01").startOn).toBe("2026-12-01");
  });

  it("drops a malformed date, an unknown step, line or country", () => {
    const s = read("where=moon&pd=2026-1-1&cat=EB9&country=mars&premium=yes");
    expect(s).toEqual({ where: "start", known: {}, startOn: TODAY, category: "EB2", country: "worldwide", premium: false, route: "aos" });
  });
});

describe("planPatch", () => {
  it("writes only what changed, drops defaults and the old date key", () => {
    expect(planPatch({ permFiled: "2026-01-15", country: "india" })).toEqual({ date: null, pd: "2026-01-15", country: "india" });
    expect(planPatch({ where: "start", category: "EB2", premium: false })).toEqual({ date: null, where: null, cat: null, premium: null });
    expect(planPatch({ i485Filed: null })).toEqual({ date: null, i485f: null });
  });
});

describe("milestonesUpTo and requiredMilestones", () => {
  it("asks for the step's own date, and the priority date once past PERM", () => {
    expect(milestonesUpTo("start")).toEqual([]);
    expect(milestonesUpTo("recruiting")).toEqual(["pwdFiled", "pwdIssued"]);
    expect(requiredMilestones("perm-filed")).toEqual(["permFiled"]);
    expect(requiredMilestones("i140-filed")).toEqual(["permFiled", "i140Filed"]);
  });
});

describe("planHref", () => {
  it("links a case in from the case page, read back to the same dates", () => {
    const certified = planHref({ permFiled: "2025-10-20", permCertified: "2026-09-01" });
    expect(certified).toBe("/tools/green-card-timeline?where=perm-certified&pd=2025-10-20&cert=2026-09-01");
    expect(readPlanUrl(new URL(certified, "https://x").searchParams, TODAY).known).toEqual({ permFiled: "2025-10-20", permCertified: "2026-09-01" });
    expect(planHref({ permFiled: "2026-01-15" })).toBe("/tools/green-card-timeline?where=perm-filed&pd=2026-01-15");
  });
});
