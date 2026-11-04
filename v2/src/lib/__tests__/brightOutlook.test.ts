import { describe, expect, it } from "vitest";

import { brightJobs, brightTotals, growingAndSponsored } from "../brightOutlook";

const onet = [
  { onet_code: "15-1252.00", soc7: "15-1252", title: "Software Developers", bright: "Rapid Growth; Numerous Job Openings" },
  { onet_code: "15-1299.08", soc7: "15-1299", title: "Computer Systems Engineers/Architects", bright: "Rapid Growth" },
  { onet_code: "15-1299.09", soc7: "15-1299", title: "Information Technology Project Managers", bright: "New & Emerging" },
  { onet_code: "29-1141.00", soc7: "29-1141", title: "Registered Nurses", bright: "Numerous Job Openings" },
  { onet_code: "11-1011.00", soc7: "11-1011", title: "Chief Executives", bright: "" },
];
const projections = [
  { soc7: "15-1252", title: "Software developers", change_pct: 10.2, openings: 95.3, median_wage: 135980 },
  { soc7: "15-1299", title: "computer occupations, all other", change_pct: 7.1, openings: 30.2, median_wage: 110000 },
];
const perm = [
  { code: "15-1252.00", slug: "software-developers", name: "Software Developers", total: 76524, certified: 73143, denied: 600 },
  { code: "15-1252", slug: "software-developers-2", name: "Software Developers", total: 100, certified: 90, denied: 2 },
  { code: "29-1141.00", slug: "registered-nurses", name: "Registered Nurses", total: 12, certified: 10, denied: 1 },
];
const lca = new Map([["15-1252", 658099]]);

describe("O*NET's Bright Outlook jobs beside their sponsorship", () => {
  const jobs = brightJobs(onet, projections, perm, lca);

  it("keeps one row per SOC code, busiest PERM first, and drops a code with no category", () => {
    expect(jobs.map((j) => j.soc7)).toEqual(["15-1252", "29-1141", "15-1299"]);
  });

  it("sums every PERM title under the code and links the busiest", () => {
    const sw = jobs[0]!;
    expect([sw.permDecided, sw.permCertified, sw.permDenied, sw.permSlug]).toEqual([76624, 73233, 602, "software-developers"]);
    expect(sw.categories).toEqual(["Rapid Growth", "Numerous Job Openings"]);
    expect(sw.lcaCertified).toBe(658099);
  });

  it("counts BLS's openings in full, and a rate only past the floor", () => {
    expect(jobs[0]!.openings).toBe(95300);
    expect(jobs[0]!.approval).toBeCloseTo(73233 / (73233 + 602));
    expect(jobs[1]!.approval).toBeNull(); // 11 decided, under 30
  });

  it("names the detailed occupations when O*NET marks only those inside a code, and reads & as and", () => {
    const other = jobs.find((j) => j.soc7 === "15-1299")!;
    expect(other.title).toBe("Computer occupations, all other");
    expect(other.marked).toEqual(["Computer Systems Engineers/Architects", "Information Technology Project Managers"]);
    expect(other.categories).toEqual(["Rapid Growth", "New and Emerging"]);
    expect(jobs[0]!.marked).toEqual([]);
  });

  it("leaves a code with no projection or no LCA count as unknown, never zero", () => {
    const rn = jobs.find((j) => j.soc7 === "29-1141")!;
    expect([rn.growthPct, rn.openings, rn.blsMedian, rn.lcaCertified]).toEqual([null, null, null, null]);
  });

  it("ranks the sponsored ones by growth, and totals the list", () => {
    expect(growingAndSponsored(jobs).map((j) => j.soc7)).toEqual(["15-1252"]);
    expect(brightTotals(jobs)).toEqual({
      jobs: 3,
      withPerm: 2,
      withLca: 1,
      permDecided: 76636,
      byCategory: { "Rapid Growth": 2, "Numerous Job Openings": 2, "New and Emerging": 1 },
    });
  });
});
