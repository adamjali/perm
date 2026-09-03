import { describe, expect, it } from "vitest";
import { SECTIONS, OVERVIEW, isDataPath, sectionForPath } from "../dataSections";

/**
 * Every page that SHOWS the rail must mark something current.
 *
 * The defect this pins: the nine tools live at `/tools/<name>` while their nav
 * entry is the index at `/calculators`, so eight of them matched no section.
 * `isDataPath` still returned true (it accepts anything under `/tools/`), so
 * the rail rendered with every group collapsed and nothing highlighted, on
 * every calculator page. Invisible to any test that only checked the pages
 * which DO appear in the map.
 */

const TOOL_PAGES = [
  "/tools/green-card-timeline",
  "/tools/i140-calculator",
  "/tools/i140-trends",
  "/tools/i485-queue-position",
  "/tools/perm-deadline-calculator",
  "/tools/perm-timeline-calculator",
  "/tools/pwd-calculator",
  "/tools/salary-explorer",
];

describe("a page that renders the rail always marks a current section", () => {
  it.each(TOOL_PAGES)("%s resolves to Calculators", (path) => {
    expect(isDataPath(path)).toBe(true);
    expect(sectionForPath(path)?.key).toBe("calculators");
  });

  it("keeps the priority-date calculator under Visa bulletin, which is explicit", () => {
    // The longest-match scan must still beat the fallback, or the deliberate
    // placement of this one page is silently overwritten by the fix.
    expect(sectionForPath("/tools/priority-date-calculator")?.key).toBe("visa-bulletin");
  });

  it("leaves /tools itself as the Overview, not a section", () => {
    expect(sectionForPath(OVERVIEW.href)).toBeNull();
    expect(isDataPath(OVERVIEW.href)).toBe(true);
  });

  it("does not drag non-tool paths onto the rail", () => {
    // The control. A fallback keyed on the wrong prefix would swallow these.
    for (const p of ["/blog", "/faq", "/for-attorneys", "/", "/guides/getting-started"]) {
      expect(sectionForPath(p), p).toBeNull();
      expect(isDataPath(p), p).toBe(false);
    }
  });

  it("every mapped section still resolves to itself", () => {
    for (const s of SECTIONS) {
      expect(sectionForPath(s.href)?.key, s.href).toBe(s.key);
    }
  });
});
