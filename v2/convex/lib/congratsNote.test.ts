import { describe, expect, it } from "vitest";
import {
  NOTES_FROM_MS,
  composeNote,
  dueOn,
  earnsNote,
  lateAfter,
  noteProgram,
} from "./congratsNote";

/** 2:15 PM EDT, Monday Oct 19 2026. */
const MON = Date.parse("2026-10-19T18:15:00Z");
const NOW = Date.parse("2026-10-22T23:00:00Z");

function decided(over: Partial<Parameters<typeof earnsNote>[0]> = {}) {
  return {
    caseNumber: "G-100-26070-123456",
    lastSeenStatus: "CERTIFIED",
    confirmedAt: MON - 30 * 86400000,
    decidedAt: MON,
    lastAlertSentAt: MON,
    ...over,
  };
}

describe("which decided cases earn a note", () => {
  it("a certified PERM case the person watched and our alert told them about", () => {
    expect(earnsNote(decided(), NOW)).toBe("perm");
  });

  it("not a denial, a withdrawal, or a certification that lapsed", () => {
    expect(earnsNote(decided({ lastSeenStatus: "DENIED" }), NOW)).toBeNull();
    expect(earnsNote(decided({ lastSeenStatus: "WITHDRAWN" }), NOW)).toBeNull();
    expect(earnsNote(decided({ lastSeenStatus: "CERTIFIED - EXPIRED" }), NOW)).toBeNull();
  });

  it("an H-1B LCA, but not an H-1B1 or E-3 one", () => {
    expect(noteProgram("I-200-26070-123456", "CERTIFIED")).toBe("lca");
    expect(noteProgram("I-203-26070-123456", "CERTIFIED")).toBeNull();
    expect(noteProgram("I-201-26070-123456", "CERTIFIED")).toBeNull();
  });

  it("a PERM job's wage request, issued or upheld, but not an H-1B one or a seasonal case", () => {
    expect(noteProgram("P-100-26070-123456", "DETERMINATION ISSUED")).toBe("pwd");
    expect(noteProgram("P-100-26070-123456", "REDETERMINATION AFFIRMED")).toBe("pwd");
    expect(noteProgram("P-200-26070-123456", "DETERMINATION ISSUED")).toBeNull();
    expect(noteProgram("H-300-26070-123456", "FULL CERTIFICATION")).toBeNull();
  });

  it("only when the alert we sent WAS the decision (a row first seen decided got no email)", () => {
    expect(earnsNote(decided({ lastAlertSentAt: MON - 5 * 86400000 }), NOW)).toBeNull();
    expect(earnsNote(decided({ lastAlertSentAt: undefined }), NOW)).toBeNull();
  });

  it("only when they were watching before DOL decided", () => {
    expect(earnsNote(decided({ confirmedAt: MON + 1000 }), NOW)).toBeNull();
    expect(earnsNote(decided({ confirmedAt: undefined }), NOW)).toBeNull();
  });

  it("not before the hand-written rounds ended, not far back, not unsubscribed", () => {
    const before = NOTES_FROM_MS - 1000;
    expect(earnsNote(decided({ decidedAt: before, lastAlertSentAt: before }), NOW)).toBeNull();
    expect(earnsNote(decided(), NOW + 30 * 86400000)).toBeNull();
    expect(earnsNote(decided({ unsubscribedAt: MON + 1000 }), NOW)).toBeNull();
  });
});

describe("when a note is due", () => {
  it("two business days after the alert's Eastern day", () => {
    expect(dueOn(MON)).toBe("2026-10-21");
    // Friday Oct 23 2026, 3 PM EDT: Monday is one business day, Tuesday two.
    expect(dueOn(Date.parse("2026-10-23T19:00:00Z"))).toBe("2026-10-27");
    // 11:30 PM EDT Monday is still Monday in Eastern time (Tuesday in UTC).
    expect(dueOn(Date.parse("2026-10-20T03:30:00Z"))).toBe("2026-10-21");
  });

  it("goes stale five business days after its day", () => {
    expect(lateAfter("2026-10-21")).toBe("2026-10-28");
  });
});

describe("the note's words", () => {
  it("names the case by its number and keeps the approved wording", () => {
    const { subject, body } = composeNote("perm", "G-100-26070-123456");
    expect(subject).toBe("Congrats, and a quick question");
    expect(body).toContain(
      "You signed up for alerts on your PERM case, G-100-26070-123456, and DOL has certified it, so congratulations!",
    );
    expect(body).toContain("Next comes the I-140.");
    expect(body).toContain("3. What would help you next: the I-140, the I-485, priority date alerts, or something else?");
    expect(body).toContain("if you'd rather I didn't write again, just say so.");
    expect(body.trimEnd().endsWith("Adam Ali\nPERM Tracker")).toBe(true);
  });

  it("each program has its own next step and question", () => {
    expect(composeNote("lca", "I-200-26070-123456").body).toContain(
      "your H-1B LCA, I-200-26070-123456, and DOL has certified it",
    );
    expect(composeNote("lca", "I-200-26070-123456").body).toContain("Next comes the H-1B petition.");
    const pwd = composeNote("pwd", "P-100-26070-123456").body;
    expect(pwd).toContain("your prevailing wage request, P-100-26070-123456, and DOL has issued the determination");
    expect(pwd).toContain("the PERM filing, recruitment deadlines, or something else?");
  });

  it("has no em dash and no doubled space", () => {
    for (const p of ["perm", "lca", "pwd"] as const) {
      const { body } = composeNote(p, "G-100-26070-123456");
      expect(body).not.toMatch(/—/);
      expect(body).not.toMatch(/ {2}/);
    }
  });
});
