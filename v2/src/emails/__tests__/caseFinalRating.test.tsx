// @vitest-environment jsdom
/**
 * The final case-status email: a "how useful were these alerts" row, and no
 * "it isn't a decision" disclaimer on a status that IS DOL's decision (Oct 6 2026).
 */
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { CaseStatusChanged, type CaseStatusChangedProps } from "../CaseStatusChanged";
import { ratingHref } from "../components/RatingRow";

const RATE = "https://permtracker.app/feedback/alerts?t=tok";

const base: CaseStatusChangedProps = {
  caseNumber: "G-100-25338-459202",
  employerName: "Acme Inc.",
  jobTitle: "Engineer",
  fromStatus: "ANALYST REVIEW",
  toStatus: "CERTIFIED",
  tone: "live",
  meaning: "DOL approved the application.",
  isFinal: true,
  observedAt: "October 5, 2026",
  contextRows: [{ label: "Cases now at this status", value: "1" }],
  contextProvenance: "Counted across our mirror of DOL case status.",
  caseUrl: "https://permtracker.app/perm-case-status?case=G-100-25338-459202",
  unsubscribeUrl: "https://permtracker.app/case-alert/unsubscribe?token=abc",
  ratingUrl: RATE,
};

const text = async (p: CaseStatusChangedProps) =>
  (await render(CaseStatusChanged(p))).replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");

describe("final case-status email", () => {
  it("asks how useful the alerts were, with five scored links", async () => {
    const html = await text(base);
    expect(html).toContain("How useful were these alerts?");
    for (const n of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`href="${ratingHref(RATE, n).replace(/&/g, "&amp;")}"`);
    }
  });

  it("drops the not-a-decision disclaimer once the status is final", async () => {
    expect(await text(base)).not.toMatch(/a decision on your case/);
  });

  it("keeps the disclaimer and shows no rating before a final status", async () => {
    const html = await text({ ...base, toStatus: "RFI ISSUED", isFinal: false });
    expect(html).toMatch(/n(’|&rsquo;|')t a decision on your case/);
    expect(html).not.toContain("How useful were these alerts?");
  });

  it("shows no rating when the sender passes no link (mail built by older callers)", async () => {
    expect(await text({ ...base, ratingUrl: null })).not.toContain("How useful were these alerts?");
  });

  it("builds each score onto the page link", () => {
    expect(ratingHref("https://x.app/f?t=a", 3)).toBe("https://x.app/f?t=a&r=3");
    expect(ratingHref("https://x.app/f", 5)).toBe("https://x.app/f?r=5");
  });
});
