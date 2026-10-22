/**
 * @vitest-environment node
 *
 * The attorney page's pinned tour renders whole on the server: all six sections with their headings, ids and
 * app windows, the first one on and the others waiting to wipe in, the ribbon with its first name on, and the
 * no-script rules that put the static layout back.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AttorneyTour } from "../AttorneyTour";

const IDS = ["timeline", "cases", "case-page", "dates", "reminders", "calendar"];
const NAMES = ["Timeline", "Cases", "Case page", "Dates", "Reminders", "Calendar"];

describe("AttorneyTour on the server", () => {
  const html = renderToStaticMarkup(<AttorneyTour />);

  it("renders every section, in order, each with its heading and window", () => {
    const at = IDS.map((id) => html.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // Six product headings, then the assistant's.
    expect((html.match(/<h2 /g) ?? []).length).toBe(7);
    for (const url of ["permtracker.app/timeline", "permtracker.app/cases", "permtracker.app/cases/juniper", "permtracker.app/cases/tidewater/edit", "permtracker.app/notifications", "permtracker.app/calendar"]) {
      expect(html).toContain(`>${url}<`);
    }
  });

  it("starts on the first section: its band is whole and the rest wait off to the right", () => {
    for (let i = 0; i < IDS.length; i++) {
      const tag = html.match(new RegExp(`<section[^>]*id="${IDS[i]}"[^>]*>`))?.[0] ?? "";
      expect(tag).toContain(`data-tour-step="${i}"`);
      expect(tag).toContain(`--wipe:${i === 0 ? "0%" : "100%"}`);
    }
  });

  it("names every page on the ribbon, the first one on", () => {
    const buttons = [...html.matchAll(/<button[^>]*data-step-item="(\d)"[^>]*data-on="(true|false)"[^>]*>([^<]*)<\/button>/g)];
    expect(buttons.map((b) => b[3])).toEqual(NAMES);
    expect(buttons.map((b) => b[2])).toEqual(["true", "false", "false", "false", "false", "false"]);
  });

  it("keeps the worked-out example and the reminder email in the page", () => {
    expect(html).toContain("Example case");
    expect(html).toContain("The reminder email");
  });

  it("puts the static layout back when scripts are off", () => {
    const noscript = html.match(/<noscript><style>([\s\S]*?)<\/style><\/noscript>/)?.[1] ?? "";
    expect(noscript).toContain("[data-tour-step]{position:relative!important");
    expect(noscript).toContain("[data-tour-ribbon]{display:none!important}");
    expect(noscript).not.toMatch(/[">]/);
  });
});
