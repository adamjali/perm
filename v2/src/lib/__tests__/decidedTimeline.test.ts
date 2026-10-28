import { describe, expect, it } from "vitest";

import { decidedTimeline, type DecidedRecord } from "@/lib/decidedTimeline";

const BASE: DecidedRecord = {
  receivedDate: "2025-08-20",
  decisionDate: "2026-06-10",
  status: "Certified",
  jobOrderStart: "2025-05-01",
  jobOrderEnd: "2025-06-02",
  paper1: "The Boston Globe",
  ad1: "2025-05-04",
  paper2: "The Boston Globe",
  ad2: "2025-05-11",
  recrSteps: null,
  pwd: { number: "P-100-25001-000001", filed: "2024-11-01", determined: "2025-03-14", level: "II", wage: 98000, unit: "Year", expires: null },
};

const keys = (r: DecidedRecord) => decidedTimeline(r).steps.map((s) => s.key);

describe("a decided case's own dates", () => {
  it("runs from the wage request to the decision, in date order", () => {
    expect(keys(BASE)).toEqual(["pwd-filed", "pwd-determined", "job-order", "ad1", "ad2", "pwd-expires", "quiet", "filed", "decided"]);
  });

  it("ends the quiet period 30 days after the last step, and counts the filing from there", () => {
    const t = decidedTimeline(BASE);
    // The job order's end, Jun 2, is the last step: the window opens Jul 2.
    expect(t.quietEnd).toBe("2025-07-02");
    expect(t.filedAfterQuiet).toBe(49);
    expect(t.steps.find((s) => s.key === "filed")?.detail).toBe("49 days after the quiet period ended");
  });

  it("dates the wage's last day by the central rule when DOL's file prints none", () => {
    // A March determination runs to June 30 of the same year (calculatePWDExpiration).
    expect(decidedTimeline(BASE).steps.find((s) => s.key === "pwd-expires")?.date).toBe("2025-06-30");
    const printed = { ...BASE, pwd: { ...BASE.pwd!, expires: "2025-07-15" } };
    expect(decidedTimeline(printed).steps.find((s) => s.key === "pwd-expires")?.date).toBe("2025-07-15");
  });

  it("names the wage and its level, and the additional steps by DOL's own names", () => {
    const t = decidedTimeline({ ...BASE, recrSteps: JSON.stringify({ job_fair: ["2025-05-20", "2025-05-20"], employer_website: ["2025-05-05", "2025-06-20"] }) });
    expect(t.steps.find((s) => s.key === "pwd-determined")?.detail).toMatch(/^Level II, \$98,000/);
    expect(t.steps.find((s) => s.key === "step-job_fair")?.label).toBe("Job fairs");
    expect(t.steps.find((s) => s.key === "step-employer_website")?.until).toBe("2025-06-20");
    // A professional job: the latest-dated additional step (the website, to Jun 20) is excepted
    // (656.17(e)(1)(ii)), so the job order's end, Jun 2, is still the last step.
    expect(t.quietEnd).toBe("2025-07-02");
  });

  it("colours the decision by what DOL decided", () => {
    const tone = (status: string) => decidedTimeline({ ...BASE, status }).steps.find((s) => s.key === "decided")?.tone;
    expect(tone("Certified - Expired")).toBe("certified");
    expect(tone("Denied")).toBe("denied");
    expect(tone("Withdrawn")).toBe("withdrawn");
  });

  it("leaves out what the record lacks, without inventing a date", () => {
    const bare: DecidedRecord = { ...BASE, pwd: null, jobOrderStart: null, jobOrderEnd: null, ad1: null, ad2: null, recrSteps: "not json" };
    const t = decidedTimeline(bare);
    expect(t.steps.map((s) => s.key)).toEqual(["filed", "decided"]);
    expect(t.quietEnd).toBeNull();
    expect(t.filedAfterQuiet).toBeNull();
  });

  it("one Sunday ad is called that", () => {
    expect(decidedTimeline({ ...BASE, ad2: null }).steps.find((s) => s.key === "ad1")?.label).toBe("Sunday ad");
  });
});
