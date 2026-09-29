import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseAlertForm } from "../CaseAlertForm";
import { BulletinAlertForm } from "../BulletinAlertForm";
import { isQueued, replyHeading } from "@/lib/alertReply";

/**
 * A queued confirmation must not be headed "Check your inbox".
 *
 * Since Sep 29 2026 a full confirmation pool queues the request and the
 * server answers `queued: true` (convex/confirmationQueue.ts). The forms used
 * to put a fixed "Check your inbox" over whatever the server said, which
 * would tell a person their email had arrived while it was still waiting.
 * The case form also printed "Check your inbox to confirm." twice.
 */

const QUEUED = {
  ok: true,
  queued: true,
  message: "We're sending a lot of email right now, so your confirmation is in a short queue.",
};
const SENT = { ok: true, message: "Check your inbox to confirm." };

function answer(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-123.convex.cloud");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function submit(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i, { selector: "input" }), { target: { value: email } });
  fireEvent.submit(screen.getByLabelText(/email/i, { selector: "input" }).closest("form")!);
}

describe("replyHeading", () => {
  it("names the queue only when the server said so", () => {
    expect(replyHeading(isQueued(QUEUED))).toBe("Your email is in a short queue");
    expect(replyHeading(isQueued(SENT))).toBe("Check your inbox");
    expect(isQueued(null)).toBe(false);
    expect(isQueued({ queued: "true" })).toBe(false);
  });
});

describe("CaseAlertForm", () => {
  it("a queued reply asks the person to confirm when it arrives, not to check now", async () => {
    answer(QUEUED);
    render(<CaseAlertForm caseNumber="G-100-25324-425560" />);
    await submit("a@example.com");
    await waitFor(() => expect(screen.getByText(/short queue/)).toBeTruthy());
    expect(screen.getByText(/Confirm it when it arrives/)).toBeTruthy();
    expect(screen.queryByText(/Check your inbox/)).toBeNull();
  });

  it("an ordinary reply says 'Check your inbox to confirm' once", async () => {
    answer(SENT);
    render(<CaseAlertForm caseNumber="G-100-25324-425560" />);
    await submit("a@example.com");
    await waitFor(() => expect(screen.getByText(/Nothing is sent until you confirm/)).toBeTruthy());
    expect(screen.getAllByText(/Check your inbox to confirm/)).toHaveLength(1);
  });
});

describe("BulletinAlertForm", () => {
  it("heads a queued reply as queued", async () => {
    answer(QUEUED);
    render(<BulletinAlertForm source="test" />);
    await submit("b@example.com");
    await waitFor(() => expect(screen.getByText("Your email is in a short queue")).toBeTruthy());
    expect(screen.queryByText("Check your inbox")).toBeNull();
  });
});
