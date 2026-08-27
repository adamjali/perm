/**
 * Writes the three case-alert emails to the scratchpad for a real-inbox send.
 *
 * A test rather than a script, matching `zz-render-preview.test.tsx`: vitest
 * already resolves this project's TSX and path aliases and a standalone node
 * script does not, so reusing the working harness beats configuring a second.
 *
 * EVERY FIGURE BELOW IS REAL, read out of the live mirror on 2026-08-27. The
 * transitions are the one hypothetical part, because a demo cannot wait for a
 * federal agency to move a case, and the report that ships with these says so.
 * Inventing the counts as well would have made the sample worthless for judging
 * whether the numbers read correctly at real magnitudes.
 */
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { writeFileSync, mkdirSync } from "node:fs";
import { statusMeaning } from "@/lib/caseStatusVocabulary";
import { CaseAlertConfirm } from "../CaseAlertConfirm";
import { CaseStatusChanged } from "../CaseStatusChanged";

const OUT =
  "/private/tmp/claude-501/-Users-adammohamed-cc-perm-tracker-v2/43f340d7-ecc8-4c9c-afe3-e9f6eadeda4d/scratchpad/emailrender";

const CONFIRM_URL =
  "https://giant-dragon-464.convex.site/case-alert/confirm?token=EXAMPLE";
const UNSUB_URL =
  "https://giant-dragon-464.convex.site/case-alert/unsubscribe?token=EXAMPLE";

describe("render case-alert previews for a test send", () => {
  it("writes all three to the scratchpad", async () => {
    mkdirSync(OUT, { recursive: true });

    // P-100-26125-868956, live in the mirror: IN PROCESS at Psomagen, Inc.
    const confirm = await render(
      CaseAlertConfirm({
        caseNumber: "P-100-26125-868956",
        currentStatus: "IN PROCESS",
        employerName: "Psomagen, Inc.",
        asOf: "August 5, 2026",
        confirmUrl: CONFIRM_URL,
      }),
    );

    // The live tone. 906 cases sit at RFI ISSUED; the 2026-05 cohort is 8,172
    // filed with 7,899 still pending; 63,603 pending cases were filed earlier.
    const rfi = await render(
      CaseStatusChanged({
        caseNumber: "P-100-26125-868956",
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
          "Counted across our mirror of DOL case status, as of August 26, 2026.",
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
        caseUrl:
          "https://permtracker.app/perm-case-status?case=P-100-26125-868956",
        unsubscribeUrl: UNSUB_URL,
      }),
    );

    // The closed tone, on a case that really is DENIED. Its employer's own
    // record is 10 decisions and 10 certified, which is exactly why the email
    // shows counts and draws nothing from them: this case was denied anyway.
    const denied = await render(
      CaseStatusChanged({
        caseNumber: "G-300-25241-277150",
        employerName: "Trustees of the University of Pennsylvania",
        jobTitle: "Lecturer in Spanish",
        fromStatus: "ANALYST REVIEW",
        toStatus: "DENIED",
        tone: "closed",
        meaning: statusMeaning("DENIED"),
        isFinal: true,
        observedAt: "August 25, 2026",
        contextRows: [
          { label: "Cases now at this status", value: "9,483" },
          { label: "Filed the same month as yours", value: "9,677" },
          { label: "Of those, still pending", value: "723" },
          { label: "Pending cases filed earlier", value: "1,128" },
        ],
        contextProvenance:
          "Counted across our mirror of DOL case status, as of August 26, 2026.",
        rfiRows: null,
        rfiProvenance: null,
        employerRows: [
          { label: "Decisions DOL has published", value: "10" },
          { label: "Of those, certified", value: "10" },
          { label: "Denied", value: "0" },
          { label: "Median days to a decision", value: "496" },
        ],
        employerProvenance:
          "DOL's published PERM disclosure files, FY2024 to FY2026.",
        employerUrl:
          "https://permtracker.app/perm-employers/trustees-of-the-university-of-pennsylvania",
        caseUrl:
          "https://permtracker.app/perm-case-status?case=G-300-25241-277150",
        unsubscribeUrl: UNSUB_URL,
      }),
    );

    writeFileSync(`${OUT}/confirm.html`, confirm);
    writeFileSync(`${OUT}/rfi.html`, rfi);
    writeFileSync(`${OUT}/denied.html`, denied);

    // A preview that silently rendered nothing looks exactly like a successful
    // run, so assert the documents are real and carry their own figures.
    expect(confirm.length).toBeGreaterThan(2000);
    expect(rfi.length).toBeGreaterThan(3000);
    expect(denied.length).toBeGreaterThan(3000);
    expect(rfi).toContain("1,799");
    // The gloss comes from the vocabulary, so this asserts the two agree. An
    // earlier harness hardcoded "30 days from receipt", which was corrected in
    // the vocabulary and kept rendering here.
    expect(rfi).toContain("the one printed on the RFI letter");
    expect(rfi).not.toContain("30 days from receipt");
    expect(denied).toContain("496");
    expect(confirm).toContain("Psomagen, Inc.");
  });
});
