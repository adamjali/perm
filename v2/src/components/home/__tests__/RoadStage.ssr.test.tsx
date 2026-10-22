/**
 * @vitest-environment node
 *
 * The road's scroll stage renders whole on the server: all six stops with their links and documents, the first
 * stop lit and its document shown, the rest waiting, before any script runs. The pinned layout is only ever a
 * lg:motion-safe class, so a phone and a reader who asks for reduced motion get the road as it always was.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RoadSection } from "../RoadSection";

const html = renderToStaticMarkup(<RoadSection pwdPending={47941} frontierMonth="2025-12-01" />);

const TOOLS = [
  "/tools/pwd-calculator",
  "/tools/perm-timeline-calculator",
  "/tools/i140-calculator",
  "/tools/priority-date-calculator",
  "/tools/i485-queue-position",
  "/tools/green-card-timeline",
];

describe("RoadStage on the server", () => {
  it("starts at the first stop, with the first stop lit", () => {
    expect(html).toMatch(/<section[^>]*aria-labelledby="road-heading"[^>]*data-step="0"/);
    const items = [...html.matchAll(/data-step-item="(\d)" data-on="(true|false)"/g)].map((m) => [m[1], m[2]]);
    expect(items).toEqual([
      ["0", "true"],
      ["1", "false"],
      ["2", "false"],
      ["3", "false"],
      ["4", "false"],
      ["5", "false"],
    ]);
  });

  it("links every stop to its calculator, once", () => {
    for (const href of TOOLS) {
      expect(html.match(new RegExp(`href="${href}"`, "g")) ?? [], href).toHaveLength(1);
    }
  });

  it("shows the first document and holds the others back until the reader reaches them", () => {
    const reveals = [...html.matchAll(/data-reveal="(\d)" style="--reveal:(\d)"/g)].map((m) => [m[1], m[2]]);
    expect(reveals).toEqual([
      ["0", "1"],
      ["1", "0"],
      ["2", "0"],
      ["3", "0"],
      ["4", "0"],
      ["5", "0"],
    ]);
  });

  it("names each document under the large frame", () => {
    for (const doc of [
      "Form ETA-9141, from DOL&#x27;s FLAG site",
      "Form ETA-9089, from DOL&#x27;s forms page",
      "Form I-140, from USCIS",
      "The October 2026 visa bulletin, from the State Department",
      "Form I-485, from USCIS",
      "USCIS&#x27;s specimen green card",
    ]) {
      expect(html).toContain(doc);
    }
  });

  it("pins only from 1024px with motion allowed, never by default", () => {
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/));
    for (const bare of ["sticky", "absolute"]) {
      // `absolute` is allowed on the phone road's pseudo-elements (before:absolute), never bare on a stop.
      expect(classes.filter((c) => c === bare), bare).toEqual([]);
    }
    expect(classes).toContain("lg:motion-safe:sticky");
    expect(classes).toContain("lg:motion-safe:absolute");
  });
});
