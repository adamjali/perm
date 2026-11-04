import { describe, expect, it } from "vitest";

import { redactBrowserEvent } from "../sentryRedact";

/** No email address leaves the browser for Sentry (Nov 4 2026: the signed-in person's address went as the user). */
describe("redactBrowserEvent", () => {
  it("keeps the user's id and drops the address and name", async () => {
    const e = await redactBrowserEvent({ user: { id: "u1", email: "jane@example.test", username: "Jane Doe" } });
    expect(e.user).toEqual({ id: "u1" });
  });

  it("replaces every address in the message, exceptions, breadcrumbs, request and extra", async () => {
    const e = await redactBrowserEvent({
      message: "no account for jane@example.test",
      exception: { values: [{ value: "Error: jane@example.test not found" }] },
      breadcrumbs: [{ message: "typed jane@example.test", data: { to: "jane@example.test" } }],
      request: { url: "https://permtracker.app/x?email=jane@example.test" },
      extra: { form: { email: "jane@example.test", n: 3 } },
    });
    const text = JSON.stringify(e);
    expect(text).not.toContain("jane@example.test");
    expect(e.message).toMatch(/^no account for email#[0-9a-f]{6}$/);
    expect(e.extra).toEqual({ form: { email: e.message!.slice("no account for ".length), n: 3 } });
  });

  it("leaves an event with no address alone", async () => {
    const e = await redactBrowserEvent({ message: "Failed to load the calendar" });
    expect(e).toEqual({ message: "Failed to load the calendar" });
  });
});
