// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { BulletinMoved } from "../BulletinMoved";
import { BulletinWeekly } from "../BulletinWeekly";
import { CaseAlertConfirm } from "../CaseAlertConfirm";
import { CaseStatusChanged } from "../CaseStatusChanged";
import { DailyUpdate } from "../DailyUpdate";
import { DeadlineReminder } from "../DeadlineReminder";
import { EmployerAlertConfirm } from "../EmployerAlertConfirm";
import { EmployerMoved } from "../EmployerMoved";
import { QueueReached } from "../QueueReached";
import { RfiAlert } from "../RfiAlert";
import { StatusChange } from "../StatusChange";
import type { DigestData } from "../../../convex/lib/newsletterCompose";

/**
 * Every email has a way out, and it is the right one for who receives it.
 *
 * Subscriber mail (no account) carries BOTH the one-click "stop these" for
 * its own kind and the preference page for the address, a magic link scoped
 * by token. Account mail links to Settings, where those switches live; the
 * token page must never be a door into an account. Confirmations carry
 * neither: there is no subscription to manage until the person confirms.
 */

const PREFS = "https://permtracker.app/prefs?token=T&focus=case:1";
const UNSUB = "https://permtracker.app/case-alert/unsubscribe?token=U";

const subscriberMail: Array<[string, (over?: { prefsUrl?: string }) => React.ReactElement]> = [
  [
    "CaseStatusChanged",
    (over = {}) =>
      CaseStatusChanged({
        caseNumber: "G-100-26001-000001",
        employerName: "Psomagen, Inc.",
        jobTitle: "Senior Biomedical Laboratory Technologist",
        fromStatus: "IN PROCESS",
        toStatus: "RFI ISSUED",
        tone: "live",
        meaning: null,
        isFinal: false,
        observedAt: "August 5, 2026",
        contextRows: [{ label: "Cases now at this status", value: "906" }],
        contextProvenance: "Our mirror of DOL per-case status, as of August 26, 2026.",
        rfiRows: [],
        rfiProvenance: null,
        caseUrl: "https://permtracker.app/perm-case-status?case=G-100-26001-000001",
        unsubscribeUrl: UNSUB,
        prefsUrl: PREFS,
        ...over,
      }),
  ],
  [
    "QueueReached",
    (over = {}) =>
      QueueReached({
        frontierMonth: "September 2025",
        filingMonth: "March 2025",
        asOf: "August 20, 2026",
        monthsPast: 6,
        unsubscribeUrl: UNSUB,
        prefsUrl: PREFS,
        ...over,
      }),
  ],
  [
    "EmployerMoved",
    (over = {}) =>
      EmployerMoved({
        employerName: "Adobe Inc.",
        employerUrl: "https://permtracker.app/perm-employers/adobe-inc",
        moves: [{ dateLabel: "Sep 24", sentence: "DOL put 215 of its cases on hold", tone: "bad" }],
        mix: { pending: 250, queue: 30, review: 216, appeal: 4, held: 216 },
        asOf: "September 25, 2026",
        unsubscribeUrl: UNSUB,
        prefsUrl: PREFS,
        ...over,
      }),
  ],
  [
    "BulletinMoved",
    (over = {}) =>
      BulletinMoved({
        seriesLabel: "EB-2 India",
        bulletinMonth: "2026-09",
        fromCutoff: "January 1, 2013",
        toCutoff: "February 1, 2013",
        unsubscribeUrl: UNSUB,
        prefsUrl: PREFS,
        ...over,
      }),
  ],
];

const digest: DigestData = {
  weekOf: "2026-09-08",
  dolAsOf: "2026-08-31",
  frontierMonth: "2025-11",
  averageDays: 336,
  pendingCases: 97025,
  bulletinMonth: "2026-09",
  bulletinMoves: { advanced: 5, held: 25, retrogressed: 0, total: 30 },
  notices: [],
  prefsUrl: "https://permtracker.app/prefs?token=T",
};

/** A URL as React writes it into an href: EVERY "&" becomes "&amp;". A
 * `.replace("&", ...)` escaped only the first, which passed while the test
 * URLs carried a single "&" and would fail the day one carries two. */
const inAttr = (url: string): string => url.split("&").join("&amp;");

describe("every email has a way out", () => {
  it.each(subscriberMail)("%s carries the one-click stop AND the preference page", async (_name, make) => {
    const html = await render(make());
    expect(html).toContain(UNSUB);
    expect(html).toContain(inAttr(PREFS));
    expect(html).toContain("Email preferences");
    expect(html).not.toContain("Manage notification settings");
  });

  it.each(subscriberMail)("%s without a preference link still renders (mail already built by older callers)", async (_name, make) => {
    const html = await render(make({ prefsUrl: undefined }));
    expect(html).toContain(UNSUB);
    expect(html).not.toContain("/prefs?token=");
  });

  it("the daily bundle carries the all-alerts one-click AND the preference page", async () => {
    const stop = "https://permtracker.app/prefs/unsubscribe?token=T&kind=alerts";
    const html = await render(
      DailyUpdate({
        items: [
          { kind: "case", title: "G-100-26001-000001", line: "ANALYST REVIEW to CERTIFIED", url: "https://permtracker.app/perm-case-status?case=G-100-26001-000001", tone: "good" },
          { kind: "employer", title: "Adobe Inc.", line: "DOL put 215 of its cases on hold", url: "https://permtracker.app/perm-employers/adobe-inc", tone: "bad" },
        ],
        prefsUrl: "https://permtracker.app/prefs?token=T",
        stopUrl: stop,
      }),
    );
    expect(html).toContain(inAttr(stop));
    expect(html).toContain("https://permtracker.app/prefs?token=T");
    expect(html).toContain("Email preferences");
    expect(html).not.toContain("Manage notification settings");
  });

  it("the employer confirmation carries no opt-out and names the employer from our records", async () => {
    const html = await render(
      EmployerAlertConfirm({ employerName: "Adobe Inc.", confirmUrl: "https://permtracker.app/employer-alert/confirm?token=C" }),
    );
    expect(html).toContain("Adobe Inc.");
    expect(html).not.toContain("/prefs?token=");
    expect(html).not.toContain("unsubscribe");
  });

  it("the weekly digest carries the preference page under the same label", async () => {
    const html = await render(BulletinWeekly(digest));
    expect(html).toContain("https://permtracker.app/prefs?token=T");
    expect(html).toContain("Email preferences");
  });

  it("account mail links to Settings, never to the token page", async () => {
    const reminder = await render(
      DeadlineReminder({
        employerName: "Acme Corp",
        beneficiaryName: "A. Person",
        deadlineType: "PWD Expiration",
        deadlineDate: "January 15, 2027",
        daysUntil: 7,
        caseUrl: "https://permtracker.app/cases/123",
      }),
    );
    expect(reminder).toContain("https://permtracker.app/settings");
    expect(reminder).toContain("Manage notification settings");
    expect(reminder).not.toContain("/prefs?token=");
    const rfi = await render(
      RfiAlert({ employerName: "Acme Corp", beneficiaryName: "A. Person", caseUrl: "https://permtracker.app/cases/123" } as Parameters<typeof RfiAlert>[0]),
    );
    expect(rfi).toContain("https://permtracker.app/settings");
    const status = await render(
      StatusChange({ employerName: "Acme Corp", beneficiaryName: "A. Person", caseUrl: "https://permtracker.app/cases/123", oldStatus: "pwd_pending", newStatus: "pwd_received" } as Parameters<typeof StatusChange>[0]),
    );
    expect(status).toContain("https://permtracker.app/settings");
  });

  it("a confirmation carries no opt-out: nothing exists to manage until the person confirms", async () => {
    const html = await render(
      CaseAlertConfirm({ caseNumber: "G-100-26001-000001", confirmUrl: "https://permtracker.app/case-alert/confirm?token=C" } as Parameters<typeof CaseAlertConfirm>[0]),
    );
    expect(html).not.toContain("/prefs?token=");
    expect(html).not.toContain("Manage notification settings");
  });
});
