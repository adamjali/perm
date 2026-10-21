/**
 * Every surface that says "due", "overdue" or "done" must agree with the
 * central deadline rules, on the same cases.
 *
 * Before this existed, four surfaces each kept their own idea of it. The
 * dashboard rebuilt half its list by hand and kept a filing window OPENING in
 * its Overdue column after the window had opened; the case cards read that
 * list, so a card could say "Filing opens: 37 days late"; the calendar kept
 * every PWD and ETA 9089 expiration and turned them red after the forms were
 * filed; the next-up box hid every past date, real misses included. Each had a
 * test, and each test pinned its own copy of the rule.
 *
 * Here one set of real case states goes through all of them:
 *   central     extractActiveDeadlines(buildDeadlineInput(case))
 *   dashboard   extractDeadlines (also the case list and the cards)
 *   calendar    caseToCalendarEvents
 *   next-up     calculateNextDeadline (case detail)
 *   auto-close  checkDeadlineViolations
 *   reminders   extractReminderDeadlines (the daily email and in-app reminders)
 *   the calendar page, from the calendar query's own row (calendarCaseRow)
 *   Google Calendar sync, from the sync query's own case (calendarSyncCase)
 * The last two go through what each query actually sends, because a copy that
 * names fields one by one is where a field gets left out (Oct 21 2026).
 * Auto-close keeps two stricter rules of its own (recruitment finished late,
 * restart viability), so the check there is one-way and the one that matters:
 * it may act only when the central rules also show a deadline as missed, and
 * a missed PWD, filing window or I-140 deadline must reach it.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildDeadlineInput, extractActiveDeadlines, extractReminderDeadlines, type LooseDeadlineCaseData } from "@/lib/perm";
import { caseToCalendarEvents } from "@/lib/calendar/event-mapper";
import { RECORDED_EVENT_TYPES } from "@/lib/calendar/types";
import type { CalendarCaseData, DeadlineType as CalendarType } from "@/lib/calendar/types";
import { calculateNextDeadline, type NextUpCaseData } from "@/components/cases/detail/next-up-section.utils";
import { extractDeadlines } from "@convex/lib/dashboardHelpers";
import { calculateDerivedDates } from "@convex/lib/derivedCalculations";
import { checkDeadlineViolations, mapCaseToEnforcementData } from "@convex/lib/deadlineEnforcementHelpers";
import { calendarCaseRow, calendarSyncCase } from "@convex/lib/caseDates";
import { CENTRAL_TO_EVENT, extractCalendarEvents, getDefaultCalendarPreferences } from "@convex/lib/calendarEventExtractor";
import { toCalendarCaseData } from "@/lib/calendar/fromQuery";
import type { Doc } from "@convex/_generated/dataModel";

const TODAY = "2025-01-15";

/** A saved case: raw dates plus the window dates the server derives on save. */
function saved(fields: Record<string, unknown>) {
  const doc: Record<string, unknown> = {
    _id: "case-1",
    employerName: "Acme",
    positionTitle: "Engineer",
    progressStatus: "working",
    isProfessionalOccupation: false,
    ...fields,
  };
  return { ...doc, ...calculateDerivedDates(doc as never) };
}

const recruitment = (first: string, secondAd: string, jobOrderEnd: string) => ({
  jobOrderStartDate: first,
  jobOrderEndDate: jobOrderEnd,
  noticeOfFilingStartDate: first,
  noticeOfFilingEndDate: jobOrderEnd,
  sundayAdFirstDate: first,
  sundayAdSecondDate: secondAd,
});

const CASES: Record<string, Record<string, unknown>> = {
  "PWD pending, expires in the future": saved({
    caseStatus: "pwd", pwdFilingDate: "2024-06-01", pwdDeterminationDate: "2024-09-01", pwdExpirationDate: "2025-06-30",
  }),
  "PWD expired and the ETA 9089 was never filed": saved({
    caseStatus: "recruitment", pwdDeterminationDate: "2024-06-01", pwdExpirationDate: "2024-12-31",
  }),
  "PWD expired after the ETA 9089 was filed": saved({
    caseStatus: "eta9089", pwdExpirationDate: "2024-12-31", ...recruitment("2024-07-07", "2024-07-14", "2024-08-10"),
    eta9089FilingDate: "2024-11-20",
  }),
  "recruitment done, window opened, closing still ahead": saved({
    caseStatus: "eta9089", pwdExpirationDate: "2025-06-30", ...recruitment("2024-09-01", "2024-09-08", "2024-10-08"),
  }),
  "filing window closed and the ETA 9089 was never filed": saved({
    caseStatus: "eta9089", pwdExpirationDate: "2025-06-30", ...recruitment("2024-07-07", "2024-07-14", "2024-08-08"),
  }),
  "certified, I-140 due in the future": saved({
    caseStatus: "i140", eta9089FilingDate: "2024-06-01", eta9089CertificationDate: "2024-11-01",
    eta9089ExpirationDate: "2025-04-30",
  }),
  "certified, I-140 filed, certification since expired": saved({
    caseStatus: "i140", eta9089FilingDate: "2024-03-01", eta9089CertificationDate: "2024-06-01",
    eta9089ExpirationDate: "2024-11-28", i140FilingDate: "2024-10-01",
  }),
  "certified, certification expired, I-140 never filed": saved({
    caseStatus: "i140", eta9089FilingDate: "2024-03-01", eta9089CertificationDate: "2024-06-01",
    eta9089ExpirationDate: "2024-11-28",
  }),
  "RFI answered": saved({
    caseStatus: "eta9089", eta9089FilingDate: "2024-10-01",
    rfiEntries: [{ id: "rfi-1", receivedDate: "2024-12-01", responseDueDate: "2025-01-01", responseSubmittedDate: "2024-12-20", createdAt: 1 }],
  }),
  "RFI overdue and unanswered": saved({
    caseStatus: "eta9089", eta9089FilingDate: "2024-10-01",
    rfiEntries: [{ id: "rfi-1", receivedDate: "2024-12-01", responseDueDate: "2025-01-10", createdAt: 1 }],
  }),
  // 20 CFR 656.40(c) as BALCA read it in Karl Storz (2011) and MPHASIS (2015):
  // recruitment begun inside the PWD's validity frees the filing from its expiry.
  "recruitment began inside the PWD, which has since expired; window still open": saved({
    caseStatus: "eta9089", pwdDeterminationDate: "2024-08-01", pwdExpirationDate: "2024-12-31",
    ...recruitment("2024-09-01", "2024-09-08", "2024-10-08"),
  }),
  "recruitment began before the determination; PWD expired unfiled": saved({
    caseStatus: "eta9089", pwdDeterminationDate: "2024-09-01", pwdExpirationDate: "2024-12-31",
    ...recruitment("2024-08-01", "2024-08-08", "2024-09-01"),
  }),
  // A professional job: one additional step may fall in the 30 days before
  // filing (20 CFR 656.17(e)(1)(ii)), so the one before it opens the window.
  "professional job, its additional steps set the window": saved({
    caseStatus: "recruitment", isProfessionalOccupation: true,
    pwdDeterminationDate: "2024-08-01", pwdExpirationDate: "2025-06-30",
    ...recruitment("2024-09-01", "2024-09-08", "2024-10-08"),
    additionalRecruitmentMethods: [
      { method: "job_fair", date: "2024-10-15" },
      { method: "campus_placement", date: "2024-12-30" },
      { method: "local_newspaper", date: "2025-01-05" },
    ],
  }),
  // An ETA 9089 denial and the 30 days to ask for review (calculators/denialReview.ts).
  "ETA 9089 denied, review not yet asked": saved({
    caseStatus: "eta9089", eta9089FilingDate: "2024-06-01", eta9089DenialDate: "2025-01-02",
  }),
  "reconsideration upheld the denial, BALCA not yet asked": saved({
    caseStatus: "eta9089", eta9089FilingDate: "2024-06-01", eta9089DenialDate: "2024-11-01",
    eta9089ReconsiderationDate: "2024-11-20", eta9089ReconsiderationDeniedDate: "2025-01-05",
  }),
  "reconsideration asked and pending": saved({
    caseStatus: "eta9089", eta9089FilingDate: "2024-06-01", eta9089DenialDate: "2025-01-02",
    eta9089ReconsiderationDate: "2025-01-10",
  }),
  "BALCA missed: upheld, and no request in 30 days": saved({
    caseStatus: "eta9089", eta9089FilingDate: "2024-06-01", eta9089DenialDate: "2024-10-01",
    eta9089ReconsiderationDate: "2024-10-15", eta9089ReconsiderationDeniedDate: "2024-12-01",
  }),
  "denied, then certified on reconsideration": saved({
    caseStatus: "i140", eta9089FilingDate: "2024-06-01", eta9089DenialDate: "2024-11-01",
    eta9089ReconsiderationDate: "2024-11-15", eta9089CertificationDate: "2025-01-05",
    eta9089ExpirationDate: "2025-07-03",
  }),
  "closed case whose dates have all passed": saved({
    caseStatus: "closed", pwdExpirationDate: "2024-12-31", ...recruitment("2024-05-05", "2024-05-12", "2024-06-10"),
  }),
};

const CALENDAR_TO_CENTRAL: Partial<Record<CalendarType, string>> = {
  pwdExpires: "pwd_expiration",
  filingWindowOpens: "filing_window_opens",
  filingWindowCloses: "filing_window_closes",
  recruitmentWindowCloses: "recruitment_window_closes",
  jobOrderStartDeadline: "job_order_start_deadline",
  noticeOfFilingStartDeadline: "notice_of_filing_start_deadline",
  firstSundayAdDeadline: "first_sunday_ad_deadline",
  secondSundayAdDeadline: "second_sunday_ad_deadline",
  eta9089Expires: "i140_filing_deadline",
  rfiDue: "rfi_due",
  rfeDue: "rfe_due",
  denialReviewDue: "denial_review_due",
  balcaRequestDue: "balca_request_due",
};

const key = (d: { type: string; date: string; daysUntil: number }) => `${d.type}@${d.date}:${d.daysUntil}`;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T15:00:00Z`)); // 10 AM Eastern: same date everywhere
});
afterAll(() => {
  vi.useRealTimers();
});

describe.each(Object.entries(CASES))("%s", (_name, doc) => {
  const central = () => extractActiveDeadlines(buildDeadlineInput(doc as LooseDeadlineCaseData), TODAY);

  it("the dashboard, case list and cards list exactly the central deadlines", () => {
    const dashboard = extractDeadlines(doc as never, TODAY).map((d) => ({
      ...d,
      type: d.type === "recruitment_window" ? "filing_window_closes" : d.type,
    }));
    expect(dashboard.map(key).sort()).toEqual(central().map(key).sort());
  });

  it("the calendar shows exactly the central deadlines, overdue only when they are", () => {
    const events = caseToCalendarEvents(doc as unknown as CalendarCaseData).filter(
      (e) => !RECORDED_EVENT_TYPES.has(e.deadlineType) && e.deadlineType !== "additionalMethod",
    );
    const calendar = events.map((e) => ({
      type: CALENDAR_TO_CENTRAL[e.deadlineType] ?? e.deadlineType,
      date: e.start.toISOString().slice(0, 10),
      daysUntil: e.daysUntil,
    }));
    expect(calendar.map(key).sort()).toEqual(central().map(key).sort());
    for (const e of events) expect(e.urgency === "overdue").toBe(e.daysUntil < 0);
  });

  it("the next-up box shows the central list's most urgent deadline", () => {
    const next = calculateNextDeadline(doc as unknown as NextUpCaseData);
    const first = central()[0];
    expect(next ? { date: next.date, daysUntil: next.daysUntil } : null).toEqual(
      first ? { date: first.date, daysUntil: first.daysUntil } : null,
    );
  });

  it("auto-close acts only on a deadline the central rules also show as missed", () => {
    const violation = checkDeadlineViolations(mapCaseToEnforcementData(doc as never), TODAY);
    const missed = central().filter((d) => d.daysUntil < 0).map((d) => d.type);
    if (violation) expect(missed.length).toBeGreaterThan(0);
    const closing = ["pwd_expiration", "filing_window_closes", "i140_filing_deadline", "recruitment_window_closes"];
    if (missed.some((t) => closing.includes(t))) expect(violation).not.toBeNull();
  });

  it("the calendar page shows the central deadlines from what its query sends", () => {
    const row = calendarCaseRow(doc as unknown as Doc<"cases">);
    const events = caseToCalendarEvents(toCalendarCaseData(row as never)).filter(
      (e) => !RECORDED_EVENT_TYPES.has(e.deadlineType) && e.deadlineType !== "additionalMethod",
    );
    const calendar = events.map((e) => ({
      type: CALENDAR_TO_CENTRAL[e.deadlineType] ?? e.deadlineType,
      date: e.start.toISOString().slice(0, 10),
      daysUntil: e.daysUntil,
    }));
    expect(calendar.map(key).sort()).toEqual(central().map(key).sort());
  });

  it("Google Calendar sync sends the central deadlines still ahead, from what its query reads", () => {
    const sync = calendarSyncCase({ ...doc, calendarSyncEnabled: true } as unknown as Doc<"cases">);
    const sent = extractCalendarEvents(sync, getDefaultCalendarPreferences(), TODAY)
      .events.filter((e) => e.eventType !== "eta9089_filing")
      .map((e) => `${e.eventType}@${e.date}`);
    const ahead = central()
      .filter((d) => d.daysUntil >= 0)
      .map((d) => `${CENTRAL_TO_EVENT[d.type as keyof typeof CENTRAL_TO_EVENT]}@${d.date}`);
    expect(sent.sort()).toEqual(ahead.sort());
  });

  it("reminders list the central deadlines, all but a filing window's opening", () => {
    const reminders = extractReminderDeadlines(doc as LooseDeadlineCaseData);
    const expected = central().filter((d) => d.type !== "filing_window_opens");
    expect(reminders.map(key).sort()).toEqual(expected.map(key).sort());
  });
});

describe("what each state should say", () => {
  const types = (name: string) =>
    extractActiveDeadlines(buildDeadlineInput(CASES[name] as LooseDeadlineCaseData), TODAY).map((d) => [d.type, d.daysUntil < 0]);

  it("a PWD that expired after filing is not a deadline anywhere", () => {
    expect(types("PWD expired after the ETA 9089 was filed").map(([t]) => t)).not.toContain("pwd_expiration");
  });
  it("a PWD that expired unfiled is a real miss", () => {
    expect(types("PWD expired and the ETA 9089 was never filed")).toContainEqual(["pwd_expiration", true]);
  });
  it("an opened filing window leaves only its closing", () => {
    const t = types("recruitment done, window opened, closing still ahead");
    expect(t.map(([x]) => x)).not.toContain("filing_window_opens");
    expect(t).toContainEqual(["filing_window_closes", false]);
  });
  it("an I-140 filed in time leaves no expiry deadline", () => {
    expect(types("certified, I-140 filed, certification since expired")).toEqual([]);
  });
  it("an answered RFI is gone; an unanswered one past due is a miss", () => {
    expect(types("RFI answered").map(([t]) => t)).not.toContain("rfi_due");
    expect(types("RFI overdue and unanswered")).toContainEqual(["rfi_due", true]);
  });
  it("recruitment begun inside the PWD: its expiry is no deadline, and the window closes 180 days from the first step", () => {
    const name = "recruitment began inside the PWD, which has since expired; window still open";
    const all = extractActiveDeadlines(buildDeadlineInput(CASES[name] as LooseDeadlineCaseData), TODAY);
    expect(all.map((d) => d.type)).not.toContain("pwd_expiration");
    expect(all.find((d) => d.type === "filing_window_closes")).toMatchObject({ date: "2025-02-28", daysUntil: 44 });
    expect(checkDeadlineViolations(mapCaseToEnforcementData(CASES[name] as never), TODAY)).toBeNull();
  });
  it("recruitment begun before the determination: the expiry still binds, and it was missed", () => {
    const name = "recruitment began before the determination; PWD expired unfiled";
    const missed = types(name).filter(([, past]) => past).map(([t]) => t);
    expect(missed.length).toBeGreaterThan(0);
    expect(checkDeadlineViolations(mapCaseToEnforcementData(CASES[name] as never), TODAY)).not.toBeNull();
  });
  it("a denial owes a review request 30 days from the letter", () => {
    const all = extractActiveDeadlines(buildDeadlineInput(CASES["ETA 9089 denied, review not yet asked"] as LooseDeadlineCaseData), TODAY);
    expect(all.find((d) => d.type === "denial_review_due")).toMatchObject({ date: "2025-02-01", daysUntil: 17 });
  });
  it("an upheld reconsideration owes BALCA 30 days from its notice", () => {
    const all = extractActiveDeadlines(buildDeadlineInput(CASES["reconsideration upheld the denial, BALCA not yet asked"] as LooseDeadlineCaseData), TODAY);
    expect(all.find((d) => d.type === "balca_request_due")).toMatchObject({ date: "2025-02-04", daysUntil: 20 });
    expect(all.map((d) => d.type)).not.toContain("denial_review_due");
  });
  it("a professional job's window opens 30 days after its next-to-last additional step", () => {
    const all = extractActiveDeadlines(buildDeadlineInput(CASES["professional job, its additional steps set the window"] as LooseDeadlineCaseData), TODAY);
    expect(all.find((d) => d.type === "filing_window_opens")).toMatchObject({ date: "2025-01-29", daysUntil: 14 });
  });
  it("a pending reconsideration owes nothing yet", () => {
    expect(types("reconsideration asked and pending")).toEqual([]);
  });
  it("a missed BALCA request stays a miss and the case stays open", () => {
    const name = "BALCA missed: upheld, and no request in 30 days";
    expect(types(name)).toContainEqual(["balca_request_due", true]);
  });
  it("a certification after a denial reverses it: the I-140 deadline, no review deadline", () => {
    const t = types("denied, then certified on reconsideration").map(([x]) => x);
    expect(t).toContain("i140_filing_deadline");
    expect(t).not.toContain("denial_review_due");
    expect(t).not.toContain("balca_request_due");
  });
  it("a closed case has no deadlines at all", () => {
    expect(types("closed case whose dates have all passed")).toEqual([]);
  });
});
