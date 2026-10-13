import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { APP_SEGMENTS, isAppPath, redactIdentifiers, scrubClickEvent } from "../analyticsRedact";

const CHAIN_APP =
  'button.btn:text="Open case for Jane Client"attr__aria-label="Jane Client, Acme Inc"nth-child="2"nth-of-type="1";' +
  'a.card:href="/cases/k57abc"attr__title="Acme \\"Big\\" Corp"nth-child="1"nth-of-type="1"';

describe("click events never carry a client's details or a filing's identifiers", () => {
  it("drops all text and attributes from a click in the signed-in app, keeping what the control was", () => {
    const props: Record<string, unknown> = {
      $current_url: "https://permtracker.app/cases/k57abc",
      $el_text: "Open case for Jane Client",
      $elements_chain: CHAIN_APP,
      $selected_content: "Jane Client",
      $elements: [{ tag_name: "button", $el_text: "Jane", attr__class: "btn", "attr__aria-label": "Jane Client" }],
    };
    scrubClickEvent(props);
    expect(props.$el_text).toBeUndefined();
    expect(props.$selected_content).toBeUndefined();
    const chain = String(props.$elements_chain);
    expect(chain).not.toMatch(/Jane|Acme/);
    expect(chain).toContain("button.btn:");
    expect(chain).toContain('href="/cases/k57abc"');
    expect(chain).toContain('nth-child="2"');
    expect(props.$elements).toEqual([{ tag_name: "button", attr__class: "btn" }]);
  });

  it("keeps a public page's text but takes out case and receipt numbers and addresses, link targets included", () => {
    const props: Record<string, unknown> = {
      $current_url: "https://permtracker.app/perm-employers/adobe-inc",
      $el_text: "G-100-25123-123456",
      $elements_chain:
        'a.case:text="G-100-25123-123456"href="/perm-case-status?case=G-100-25123-123456"nth-child="1"nth-of-type="1";' +
        'li:text="Adobe Inc. JO-A-300-26001-000123 IOE0912345678 me@example.com"nth-child="3"nth-of-type="3"',
    };
    scrubClickEvent(props);
    expect(props.$el_text).toBe("[redacted]");
    const chain = String(props.$elements_chain);
    expect(chain).not.toMatch(/G-100-25123|JO-A-300|IOE0912345678|me@example\.com/);
    expect(chain).toContain('text="Adobe Inc. [redacted]');
    expect(chain).toContain("href=\"/perm-case-status?case=[redacted]\"");
  });

  it("leaves an event with no click fields alone", () => {
    const props = { $current_url: "https://permtracker.app/dashboard", $pathname: "/dashboard" };
    scrubClickEvent(props);
    expect(props).toEqual({ $current_url: "https://permtracker.app/dashboard", $pathname: "/dashboard" });
  });

  it("tells app pages from public ones by the first segment, not a prefix", () => {
    expect(isAppPath("/cases")).toBe(true);
    expect(isAppPath("/cases/new")).toBe(true);
    expect(isAppPath("/case-search")).toBe(false);
    expect(isAppPath("/perm-cases")).toBe(false);
    expect(isAppPath("/")).toBe(false);
  });

  it("redacts the old-form PERM number and leaves ordinary words", () => {
    expect(redactIdentifiers("A-08123-12345 filed")).toBe("[redacted] filed");
    expect(redactIdentifiers("Software Engineer, 2026")).toBe("Software Engineer, 2026");
  });

  it("knows every folder of the signed-in app", () => {
    const root = join(process.cwd(), "src/app/(authenticated)");
    const routes = readdirSync(root).filter(
      (n) => statSync(join(root, n)).isDirectory() && !n.startsWith("_") && n !== "components",
    );
    expect(routes.length).toBeGreaterThan(3);
    expect([...APP_SEGMENTS].sort()).toEqual(routes.sort());
  });
});
