// @vitest-environment jsdom
/**
 * Case-status email templates.
 *
 * These assert the things that are expensive to discover in a real inbox: a
 * link that resolves nowhere, a house-style violation, a figure hardcoded into
 * a template instead of arriving as a prop, and a colour pairing nobody can
 * read.
 *
 * Every gate here is probed with an input that must fail it. A check that
 * cannot fail is decoration, and the emoji and dash checks in the sibling
 * queue-email file were both written wrong the first time.
 *
 * @module
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { CaseAlertConfirm } from "../CaseAlertConfirm";
import { CaseStatusChanged } from "../CaseStatusChanged";
import type { CaseStatusChangedProps } from "../CaseStatusChanged";
import { statusMeaning } from "@/lib/caseStatusVocabulary";

const CONFIRM_URL = "https://example.convex.site/case-alert/confirm?token=abc";
const UNSUB_URL = "https://example.convex.site/case-alert/unsubscribe?token=abc";
const CASE = "P-100-26125-868956";

const confirmProps = {
  caseNumber: CASE,
  currentStatus: "IN PROCESS",
  employerName: "Psomagen, Inc.",
  asOf: "August 26, 2026",
  confirmUrl: CONFIRM_URL,
};

/** The ordinary case: still moving, and an RFI, which is the hardest one. */
const liveProps: CaseStatusChangedProps = {
  caseNumber: CASE,
  employerName: "Psomagen, Inc.",
  jobTitle: "Senior Biomedical Laboratory Technologist",
  fromStatus: "IN PROCESS",
  toStatus: "RFI ISSUED",
  tone: "live",
  // Read from the vocabulary, never copied. A hardcoded fixture kept
  // rendering the old sentence after the real string was corrected.
  meaning: statusMeaning("RFI ISSUED")!,
  isFinal: false,
  observedAt: "August 5, 2026",
  contextRows: [
    { label: "Cases now at this status", value: "906" },
    { label: "Filed the same month as yours", value: "8,172" },
    { label: "Of those, still pending", value: "7,899" },
    { label: "Pending cases filed earlier", value: "63,603" },
  ],
  contextProvenance:
    "Our mirror of DOL per-case status, as of August 26, 2026.",
  rfiRows: [
    { label: "Resolved RFIs observed", value: "2,151" },
    { label: "Of those, ended certified", value: "1,799" },
    { label: "Ended denied", value: "210" },
    { label: "Withdrawn", value: "142" },
  ],
  rfiProvenance:
    "Observed across 211,719 tracked cases. Underlying source: DOL case status on flag.dol.gov.",
  employerRows: null,
  employerProvenance: null,
  employerUrl: null,
  caseUrl: `https://permtracker.app/perm-case-status?case=${CASE}`,
  unsubscribeUrl: UNSUB_URL,
};

/** The bad-news case: final, not certified, employer record instead of a funnel. */
const closedProps: CaseStatusChangedProps = {
  ...liveProps,
  fromStatus: "ANALYST REVIEW",
  toStatus: "DENIED",
  tone: "closed",
  meaning: "DOL refused the application. A denial carries appeal rights.",
  isFinal: true,
  rfiRows: null,
  rfiProvenance: null,
  employerRows: [
    { label: "Decisions DOL has published", value: "47" },
    { label: "Of those, certified", value: "44" },
    { label: "Denied", value: "3" },
  ],
  employerProvenance: "DOL's published PERM disclosure files, FY2024 to FY2026.",
  employerUrl: "https://permtracker.app/perm-employers/psomagen-inc",
};

/** The rendered document with the shared layout's `<style>` blocks removed. */
function withoutStylesheets(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/**
 * The status block's own tone class and inline style.
 *
 * Scoped deliberately. `EmailLayout` ships a dark-mode stylesheet naming BOTH
 * `.cs-block-live` and `.cs-block-closed` on every email, and the header
 * wordmark is lime in all of them, so "does the document contain #2ECC40" is
 * true for both tones and proves nothing.
 */
function statusBlock(html: string): { tone: string; style: string } {
  const tag = /<td[^>]*class="cs-block-(live|closed)"[^>]*>/.exec(
    withoutStylesheets(html),
  );
  if (!tag) throw new Error("no status block found in the rendered email");
  const style = /style="([^"]*)"/.exec(tag[0]);
  return { tone: tag[1] as string, style: style ? (style[1] as string) : "" };
}

/** Every `href` in a rendered document, in source order. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] as string);
}

/**
 * Emoji, by Unicode property rather than by a hand-listed range.
 *
 * `Emoji_Presentation` is the set that renders as emoji by default, and U+FE0F
 * forces emoji presentation onto the rest. Between them they catch a rocket and
 * a warning sign and leave the shared footer's `©` alone, which
 * `Extended_Pictographic` does not.
 */
const EMOJI = /\p{Emoji_Presentation}|️/u;

/**
 * Claims about WHO looked. This product mirrors a third-party tracker that
 * reads DOL; it does not check DOL, so none of these may appear in an email.
 */
const OUR_CHECK_CLAIMS: RegExp[] = [
  /\bwe (?:checked|check|verified|verify|confirmed)\b/i,
  /\bour (?:check|latest check|verification)\b/i,
  /\bmirror read\b/i,
  /\bwe looked at\b/i,
];

/** Em dash and en dash. House style permits neither. */
const LONG_DASH = /[—–]/;

async function renderAll() {
  return {
    confirm: await render(CaseAlertConfirm(confirmProps)),
    live: await render(CaseStatusChanged(liveProps)),
    closed: await render(CaseStatusChanged(closedProps)),
  };
}

describe("case email templates", () => {
  it("all three render", async () => {
    const all = await renderAll();
    for (const [name, html] of Object.entries(all)) {
      expect(html.length, `${name} rendered nothing`).toBeGreaterThan(500);
    }
  });

  // -------------------------------------------------------------------------
  // House style
  // -------------------------------------------------------------------------

  it("carries no emoji", async () => {
    const all = await renderAll();
    for (const [name, html] of Object.entries(all)) {
      expect(EMOJI.test(html), `${name} contains an emoji`).toBe(false);
    }
    // Probed: the pattern must catch what it is for, and must NOT catch the
    // copyright sign the shared footer renders on every one of these.
    expect(EMOJI.test("shipped 🚀")).toBe(true);
    expect(EMOJI.test("warning ⚠️")).toBe(true);
    expect(EMOJI.test("© 2026 PERM Tracker")).toBe(false);
  });

  it("carries no em dash or en dash", async () => {
    const all = await renderAll();
    for (const [name, html] of Object.entries(all)) {
      expect(LONG_DASH.test(html), `${name} contains a long dash`).toBe(false);
    }
    expect(LONG_DASH.test("a — b")).toBe(true);
    expect(LONG_DASH.test("a – b")).toBe(true);
    // A DOL status genuinely contains a hyphen and must not be caught.
    expect(LONG_DASH.test("CERTIFIED - EXPIRED")).toBe(false);
  });

  it("never leaves a contraction clause-final", async () => {
    // "Who we're" and "how full it's" all shipped to a live page once. The
    // copula forms cannot end a clause; `n't` can ("please don't.").
    const all = await renderAll();
    const bad = /&rsquo;(?:s|re|ll|ve|d|m)(?=\s*[.,;:!?<])/i;
    for (const [name, html] of Object.entries(all)) {
      const text = html.replace(/\s+/g, " ");
      expect(bad.test(text), `${name} has a clause-final contraction`).toBe(false);
    }
    expect(bad.test("Who we&rsquo;re.")).toBe(true);
    expect(bad.test("It isn&rsquo;t.")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  it("points every link at permtracker.app or the action host", async () => {
    const all = await renderAll();
    for (const [name, html] of Object.entries(all)) {
      const links = hrefs(html);
      expect(links.length, `${name} has no links at all`).toBeGreaterThan(0);
      for (const href of links) {
        expect(
          /^https:\/\/(permtracker\.app|example\.convex\.site)(\/|$)/.test(href),
          `${name} links somewhere unexpected: ${href}`,
        ).toBe(true);
      }
    }
  });

  it("the link gate accepts the bare origin and still rejects a foreign host", () => {
    // Its first version required a trailing slash and rejected the shared
    // footer's "Open PERM Tracker", which is the bare origin. Probed both ways
    // so the widening did not also open it to anything.
    const ok = /^https:\/\/(permtracker\.app|example\.convex\.site)(\/|$)/;
    expect(ok.test("https://permtracker.app")).toBe(true);
    expect(ok.test("https://permtracker.app/privacy")).toBe(true);
    expect(ok.test("https://permtracker.app.evil.test/x")).toBe(false);
    expect(ok.test("https://bit.ly/abc")).toBe(false);
    expect(ok.test("http://permtracker.app")).toBe(false);
  });

  it("puts the opt-out in the alert and the confirm link in the confirmation", async () => {
    const { confirm, live } = await renderAll();
    expect(hrefs(live)).toContain(UNSUB_URL);
    expect(hrefs(confirm)).toContain(CONFIRM_URL);
    // A confirmation is the one email with a conversion rate to protect, so it
    // carries no onward links at all. Its only non-footer link is the button.
    const nonFooter = hrefs(confirm).filter(
      (h) => !h.startsWith("https://permtracker.app"),
    );
    expect(nonFooter).toEqual([CONFIRM_URL]);
  });

  // -------------------------------------------------------------------------
  // The transition itself
  // -------------------------------------------------------------------------

  it("shows both sides of the transition", async () => {
    const { live } = await renderAll();
    // A rail with an empty top stop reads as "your case started here", which is
    // a different and false claim.
    expect(live).toContain("IN PROCESS");
    expect(live).toContain("RFI ISSUED");
    expect(live).toContain("Was");
    expect(live).toContain("Now");
  });

  it("gives the two tones different FILLS, not two opacities", async () => {
    const { live, closed } = await renderAll();
    // Two states that differ only in opacity end up sharing one caption and
    // meaning opposite things, which this codebase shipped once on the
    // priority-date chart. Fill, not alpha.
    expect(statusBlock(live).tone).toBe("live");
    expect(statusBlock(live).style).toContain("#2ECC40");
    expect(statusBlock(closed).tone).toBe("closed");
    expect(statusBlock(closed).style).toContain("#FAFAFA");
    expect(statusBlock(closed).style).not.toContain("2ECC40");
    // No opacity anywhere on either: that is the mechanism being ruled out.
    expect(statusBlock(live).style).not.toContain("opacity");
    expect(statusBlock(closed).style).not.toContain("opacity");
  });

  it("does not paint bad news red", async () => {
    const { closed } = await renderAll();
    // Deliberate: for someone fourteen months into a wait, an alarm colour adds
    // no information to a fact they can already read, and a light label on a
    // red fill is the pairing an inverting client destroys.
    //
    // Scoped to the template's own markup. The shared layout's dark-mode
    // stylesheet legitimately defines `.em-alert-red` and `.em-closure-box` for
    // other templates, and a whole-document scan reports those as this
    // template's colours.
    const body = withoutStylesheets(closed);
    for (const red of ["#dc2626", "#DC2626", "#991b1b", "#fef2f2", "#b91c1c"]) {
      expect(body, `closed tone used ${red}`).not.toContain(red);
    }
    // Probed: the scan must still see the template's own inline colours, or it
    // is passing because it can no longer see anything.
    expect(body).toContain("#FAFAFA");
  });

  it("says this is the last alert only when the case is final", async () => {
    const { live, closed } = await renderAll();
    expect(closed).toContain("last alert");
    expect(live).not.toContain("last alert");
  });

  // -------------------------------------------------------------------------
  // Figures
  // -------------------------------------------------------------------------

  it("hardcodes no figure: every number comes from a prop", async () => {
    const { live } = await renderAll();
    for (const value of ["906", "8,172", "7,899", "63,603", "2,151", "1,799"]) {
      expect(live, `missing ${value}`).toContain(value);
    }
    // Re-render with different figures. Any number that survives unchanged is
    // baked into the template and will go stale silently.
    const other = await render(
      CaseStatusChanged({
        ...liveProps,
        contextRows: liveProps.contextRows.map((r) => ({ ...r, value: "111" })),
        rfiRows: (liveProps.rfiRows ?? []).map((r) => ({ ...r, value: "222" })),
      }),
    );
    for (const stale of ["906", "8,172", "7,899", "63,603", "2,151", "1,799"]) {
      expect(other, `${stale} is hardcoded in the template`).not.toContain(stale);
    }
  });

  it("gives every figure group its own provenance line", async () => {
    const { live, closed } = await renderAll();
    expect(live).toContain("as of August 26, 2026");
    expect(live).toContain("211,719");
    // Two datasets with two as-of dates need two groups; one line under mixed
    // sources is false about half of them.
    expect(closed).toContain("FY2024 to FY2026");
  });

  it("stands the employer record down when the RFI funnel is showing", async () => {
    // Three figure groups in one email is a spec sheet.
    const both = await render(
      CaseStatusChanged({
        ...liveProps,
        employerRows: closedProps.employerRows,
        employerProvenance: closedProps.employerProvenance,
        employerUrl: closedProps.employerUrl,
      }),
    );
    expect(both).toContain("2,151");
    expect(both).not.toContain("Decisions DOL has published");
  });

  // -------------------------------------------------------------------------
  // Degradation
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Who checked, and when
  // -------------------------------------------------------------------------

  it("never claims WE checked or verified anything", async () => {
    // This product mirrors a third-party tracker that reads DOL. It does not
    // check DOL. `last_checked_at` is written straight from that tracker's own
    // field, so it is THEIR check time, and an email is a claim delivered to
    // someone who did not ask a question at that moment.
    const all = await renderAll();
    for (const [name, html] of Object.entries(all)) {
      const text = withoutStylesheets(html).replace(/\s+/g, " ");
      for (const claim of OUR_CHECK_CLAIMS) {
        expect(text, `${name} claims we checked: ${claim}`).not.toMatch(claim);
      }
    }
  });

  it("the we-checked gate catches the real sentence and clears the fixed one", () => {
    // Probed both ways. A pattern that matches nothing passes everything, and
    // the first version of this file's emoji and dash checks were both wrong.
    const hits = (t: string) => OUR_CHECK_CLAIMS.some((r) => r.test(t));
    // The exact sentence that shipped before the correction.
    expect(hits("This is the status our mirror read on its latest check.")).toBe(true);
    expect(hits("We verified this with DOL.")).toBe(true);
    expect(hits("We checked your case this morning.")).toBe(true);
    // The corrected one, and ordinary copy that must stay clean.
    expect(hits("DOL showed this status when the case was last checked, on August 5, 2026.")).toBe(false);
    expect(hits("Counted across our mirror of DOL case status, as of August 26, 2026.")).toBe(false);
  });

  it("dates the observation, and says so when it cannot", async () => {
    const { live } = await renderAll();
    // "Your case is in ANALYST REVIEW" is a claim about the present that a
    // batch-refreshed mirror cannot support: measured, 79.8% of pending cases
    // had not been re-checked within the month. The date makes it a fact.
    expect(live).toContain("when the case was last checked, on August 5, 2026");

    // 11,955 pending rows carry no check date. A null renders its own sentence:
    // silently omitting it reads as a fresh observation.
    const undated = await render(
      CaseStatusChanged({ ...liveProps, observedAt: null }),
    );
    expect(undated).toContain("have a check date");
    expect(undated).not.toContain("last checked, on");
  });

  it("tells a new subscriber that alerts lag", async () => {
    const { confirm } = await renderAll();
    // Silence on a stale case reads as "nothing happened", which is worse than
    // no product. The expectation is set where expectations are set.
    expect(confirm).toContain("re-checked in batches");
    expect(confirm).toContain("when the status was last checked");
  });

  it("says so plainly when the status has no sourced meaning", async () => {
    const html = await render(CaseStatusChanged({ ...liveProps, meaning: null }));
    // DOL publishes no definition list for these strings. A plausible wrong
    // explanation of a government status is worse than none, because the reader
    // cannot tell them apart and will act on it.
    expect(html).toContain("not going to guess");
  });

  it("renders a confirmation for a case the mirror does not hold", async () => {
    const html = await render(
      CaseAlertConfirm({
        caseNumber: CASE,
        currentStatus: null,
        employerName: null,
        asOf: null,
        confirmUrl: CONFIRM_URL,
      }),
    );
    expect(html).toContain("Not in our mirror yet");
    // It must not promise an alert the moment the case appears: our first sight
    // cannot tell an arrival from a long-standing status.
    expect(html).toContain("first time its status moves");
    expect(hrefs(html)).toContain(CONFIRM_URL);
  });

  it("renders without an employer or a job title", async () => {
    const html = await render(
      CaseStatusChanged({
        ...liveProps,
        employerName: null,
        jobTitle: null,
      }),
    );
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain(CASE);
    expect(html).not.toContain("null");
    expect(html).not.toContain("undefined");
  });

  it("renders the longest status DOL currently uses without breaking", async () => {
    // "DENIED - BALCA DISMISSED" is 24 characters, the widest in the corpus.
    // Measured in the worst-case fallback mono at 26px it is 374px inside the
    // 465px the rail leaves, and wrapping is allowed so a longer future status
    // still cannot overflow.
    const html = await render(
      CaseStatusChanged({
        ...closedProps,
        toStatus: "DENIED - BALCA DISMISSED",
      }),
    );
    expect(html).toContain("DENIED - BALCA DISMISSED");

    // The value is PINNED to one line, because the sibling spacer at
    // `width:100%` otherwise squeezes the cell to its longest single WORD and
    // broke "RFI ISSUED" across two lines on a block with room for three times
    // the text. Scoped to the status value: `FigureTable` legitimately pins its
    // count column too, so a whole-document scan cannot tell them apart.
    const value = /<div[^>]*class="cs-block-value"[^>]*>/.exec(
      withoutStylesheets(html),
    );
    expect(value, "no status value element found").not.toBeNull();
    expect(value![0]).toContain("nowrap");

    // And a release exists, or a narrow card overflows horizontally instead.
    // A pin without its release is the half of this pair that ships silently.
    expect(html).toMatch(
      /@media only screen and \(max-width: 600px\)[\s\S]*?\.cs-block-value \{ white-space: normal/,
    );
  });
});
