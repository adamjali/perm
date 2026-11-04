import { describe, expect, it } from "vitest";

import { afterSignIn, authPageHref, loginHrefFor, returnPathFrom, safeReturnPath } from "../returnTo";

/**
 * Where sign-in sends someone back to. A link in an email (the review queue, a case, Settings) reached the
 * sign-in page and, once signed in, the app always opened the dashboard (Nov 4 2026).
 */
describe("safeReturnPath", () => {
  it("keeps a page on this site with its query and section", () => {
    expect(safeReturnPath("/admin#reviews")).toBe("/admin#reviews");
    expect(safeReturnPath("/cases/abc123?tab=timeline")).toBe("/cases/abc123?tab=timeline");
    expect(safeReturnPath("/settings?tab=calendar-sync")).toBe("/settings?tab=calendar-sync");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of [
      "https://evil.example/x",
      "//evil.example/x",
      "/\\evil.example/x",
      "\\\\evil.example",
      "javascript:alert(1)",
      "/%0d%0aSet-Cookie:x",
      "/admin\nx",
      " /admin",
      "admin",
      "",
    ]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });

  it("refuses the sign-in pages and the API, so sign-in never loops or lands on JSON", () => {
    for (const bad of ["/login", "/login?next=/x", "/signup", "/reset-password", "/start", "/api/auth", "/api/chat", "/api"]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
    expect(safeReturnPath("/loginfo")).toBe("/loginfo");
  });

  it("refuses an address too long to be a real page", () => {
    expect(safeReturnPath("/" + "a".repeat(600))).toBeNull();
  });

  it("drops a section that isn't a plain name and keeps the page", () => {
    expect(safeReturnPath("/admin#<script>")).toBe("/admin");
    expect(safeReturnPath("/admin#" + "a".repeat(100))).toBe("/admin");
  });
});

describe("returnPathFrom", () => {
  it("reads next, and the older redirect name the calendar connect flow sends", () => {
    expect(returnPathFrom("?next=%2Fadmin", "")).toBe("/admin");
    expect(returnPathFrom("?redirect=%2Fsettings%3Ftab%3Dcalendar-sync", "")).toBe("/settings?tab=calendar-sync");
    expect(returnPathFrom("?redirect=/settings?tab=calendar-sync", "")).toBe("/settings?tab=calendar-sync");
  });

  it("adds the section the browser carried over the redirect when the address has none", () => {
    // /admin#reviews -> 307 /login?next=%2Fadmin : the browser keeps #reviews on the sign-in page.
    expect(returnPathFrom("?next=%2Fadmin", "#reviews")).toBe("/admin#reviews");
    expect(returnPathFrom("?next=%2Fadmin%23monitor", "#reviews")).toBe("/admin#monitor");
    expect(returnPathFrom("?next=%2Fadmin", "#bad<>")).toBe("/admin");
  });

  it("is null with no return address, or an unsafe one", () => {
    expect(returnPathFrom("", "#reviews")).toBeNull();
    expect(returnPathFrom("?next=%2F%2Fevil.example", "")).toBeNull();
    expect(returnPathFrom("?expired=1", "")).toBeNull();
  });
});

describe("afterSignIn", () => {
  it("goes back to the page that asked for sign-in", () => {
    expect(afterSignIn("login", "?next=%2Fadmin", "#reviews")).toBe("/admin#reviews");
    expect(afterSignIn("signup", "?next=%2Fcases%2Fabc", "")).toBe("/cases/abc");
  });

  it("keeps the calculator's dates and the dashboard when there's no return address", () => {
    expect(afterSignIn("login", "", "")).toBe("/dashboard");
    expect(afterSignIn("login", "?calc=2026-01-15", "")).toBe("/cases/new?calc=2026-01-15");
    expect(afterSignIn("login", "?next=%2F%2Fevil.example", "")).toBe("/dashboard");
  });
});

describe("loginHrefFor", () => {
  it("sends a signed-out visitor to sign-in with the page to come back to", () => {
    expect(loginHrefFor("/admin")).toBe("/login?next=%2Fadmin");
    expect(loginHrefFor("/cases/abc?tab=x#notes", { expired: "1" })).toBe("/login?expired=1&next=%2Fcases%2Fabc%3Ftab%3Dx%23notes");
  });

  it("is plain sign-in when the page can't be a return address", () => {
    expect(loginHrefFor("/login")).toBe("/login");
    expect(loginHrefFor("//evil.example")).toBe("/login");
    expect(loginHrefFor("/", { expired: "1" })).toBe("/login?expired=1&next=%2F");
  });
});

describe("authPageHref", () => {
  it("carries the return address and the calculator's dates between sign-in, sign-up and reset", () => {
    expect(authPageHref("/signup", "?next=%2Fadmin", "#reviews")).toBe("/signup?next=%2Fadmin%23reviews");
    expect(authPageHref("/reset-password", "?next=%2Fcases%2Fabc&expired=1", "")).toBe("/reset-password?next=%2Fcases%2Fabc");
    expect(authPageHref("/login", "?calc=2026-01-15", "")).toBe("/login?calc=2026-01-15");
    expect(authPageHref("/signup", "", "")).toBe("/signup");
  });
});
