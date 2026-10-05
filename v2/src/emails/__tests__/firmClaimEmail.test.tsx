// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { FirmClaimEmail } from "../FirmClaimEmail";

/**
 * A firm's claim emails: the firm named from our records, one button, how long
 * the link works, and no subscription controls (there's no subscription).
 */
describe("FirmClaimEmail", () => {
  it.each([
    ["confirm", "Confirm the claim"],
    ["approved", "Edit the profile"],
    ["published", "Edit the profile"],
    ["declined", "Fix and send again"],
    ["edit", "Edit the profile"],
  ] as const)("%s: names the firm, carries one link and says when it stops working", async (kind, button) => {
    const url = `https://permtracker.app/firm-claim/${kind === "confirm" ? "confirm" : "edit"}?token=T`;
    const html = await render(FirmClaimEmail({ kind, firmName: "Smith Immigration PLLC", url, validFor: "2 days" }));
    expect(html).toContain("Smith Immigration PLLC");
    expect(html).toContain(button);
    expect(html).toContain(url.replace("&", "&amp;"));
    expect(html).toContain("The link works for 2 days");
    expect(html).not.toContain("/prefs?token=");
    expect(html.toLowerCase()).not.toContain("unsubscribe");
  });

  it("tells a claimant whose domain DOL doesn't tie to the firm that a person checks it", async () => {
    const manual = await render(FirmClaimEmail({ kind: "confirm", firmName: "Smith Immigration PLLC", url: "https://x", validFor: "7 days" }));
    expect(manual).toContain("check the claim by hand");
    const auto = await render(
      FirmClaimEmail({ kind: "confirm", firmName: "Smith Immigration PLLC", url: "https://x", validFor: "7 days", domainVerified: true }),
    );
    expect(auto).toContain("check your profile before it goes up");
  });

  it("gives a declined firm the admin's reason, and says the page didn't change", async () => {
    const html = await render(
      FirmClaimEmail({ kind: "declined", firmName: "Smith Immigration PLLC", url: "https://x", validFor: "2 days", reason: "Please state facts, not rankings." }),
    );
    expect(html).toContain("Please state facts, not rankings.");
    expect(html).toContain("shows what it showed before");
  });
});
