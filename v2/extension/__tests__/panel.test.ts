import { afterEach, describe, expect, it, vi } from "vitest";

import { HOST_ID, mountPanel } from "../src/panel";
import type { PanelModel } from "../src/model";

// The panel puts a stranger's text (a job site's employer name, our API's
// answer) onto a page we don't own. It must stay text, and it must get out of
// the way when asked.

const model: PanelModel = {
  title: 'Acme <img src=x onerror="alert(1)">',
  tone: "caution",
  notice: "Possible match: ACME CORP.",
  rows: [{ label: "PERM cases published", value: "1,234", note: "of decided cases" }],
  link: { href: "https://permtracker.app/perm-employers/acme-corp", text: "See the full record" },
  footer: "From DOL's published files.",
};

afterEach(() => document.getElementById(HOST_ID)?.remove());

function mount() {
  const onClose = vi.fn();
  const onRetry = vi.fn();
  const p = mountPanel(document, { onClose, onRetry, mode: "open" });
  return { ...p, onClose, onRetry };
}

describe("the panel", () => {
  it("renders a name with markup in it as text", () => {
    const p = mount();
    p.show(model);
    expect(p.root.querySelector("img")).toBeNull();
    expect(p.root.querySelector("h2")?.textContent).toBe(model.title);
  });

  it("labels itself, and its link opens the record in a new tab without an opener", () => {
    const p = mount();
    p.show(model);
    expect(p.root.querySelector("aside")?.getAttribute("aria-label")).toBe("PERM Tracker sponsorship record");
    const a = p.root.querySelector("a")!;
    expect(a.getAttribute("href")).toBe(model.link!.href);
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(p.root.querySelector(".caution")?.textContent).toBe(model.notice);
  });

  it("closes from its button and from Escape, and says so", () => {
    const p = mount();
    p.show(model);
    (p.root.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    expect(p.isOpen()).toBe(false);
    expect(p.onClose).toHaveBeenCalledTimes(1);
    p.show(model);
    p.root.querySelector("aside")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(p.isOpen()).toBe(false);
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the model asks for one", () => {
    const p = mount();
    p.show({ title: "Acme", tone: "caution", rows: [], notice: "Couldn't reach PERM Tracker.", retry: true });
    (p.root.querySelector(".retry") as HTMLButtonElement).click();
    expect(p.onRetry).toHaveBeenCalledTimes(1);
  });

  it("replaces itself rather than stacking, and one page holds one panel", () => {
    const p = mount();
    p.show(model);
    p.show({ ...model, title: "Second" });
    expect(p.root.querySelectorAll("aside").length).toBe(1);
    mount();
    expect(document.querySelectorAll(`#${HOST_ID}`).length).toBe(1);
  });

  it("keeps every text at 14px or larger", () => {
    const p = mount();
    p.show(model);
    const css = p.root.querySelector("style")!.textContent!;
    const sizes = [...css.matchAll(/font(?:-size)?:[^;]*?(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(4);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    expect(css).not.toMatch(/animation|transition/);
  });
});
