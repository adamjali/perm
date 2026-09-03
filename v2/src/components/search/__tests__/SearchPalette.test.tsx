// @vitest-environment jsdom
/**
 * The site search palette's three feedback states.
 *
 * Adam: "no feedback? ... also no loading states? for the searching". Every
 * case pinned here was a real defect in this component:
 *
 *  - The corpus lookup's spinner lived inside `Command.Empty`, which renders
 *    only when NOTHING matches. The static page index almost always matches
 *    something, so the fetch this box exists for ran with no signal at all.
 *  - `setSearchingEntities(true)` had no matching `false` on the early-return
 *    path, so shortening a query below two characters left the flag stuck true
 *    for the life of the session. A claim that never becomes false is worse
 *    than no claim.
 *  - Every kind caught its own failure and returned `[]`, so a dead network
 *    and "no such employer" produced the same words.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchPalette } from "../SearchPalette";

const noop = () => {};

/** A fetch that never settles, so "in flight" is observable. */
function hangingFetch() {
  return vi.fn(() => new Promise<Response>(() => {}));
}

describe("SearchPalette feedback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", hangingFetch());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("says it is searching the corpus even when the page list already matches", async () => {
    const user = userEvent.setup();
    render(<SearchPalette open onOpenChange={noop} articles={[]} />);

    // "data" matches the static index, so Command.Empty never renders - which
    // is exactly the case the old spinner could not reach.
    await user.type(screen.getByRole("combobox"), "data");

    expect(
      await screen.findByText(/Searching employers, firms and occupations/i),
    ).toBeInTheDocument();
  });

  it("stops saying it is searching when the query drops below two characters", async () => {
    const user = userEvent.setup();
    render(<SearchPalette open onOpenChange={noop} articles={[]} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "microsoft");
    expect(
      await screen.findByText(/Searching employers, firms and occupations/i),
    ).toBeInTheDocument();

    // Down to one character: nothing is in flight any more, and the box has to
    // stop claiming otherwise. This assertion failed before the fix.
    await user.clear(input);
    await user.type(input, "m");

    await waitFor(() =>
      expect(
        screen.queryByText(/Searching employers, firms and occupations/i),
      ).not.toBeInTheDocument(),
    );
  });

  it("distinguishes a failed lookup from an empty one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network"))),
    );
    const user = userEvent.setup();
    render(<SearchPalette open onOpenChange={noop} articles={[]} />);

    await user.type(screen.getByRole("combobox"), "microsoft");

    expect(await screen.findByText(/corpus lookup didn/i)).toBeInTheDocument();
  });

  it("keeps the whole list of what it accepts in a hint that cannot truncate", () => {
    render(<SearchPalette open onOpenChange={noop} articles={[]} />);
    // The placeholder is short enough to fit a 320px phone; the enumeration
    // lives in prose underneath, where it wraps instead of clipping.
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Name, page or case number",
    );
    expect(
      screen.getByText(/Employers, law firms, occupations, pages and articles/i),
    ).toBeInTheDocument();
  });

  it("is a dialog, so assistive tech knows the page behind it is not the subject", () => {
    render(<SearchPalette open onOpenChange={noop} articles={[]} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
