// @vitest-environment jsdom
/**
 * NavLink — same-page click behaviour.
 *
 * Why this file exists: a footer link pointing at the page you were already on
 * did absolutely nothing when tapped. Not an error, not a slow response —
 * nothing. Next.js treats a <Link> to the current route as a no-op, and the
 * scroll reset lives in NavLinkProvider behind a pathname CHANGE, so a
 * same-page link fell through every branch that produces feedback.
 *
 * It was reported from a phone as "the Blog link is broken". The reporter was
 * on /blog, scrolled ~4400px down to the footer, and tapped Blog. Every other
 * link worked, because every other link went somewhere. On desktop you can see
 * which page you are on; after a long scroll on a phone, no response is
 * indistinguishable from a dead control.
 *
 * A defect whose whole symptom is "nothing happened" leaves no trace to notice
 * later, so it gets a test rather than a comment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavLink } from "./nav-link";

// The component reads the current route from usePathname; each test sets it.
let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("NavLink on the page it already points at", () => {
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls to the top instead of doing nothing", () => {
    mockPathname = "/blog";
    render(<NavLink href="/blog">Blog</NavLink>);

    const link = screen.getByRole("link", { name: "Blog" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);

    // The actual bug: this assertion failed before the fix, because the click
    // handler returned early and nothing else ran.
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "instant" });

    // Navigation is suppressed because there is nowhere to navigate to.
    expect(event.defaultPrevented).toBe(true);
  });

  it("marks itself as the current page for assistive tech", () => {
    mockPathname = "/blog";
    render(<NavLink href="/blog">Blog</NavLink>);
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("leaves a hash link to fire the browser's own anchor scroll", () => {
    // /#features while on / targets a section, not the page. Hijacking it would
    // send the reader to the top instead of to the section they asked for.
    mockPathname = "/";
    render(<NavLink href="/#features">Features</NavLink>);

    const link = screen.getByRole("link", { name: "Features" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(link).not.toHaveAttribute("aria-current");
  });
});

describe("NavLink pointing somewhere else", () => {
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  });

  it("navigates normally and does not hijack the scroll", () => {
    mockPathname = "/";
    render(<NavLink href="/blog">Blog</NavLink>);

    const link = screen.getByRole("link", { name: "Blog" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);

    // Real navigation must stay untouched: the fix has to be invisible here.
    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("does not treat a nested route as the same page", () => {
    // Tapping "Blog" from a blog POST must still go to the blog index.
    mockPathname = "/blog/perm-processing-times-2026";
    render(<NavLink href="/blog">Blog</NavLink>);

    const link = screen.getByRole("link", { name: "Blog" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("still honours a caller that cancels the click", () => {
    mockPathname = "/blog";
    render(
      <NavLink href="/blog" onClick={(e) => e.preventDefault()}>
        Blog
      </NavLink>
    );

    fireEvent.click(screen.getByRole("link", { name: "Blog" }));
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
