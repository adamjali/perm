import { describe, expect, it } from "vitest";

import { firmBadgeSnippet, firmBadgeSpec, parseFirmBadgeFile } from "../firmBadge";

describe("a law firm's badge", () => {
  it("reads a slug and a theme from the file name, and nothing else", () => {
    expect(parseFirmBadgeFile("fragomen-del-rey-bernsen-loewy-llp.svg")).toEqual({
      slug: "fragomen-del-rey-bernsen-loewy-llp",
      theme: "dark",
    });
    expect(parseFirmBadgeFile("acme-law.light.svg")).toEqual({ slug: "acme-law", theme: "light" });
    for (const bad of ["acme-law", "Acme.svg", "../x.svg", "acme.blue.svg", "-acme.svg", ".svg"]) {
      expect(parseFirmBadgeFile(bad)).toBeNull();
    }
  });

  it("says Verified only for a verified firm", () => {
    expect(firmBadgeSpec("Acme Law", "acme-law", true).value).toBe("Verified firm");
    expect(firmBadgeSpec("Acme Law", "acme-law", false).value).toBe("PERM record");
    expect(firmBadgeSpec("Acme Law", "acme-law", false).alt).not.toMatch(/verified/i);
  });

  it("gives a snippet that links to the firm's page and escapes the name", () => {
    const html = firmBadgeSnippet("https://permtracker.app/", "smith-jones", 'Smith & "Jones" <LLP>');
    expect(html).toBe(
      '<a href="https://permtracker.app/perm-attorneys/smith-jones"><img src="https://permtracker.app/badge/firm/smith-jones.svg" alt="Smith &amp; &quot;Jones&quot; &lt;LLP&gt; on PERM Tracker" height="20"></a>',
    );
    expect(firmBadgeSnippet("https://permtracker.app", "a", "A", "light")).toContain("/badge/firm/a.light.svg");
  });
});
