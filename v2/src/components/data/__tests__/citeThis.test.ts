import { describe, expect, it } from "vitest";

import { citationFor } from "../CiteThis";
import { openDataCreditHtml } from "@/lib/openData";

describe("cite this page", () => {
  it("names the page without the site suffix, the data's date, the address and the day read", () => {
    expect(
      citationFor("PERM Processing Times 2026 (DOL Data) | PERM Tracker", "https://permtracker.app/perm-processing-times", "Oct 9, 2026", "October 10, 2026"),
    ).toBe(
      "PERM Processing Times 2026 (DOL Data). PERM Tracker, data through Oct 9, 2026. https://permtracker.app/perm-processing-times (accessed October 10, 2026).",
    );
  });

  it("leaves the data date out when the page has none", () => {
    expect(citationFor("Glossary | PERM Tracker", "https://permtracker.app/glossary", null, "October 10, 2026")).toBe(
      "Glossary. PERM Tracker. https://permtracker.app/glossary (accessed October 10, 2026).",
    );
  });
});

describe("the open-data credit for a web page", () => {
  it("links to the files and the licence", () => {
    const html = openDataCreditHtml("https://permtracker.app/");
    expect(html).toContain('<a href="https://permtracker.app/open-data">PERM Tracker</a>');
    expect(html).toContain('<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>');
  });
});

describe("the press credit", () => {
  it("links to the site and names the records", async () => {
    const { pressCreditHtml } = await import("@/lib/pressCredit");
    expect(pressCreditHtml("https://permtracker.app/")).toBe(
      'Source: <a href="https://permtracker.app">PERM Tracker</a>, from U.S. Department of Labor and other federal records.',
    );
  });
});
