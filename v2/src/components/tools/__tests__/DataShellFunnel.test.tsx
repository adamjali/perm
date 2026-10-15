// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Every data page ends with the case block (owner, Oct 15 2026: the two things
 * people come for are when their case will be decided and an email when it
 * moves). The pages that already lead with their own case box skip it.
 */
const nav = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { DataShell } = await import("../DataShell");
const { SECTIONS, CALCULATOR_PAGES } = await import("@/lib/siteMap");

const OWN_BOX = ["/perm-case-status", "/case-search"];
const endsWithCaseBlock = (path: string) => {
  nav.path = path;
  const { unmount } = render(<DataShell><p>page</p></DataShell>);
  const has = screen.queryByRole("region", { name: "Check your case" }) !== null
    || document.querySelector('section[aria-label="Check your case"]') !== null;
  unmount();
  return has;
};

describe("the end of every data page", () => {
  const pages = [...SECTIONS, ...CALCULATOR_PAGES].map((p) => p.href).filter((h) => !OWN_BOX.some((o) => h.startsWith(o)));

  it("covers the whole map", () => {
    expect(pages.length).toBeGreaterThan(40);
  });

  it.each(pages)("%s ends with the case block", (href) => {
    expect(endsWithCaseBlock(href)).toBe(true);
  });

  it.each([...OWN_BOX, "/perm-employers/adobe-inc", "/perm-queue/2025-11"])("%s leads with its own box instead", (href) => {
    expect(endsWithCaseBlock(href)).toBe(false);
  });
});
