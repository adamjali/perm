import { describe, expect, it } from "vitest";

import {
  type DailyReport,
  type Facts,
  RESEND_SEND_ONLY,
  convexSections,
  readReport,
  reportSubject,
  reportText,
  worstStatus,
} from "../dailyReportCompose";

const NOW = Date.UTC(2026, 8, 28, 11, 30);

const facts = (over: Partial<Facts> = {}): Facts => ({
  users: 195,
  signups24h: 2,
  logins24h: 9,
  subs: [
    { kind: "case", live: 80, confirmed24h: 1, left24h: 0 },
    { kind: "news", live: 11, confirmed24h: 0, left24h: 1 },
  ],
  errors: { count: 0, top: [] },
  outbox: { sent24h: 3, failed24h: 0, queued: 0, oldestQueuedAt: null },
  refusals: [],
  ...over,
});

const report = (statuses: DailyReport["sections"][number]["status"][]): DailyReport => ({
  day: "2026-09-28",
  generatedAt: NOW,
  sections: statuses.map((status, i) => ({ key: `s${i}`, title: `S${i}`, status, summary: "x", lines: [] })),
});

describe("the verdict", () => {
  it("is the worst section, and 'off' (no credential yet) never alarms", () => {
    expect(worstStatus(["ok", "off", "ok"])).toBe("off");
    expect(worstStatus(["ok", "warn", "unknown"])).toBe("warn");
    expect(worstStatus(["warn", "fail"])).toBe("fail");
    expect(worstStatus([])).toBe("ok");
    expect(reportSubject(report(["ok", "off"]))).toBe("PERM Tracker daily, Mon Sep 28: all clear");
  });

  it("puts the count needing a look in the subject, failures first", () => {
    expect(reportSubject(report(["warn", "ok"]))).toMatch(/: 1 to watch$/);
    expect(reportSubject(report(["fail", "warn", "fail"]))).toMatch(/: 2 failing, 1 to watch$/);
  });

  it("lists the worst sections first in the text part", () => {
    const text = reportText(report(["ok", "fail"]));
    expect(text.indexOf("[FAIL]")).toBeLessThan(text.indexOf("[OK]"));
  });
});

describe("reading the workflow's JSON", () => {
  it("refuses a report with no valid day and cleans unknown statuses", () => {
    expect(readReport(null)).toBeNull();
    expect(readReport({ day: "yesterday", sections: [] })).toBeNull();
    const r = readReport({ day: "2026-09-28", sections: [{ key: "a", status: "bogus", lines: [1, "b"] }, 7] });
    expect(r?.sections).toHaveLength(1);
    expect(r?.sections[0]).toMatchObject({ status: "unknown", lines: ["1", "b"] });
  });
});

describe("the Convex sections", () => {
  it("are all ok on a quiet day, with counts and no addresses", () => {
    const [app, email, errors] = convexSections(facts(), { sent: 40, bounced: 0, complained: 0 }, NOW);
    expect([app!.status, email!.status, errors!.status]).toEqual(["ok", "ok", "ok"]);
    expect(app!.lines.join(" ")).toContain("case 80 (+1)");
    expect(app!.lines.join(" ")).toContain("news 11 (-1)");
    expect(JSON.stringify([app, email, errors])).not.toMatch(/@/);
  });

  it("watches a Resend day near the cap, a spam complaint, failed alerts and a refused budget", () => {
    const [, email] = convexSections(
      facts({ outbox: { sent24h: 1, failed24h: 2, queued: 0, oldestQueuedAt: null }, refusals: [{ day: "2026-09-28", pool: "caseAlert", count: 3 }] }),
      { sent: 85, bounced: 1, complained: 1 },
      NOW,
    );
    expect(email!.status).toBe("warn");
    expect(email!.lines.join("\n")).toMatch(/85 of the 100/);
    expect(email!.lines.join("\n")).toMatch(/caseAlert turned away 3/);
  });

  it("reports a queued day as information, and a queue left waiting half a day as a warning", () => {
    const [, calm] = convexSections(
      facts({ refusals: [{ day: "2026-09-28", pool: "caseConfirm", count: 0, queued: 15 }] }),
      { sent: 57, bounced: 0, complained: 0 },
      NOW,
    );
    expect(calm!.status).toBe("ok");
    expect(calm!.lines.join("\n")).toMatch(/caseConfirm was full on 2026-09-28; 15 waited in the queue/);
    expect(calm!.lines.join("\n")).not.toMatch(/turned away/);

    const [, stale] = convexSections(
      facts({ confirmationQueue: { waiting: 4, oldestQueuedAt: NOW - 13 * 60 * 60 * 1000 } }),
      { sent: 57, bounced: 0, complained: 0 },
      NOW,
    );
    expect(stale!.status).toBe("warn");
    expect(stale!.lines.join("\n")).toMatch(/4 confirmations waiting in the queue, the oldest for over 12 hours/);
  });

  it("says when Resend could not be read instead of reporting zero sends, and why", () => {
    const [, email] = convexSections(facts(), "HTTP 500", NOW);
    expect(email!.status).toBe("unknown");
    expect(email!.lines[0]).toMatch(/could not be read: HTTP 500/);
    // A send-only key is a setting, not a fault: it must not read as an alarm every morning.
    const [, sendOnly] = convexSections(facts(), RESEND_SEND_ONLY, NOW);
    expect(sendOnly!.status).toBe("ok");
    expect(sendOnly!.lines[0]).toMatch(/can only send/);
  });

  it("flags an alert that has waited over a day, and many recorded errors as failing", () => {
    const [, email, errors] = convexSections(
      facts({
        outbox: { sent24h: 0, failed24h: 0, queued: 1, oldestQueuedAt: NOW - 2 * 86_400_000 },
        errors: { count: 25, top: [["caseStatusDirect.sweep", 25]] },
      }),
      { sent: 1, bounced: 0, complained: 0 },
      NOW,
    );
    expect(email!.status).toBe("warn");
    expect(errors!.status).toBe("fail");
    expect(errors!.lines).toEqual(["caseStatusDirect.sweep: 25"]);
  });
});
