/**
 * Writes the two queue emails to a temp dir for a real-inbox test send.
 *
 * A test rather than a script because vitest already resolves this project's
 * TSX and path aliases correctly, and a standalone node script does not -
 * reusing the working harness beats configuring a second one.
 *
 * Props put the subscriber in the AHEAD case (DOL past their filing month),
 * because that is the ordinary case and it is the branch that used to render
 * the false "DOL is now adjudicating cases filed then".
 */
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/* tmpdir() rather than a fixed "/tmp": portable, and the sibling preview
 * test took CI down with EACCES on a hardcoded absolute path. */
const OUT = join(tmpdir(), "permtracker-emailrender-legacy");

import { QueueAlertConfirm } from "../QueueAlertConfirm";
import { QueueReached } from "../QueueReached";

describe("render previews for a test send", () => {
  it("writes both emails to a temp dir", async () => {
    mkdirSync(OUT, { recursive: true });

    const alert = await render(
      QueueReached({
        frontierMonth: "September 2025",
        filingMonth: "March 2025",
        asOf: "August 20, 2026",
        monthsPast: 6,
        unsubscribeUrl: "https://permtracker.app/queue-alert/unsubscribe?t=EXAMPLE",
      }),
    );
    const confirm = await render(
      QueueAlertConfirm({
        filingMonth: "March 2025",
        confirmUrl: "https://permtracker.app/queue-alert/confirm?t=EXAMPLE",
      }),
    );

    writeFileSync(join(OUT, "alert.html"), alert);
    writeFileSync(join(OUT, "confirm.html"), confirm);

    // Assert they are real documents, not empty strings - a preview that
    // silently rendered nothing would look exactly like a successful run.
    expect(alert.length).toBeGreaterThan(3000);
    expect(confirm.length).toBeGreaterThan(2000);
    expect(alert).toContain("September 2025");
    expect(confirm).toContain("March 2025");
  });
});
