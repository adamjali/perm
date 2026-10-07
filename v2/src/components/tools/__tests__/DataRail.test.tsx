import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DataRail, GROUP_ICONS } from "../DataRail";
import { GROUPS, SECTIONS } from "../dataSections";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePathname: () => "/perm-employers",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * The rail's group headings carry an icon and a page count, and the collapsed
 * rail is a strip of group squares that opens the rail at the group chosen
 * (Oct 7 2026). The desktop rail and the phone panel both render the groups,
 * so ids carry where they are.
 */
describe("the data rail", () => {
  it("gives every group an icon", () => {
    for (const g of GROUPS) expect(GROUP_ICONS[g], g).toBeTypeOf("object");
  });

  it("names each group with its page count, and draws its icon", () => {
    const { container } = render(<DataRail />);
    const rail = container.querySelector("#data-rail-desktop") as HTMLElement;
    for (const g of GROUPS) {
      const n = SECTIONS.filter((s) => s.group === g).length;
      const head = within(rail).getByRole("button", { name: `${g}, ${n} pages` });
      expect(head.querySelector("svg"), g).not.toBeNull();
    }
  });

  it("uses each id once, across the desktop rail and the phone panel", () => {
    const { container } = render(<DataRail />);
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("collapses to a strip of Overview and every group, the current one marked", () => {
    render(<DataRail />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse data sections" }));
    expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
    for (const g of GROUPS) {
      const name = g === "Employers and wages" ? `${g} (this page's group)` : g;
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    // Focus moved to the toggle that replaced the one clicked.
    expect(document.activeElement?.id).toBe("rail-expand");
  });

  it("opens the rail at the group chosen in the strip, with focus on its heading", () => {
    render(<DataRail />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse data sections" }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    const head = document.getElementById("rail-head-queue") as HTMLElement;
    expect(head).not.toBeNull();
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(head);
  });
});
