import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

const { SiteBreadcrumbs } = await import("../SiteBreadcrumbs");

const render = (at: string) => {
  path.current = at;
  return renderToStaticMarkup(<SiteBreadcrumbs />);
};

describe("SiteBreadcrumbs", () => {
  it("renders nothing on the home page", () => {
    expect(render("/")).toBe("");
  });

  it("marks the page itself as current and emits its BreadcrumbList", () => {
    const html = render("/about");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toMatch(/aria-current="page"[^>]*>About</);
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it("links every crumb on a detail page, and leaves the list to the page, which knows its name", () => {
    const html = render("/perm-employers/adobe-inc");
    expect(html).toContain('href="/perm-employers"');
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("BreadcrumbList");
  });

  it("makes room for the data menu's handle on a phone, on data pages only", () => {
    expect(render("/perm-queue")).toContain("max-lg:pl-16");
    expect(render("/about")).not.toContain("max-lg:pl-16");
  });
});
