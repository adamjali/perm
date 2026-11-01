import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The pointer means a click does something. A focusable scroll area (ScrollBox, the chat's
 * conversation) takes the keyboard and does nothing on a click, so the pointer can't come from
 * tabindex: Nov 1 2026, "when i move mouse anywhere in chat it shows clickable even tho it isnt".
 */
const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const rule = css.slice(css.indexOf("/* Global cursor pointer styles"), css.indexOf("cursor: pointer;", css.indexOf("/* Global cursor pointer styles")));

describe("the global pointer rule", () => {
  it("was found", () => {
    expect(rule.length).toBeGreaterThan(100);
  });

  it("never comes from being focusable", () => {
    expect(rule.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[tabindex/);
  });

  it("still covers every clickable role the site's controls carry", () => {
    for (const role of ["button", "link", "tab", "menuitem", "option", "switch", "checkbox", "radio", "slider"]) {
      expect(rule).toContain(`[role="${role}"]`);
    }
  });
});
