import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NavLink, NavLinkProvider } from "../nav-link";

/**
 * A NavLink's icon and its label keep the gap the CALLER asked for.
 *
 * `showLoading` defaults to TRUE, so NavLink always wraps its children in a
 * `<span className="inline-flex items-center">` - the spinner has to be mounted
 * before it can read `useLinkStatus`. That wrapper is then the link's only flex
 * child, so a caller whose className says `flex items-center gap-3` applies
 * that gap to exactly one element, while the icon and label inside sit in a
 * separate, gapless formatting context and touch.
 *
 * Reported from a phone screenshot of the signed-in drawer: SETTINGS rendered
 * its gear 1.8px from the S while the SIGN OUT button beside it - a plain
 * <button>, whose children ARE direct flex items - rendered 12.7px. Measured in
 * a browser: 0.0px against 12.0px, and `gap: inherit` on the wrapper restores
 * 12.0px. Three call sites were affected, not one (AuthHeader gap-2, Header
 * gap-3, ArticleHeader gap-1).
 *
 * happy-dom has no layout engine, so this asserts the MECHANISM - the wrapper
 * exists and carries the class - and the compiled stylesheet is checked
 * separately, because an arbitrary variant that fails to generate leaves an
 * inert class behind and looks exactly like a fix.
 */
function renderLink(className: string) {
  return render(
    <NavLinkProvider>
      <NavLink href="/settings" className={className}>
        <svg data-testid="icon" />
        Settings
      </NavLink>
    </NavLinkProvider>,
  );
}

describe("NavLink icon/label spacing", () => {
  it("wraps children and gives the wrapper the caller's own gap", () => {
    const { container } = renderLink("flex items-center gap-3 px-2");
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.className).toContain("gap-3");

    // The wrapper is always present, which is the whole reason the gap is lost.
    const wrapper = link!.querySelector("span.inline-flex");
    expect(wrapper, "NavLink no longer wraps its children").not.toBeNull();

    // ...and it must take the gap from the parent rather than a literal, so it
    // cannot drift from whatever the caller asked for.
    expect(wrapper!.className).toContain("gap-[inherit]");

    // The icon and the label really are siblings inside that wrapper - if they
    // were not, inheriting the gap would not put space between them.
    const icon = wrapper!.querySelector("[data-testid=icon]");
    expect(icon).not.toBeNull();
    expect(icon!.parentElement).toBe(wrapper);
    expect(wrapper!.textContent).toContain("Settings");
  });

  it("does not hardcode a spacing value that could drift from the caller", () => {
    const src = readFileSync(join(__dirname, "..", "nav-link.tsx"), "utf8");
    const wrapper = /<span className="([^"]*inline-flex[^"]*)"/.exec(src)?.[1] ?? "";
    expect(wrapper).toContain("gap-[inherit]");
    expect(wrapper).not.toMatch(/gap-\d/);
  });

  it("leaves a caller with no gap alone", () => {
    // `normal` inherits as `normal`, so the plain block nav links are untouched.
    const { container } = renderLink("block px-2");
    const link = container.querySelector("a");
    expect(link!.className).not.toMatch(/gap-/);
    expect(link!.querySelector("span.inline-flex")!.className).toContain("gap-[inherit]");
  });
});
