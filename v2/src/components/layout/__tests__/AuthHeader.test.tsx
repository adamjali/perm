// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AuthHeader from "../AuthHeader";
import { CONTENT_NAV_LINKS } from "@/lib/constants/navigation";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { usePathname } from "next/navigation";

describe("AuthHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders logo linking to home and theme toggle", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);

    const logoLink = screen.getByRole("link", { name: /perm/i });
    expect(logoLink).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("button", { name: /switch to .* mode/i }).length).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ["/login", false, true],   // On login: hide Sign In, show Sign Up
    ["/signup", true, false],  // On signup: show Sign In, hide Sign Up
    ["/", true, true],         // On home: show both
    ["/demo", true, true],     // On demo: show both
  ])("on %s shows Sign In=%s, Sign Up=%s", (path, showSignIn, showSignUp) => {
    vi.mocked(usePathname).mockReturnValue(path);
    renderWithProviders(<AuthHeader />);

    if (showSignIn) {
      expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    }
    if (showSignUp) {
      expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
    }
  });

  it("renders Learn dropdown button on home page", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    // Desktop nav has a Learn button with aria-expanded
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    );
    expect(learnButton).toBeDefined();
    expect(learnButton).toHaveAttribute("aria-expanded", "false");
  });

  it("opens Learn dropdown on click and shows content links", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { user } = renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    )!;

    await user.click(learnButton);

    expect(learnButton).toHaveAttribute("aria-expanded", "true");

    // All content nav links should be visible in the dropdown
    for (const link of CONTENT_NAV_LINKS) {
      expect(screen.getByRole("link", { name: link.label })).toBeInTheDocument();
    }
  });

  it("closes Learn dropdown on click outside", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { user } = renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    )!;

    // Open the dropdown
    await user.click(learnButton);
    expect(learnButton).toHaveAttribute("aria-expanded", "true");

    // Simulate clicking outside (mousedown on document body)
    fireEvent.mouseDown(document.body);

    expect(learnButton).toHaveAttribute("aria-expanded", "false");
  });

  it("closes Learn dropdown when a link inside it is clicked", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { user } = renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    )!;

    // Open the dropdown
    await user.click(learnButton);
    expect(learnButton).toHaveAttribute("aria-expanded", "true");

    // Click the first content link (e.g., "Blog")
    const firstLink = screen.getByRole("link", { name: CONTENT_NAV_LINKS[0].label });
    await user.click(firstLink);

    expect(learnButton).toHaveAttribute("aria-expanded", "false");
  });

  // SSR sitelinks contract — guards against PR #99 (commit df55dbf) regression.
  // The Learn dropdown must render its <a href> nodes in the initial SSR HTML
  // even when collapsed, so Googlebot's first fetch sees them. The closed-state
  // a11y contract is `inert` + `aria-hidden="true"` on the menu container.
  // See AuthHeader.tsx ~lines 192-210: "DO NOT revert to conditional render".
  it("Learn dropdown links are in the DOM even when closed (SSR sitelinks contract)", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);

    // Even with aria-expanded=false on the trigger and inert/aria-hidden on the
    // menu container, the <a href> nodes must be present in the document so
    // Googlebot sees them in the initial SSR HTML.
    for (const link of CONTENT_NAV_LINKS) {
      expect(
        screen.queryAllByRole("link", { name: link.label, hidden: true }),
      ).not.toHaveLength(0);
    }

    // And the menu container should be hidden by aria-hidden + inert when closed.
    const menus = screen.getAllByRole("menu", { hidden: true });
    expect(menus.length).toBeGreaterThanOrEqual(1);
    const closedMenu = menus.find((m) => m.getAttribute("aria-hidden") === "true");
    expect(closedMenu).toBeDefined();
    expect(closedMenu).toHaveAttribute("inert");
  });
});

describe("AuthHeader: the tools hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to /tools in the desktop nav on the home page", () => {
    // The home branch renders section anchors rather than AUTH_NAV_LINKS, so
    // the hub has to be placed there explicitly. It was missing entirely when
    // the calculators shipped, leaving them reachable from one page.
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);
    const links = screen.getAllByRole("link", { name: /^data$/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/tools");
  });

  it("links to /tools in the desktop nav on an interior page", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    renderWithProviders(<AuthHeader />);
    expect(screen.getAllByRole("link", { name: /^data$/i })[0]).toHaveAttribute(
      "href",
      "/tools",
    );
  });

  it("shows /tools inside the mobile menu once it is opened", async () => {
    // The mobile panel is mounted on open, so the link is absent until then.
    // This is the surface a phone actually uses and it cannot be checked from
    // the server-rendered HTML.
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);

    const toggle = screen.getByRole("button", { name: /toggle menu/i });
    fireEvent.click(toggle);

    const links = await screen.findAllByRole("link", { name: /^data$/i });
    expect(links.length).toBeGreaterThanOrEqual(2); // desktop + mobile
    expect(links.every((l) => l.getAttribute("href") === "/tools")).toBe(true);
  });

  it("shows /tools in the mobile menu on an interior page too", async () => {
    vi.mocked(usePathname).mockReturnValue("/blog");
    renderWithProviders(<AuthHeader />);
    fireEvent.click(screen.getByRole("button", { name: /toggle menu/i }));
    const links = await screen.findAllByRole("link", { name: /^data$/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AuthHeader: the unified public nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts the case lookup first, on every page including home", () => {
    // The highest-intent destination leads the nav. The homepage used to
    // render section anchors instead of links at all, which meant the one
    // page most visitors land on had no route to the one page they came for.
    for (const path of ["/", "/blog", "/login"]) {
      vi.mocked(usePathname).mockReturnValue(path);
      const { unmount } = renderWithProviders(<AuthHeader />);
      const track = screen.getAllByRole("link", { name: /track my case/i });
      expect(track[0]).toHaveAttribute("href", "/perm-case-status");
      unmount();
    }
  });

  it("routes practitioners to /for-attorneys from the top nav", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);
    const links = screen.getAllByRole("link", { name: /for attorneys/i });
    expect(links[0]).toHaveAttribute("href", "/for-attorneys");
  });

  it("renders the search trigger", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);
    expect(
      screen.getAllByRole("button", { name: /search the site/i }).length,
    ).toBeGreaterThan(0);
  });
});
