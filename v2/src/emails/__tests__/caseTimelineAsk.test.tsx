// @vitest-environment jsdom
/**
 * The certified email's one extra paragraph: an ask for the reader's dates
 * after PERM, linked to the case page's timeline form. It renders only when
 * the sender passes a link (a PERM case that has just been certified), and a
 * caller that predates the prop renders exactly as before.
 */

import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { CaseStatusChanged, type CaseStatusChangedProps } from "../CaseStatusChanged";

const CASE = "G-100-25324-425560";
const base: CaseStatusChangedProps = {
  caseNumber: CASE,
  fromStatus: "ANALYST REVIEW",
  toStatus: "CERTIFIED",
  tone: "live",
  isFinal: true,
  contextRows: [{ label: "Cases now at this status", value: "1,200" }],
  contextProvenance: "DOL's own per-case status.",
  caseUrl: `https://permtracker.app/perm-case-status?case=${CASE}`,
  unsubscribeUrl: "https://example.convex.site/case-alert/unsubscribe?token=abc",
};

describe("the timeline ask in the certified email", () => {
  it("links the case page's timeline form when given a link", async () => {
    const html = await render(
      CaseStatusChanged({ ...base, timelineUrl: `${base.caseUrl}#timeline` }),
    );
    expect(html).toContain(`perm-case-status?case=${CASE}#timeline`);
    expect(html).toContain("Add your dates when they come");
    expect(html).toContain("keeps the case");
  });

  it("is absent for a caller that passes nothing, so older mail renders unchanged", async () => {
    const html = await render(CaseStatusChanged(base));
    expect(html).not.toContain("#timeline");
    expect(html).not.toContain("Add your dates");
  });

  it("carries no em dash and no exclamation mark", async () => {
    const html = await render(CaseStatusChanged({ ...base, timelineUrl: `${base.caseUrl}#timeline` }));
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/!\s/);
  });
});
