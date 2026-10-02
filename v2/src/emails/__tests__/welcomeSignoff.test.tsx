// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { WelcomeEmail } from "../WelcomeEmail";

/**
 * The welcome email is signed by the team, like the articles' bylines (the
 * owner's call, Oct 2 2026). It had signed off with a person's first name.
 */
describe("WelcomeEmail sign-off", () => {
  it("is signed by the team and names no person", async () => {
    const html = await render(WelcomeEmail({ ...WelcomeEmail.PreviewProps }));
    expect(html).toContain("The PERM Tracker team");
    expect(html).not.toMatch(/Sabrina/);
  });
});
