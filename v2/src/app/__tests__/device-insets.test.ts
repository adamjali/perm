import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phones with a notch, punch hole, rounded corners or home bar (Oct 24 2026). The page runs under them so the
 * header, footer and bands fill the screen, and everything with words or buttons keeps clear by the inset the
 * device itself reports, which is zero on a device without one. See globals.css, "The device's own insets".
 */

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("the device's own insets", () => {
  it("lets the page run edge to edge", () => {
    expect(read("app/layout.tsx")).toMatch(/viewportFit:\s*"cover"/);
  });

  it("keeps every wide content column clear of the left and right insets", () => {
    const css = read("app/globals.css");
    expect(css).toContain("border-left: env(safe-area-inset-left, 0px) solid transparent;");
    expect(css).toContain("border-right: env(safe-area-inset-right, 0px) solid transparent;");
    // The header's and footer's own column width is on the list.
    expect(css).toContain(".mx-auto.max-w-\\[1440px\\]");
    expect(read("components/layout/SiteHeader.tsx")).toMatch(/mx-auto[^"]*max-w-\[1440px\]/);
  });

  it("moves every control pinned to an edge in by the inset", () => {
    const pinned: [string, RegExp][] = [
      ["components/chat/ChatWidget.tsx", /right-\[calc\(1rem_\+_env\(safe-area-inset-right,0px\)\)\]/],
      ["components/chat/ChatWidget.tsx", /env\(safe-area-inset-bottom,0px\)/],
      ["components/chat/ChatPanel.tsx", /md:right-\[calc\(1rem_\+_env\(safe-area-inset-right,0px\)\)\]/],
      ["components/ui/scroll-to-top.tsx", /right-\[calc\(1\.5rem_\+_env\(safe-area-inset-right,0px\)\)\]/],
      ["components/tools/DataRail.tsx", /left-\[env\(safe-area-inset-left,0px\)\]/],
      ["components/cases/SelectionBar.tsx", /pb-\[env\(safe-area-inset-bottom,0px\)\]/],
      ["components/layout/SiteHeader.tsx", /md:right-\[calc\(1rem_\+_env\(safe-area-inset-right,0px\)\)\]/],
    ];
    for (const [file, pattern] of pinned) expect(read(file), file).toMatch(pattern);
  });
});
