/**
 * The confirmation emails must NAME the product-news opt-in they confirm.
 *
 * `newsSubscribers` rows are staged by a checkbox on an alert form and
 * confirmed by the same double-opt-in click that confirms the alert. That is
 * only consent for the second thing if the email said so, and for a while it
 * did not: the schema and `emailPrefs` docstrings both claimed the email named
 * both while no template rendered anything of the kind.
 *
 * So this is a consent gate, not a copy test. Each template gets all three
 * cases, because the defect was an absent line rather than a wrong one and
 * only the true case can catch that.
 *
 * The HTML is half the message. The text parts live in the convex modules
 * (queueAlerts / caseAlerts / bulletinAlerts) and are asserted there; both
 * halves are built from the same `includesNews` flag, threaded from the
 * subscribe request rather than queried at send time.
 */

import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { QueueAlertConfirm } from "../QueueAlertConfirm";
import { CaseAlertConfirm } from "../CaseAlertConfirm";
import { BulletinAlertConfirm } from "../BulletinAlertConfirm";

/** The disclosure, as a reader sees it. */
const DISCLOSURE = "You also asked for occasional product news";

const CONFIRM_URL = "https://example.convex.site/confirm?token=abc";

/**
 * One builder per template, so the three cases below are written once.
 * Each returns the element for a given `includesNews`, with `undefined`
 * standing for a caller that predates the prop.
 */
const TEMPLATES = [
  {
    name: "QueueAlertConfirm",
    build: (includesNews?: boolean) =>
      QueueAlertConfirm({
        filingMonth: "September 2024",
        confirmUrl: CONFIRM_URL,
        includesNews,
      }),
  },
  {
    name: "CaseAlertConfirm",
    build: (includesNews?: boolean) =>
      CaseAlertConfirm({
        caseNumber: "P-100-26125-868956",
        currentStatus: "IN PROCESS",
        employerName: "Psomagen, Inc.",
        asOf: "August 5, 2026",
        confirmUrl: CONFIRM_URL,
        includesNews,
      }),
  },
  {
    name: "BulletinAlertConfirm",
    build: (includesNews?: boolean) =>
      BulletinAlertConfirm({
        seriesLabel: "EB2 India",
        confirmUrl: CONFIRM_URL,
        includesNews,
      }),
  },
] as const;

describe("product-news opt-in disclosure", () => {
  for (const { name, build } of TEMPLATES) {
    describe(name, () => {
      it("names the news opt-in when the same click confirms it", async () => {
        const html = await render(build(true));
        expect(html).toContain(DISCLOSURE);

        // A sentence, never a second call to action: this email has one job
        // and a competing link or button would cost it the click it exists to
        // get. Asserted as a DIFFERENCE against the same email with the flag
        // off, because the layout legitimately carries its own footer links -
        // a flat "only one href" check fails on those and says nothing about
        // the line this test is here for.
        const hrefs = (markup: string) =>
          [...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
        expect(hrefs(html)).toEqual(hrefs(await render(build(false))));
      });

      it("says nothing about news when none was requested", async () => {
        expect(await render(build(false))).not.toContain(DISCLOSURE);
      });

      it("says nothing when the flag is absent, which is the safe direction", async () => {
        expect(await render(build(undefined))).not.toContain(DISCLOSURE);
      });
    });
  }
});
