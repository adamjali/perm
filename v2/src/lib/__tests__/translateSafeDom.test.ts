import { afterEach, describe, expect, it } from "vitest";

import { guardDomAgainstTranslators, type GuardSkip } from "../translateSafeDom";

// What Chrome's Translate does to a text node React holds: takes it out and
// puts its own <font> in its place.
function translate(text: Text): HTMLElement {
  const font = document.createElement("font");
  font.textContent = "traducido";
  text.parentNode!.replaceChild(font, text);
  return font;
}

describe("a translated page doesn't crash React", () => {
  let restore = () => {};
  afterEach(() => {
    restore();
    restore = () => {};
  });

  it("throws without the guard, which is the crash", () => {
    const p = document.createElement("p");
    const text = document.createTextNode("waiting");
    p.appendChild(text);
    translate(text);
    expect(() => p.removeChild(text)).toThrow();
  });

  it("removing a node a translator already took out is a no-op", () => {
    const skipped: GuardSkip[] = [];
    restore = guardDomAgainstTranslators(Node.prototype, (op) => skipped.push(op));
    const p = document.createElement("p");
    const text = document.createTextNode("waiting");
    p.appendChild(text);
    translate(text);
    expect(p.removeChild(text)).toBe(text);
    expect(p.childNodes.length).toBe(1);
    expect(skipped).toEqual(["removeChild"]);
  });

  it("inserting before a wrapped node goes before the wrapper", () => {
    const skipped: GuardSkip[] = [];
    restore = guardDomAgainstTranslators(Node.prototype, (op) => skipped.push(op));
    const p = document.createElement("p");
    const span = document.createElement("span");
    p.appendChild(span);
    const font = document.createElement("font");
    p.replaceChild(font, span);
    font.appendChild(span);
    const b = document.createElement("b");
    p.insertBefore(b, span);
    expect(p.firstChild).toBe(b);
    expect(p.childNodes[1]).toBe(font);
    expect(skipped).toEqual(["insertBefore"]);
  });

  it("leaves ordinary removes and inserts alone, and says nothing about them", () => {
    const skipped: GuardSkip[] = [];
    restore = guardDomAgainstTranslators(Node.prototype, (op) => skipped.push(op));
    const p = document.createElement("p");
    const a = document.createElement("a");
    const b = document.createElement("b");
    p.appendChild(a);
    p.insertBefore(b, a);
    expect([...p.childNodes]).toEqual([b, a]);
    p.insertBefore(document.createElement("i"), null);
    p.removeChild(a);
    expect(p.childNodes.length).toBe(2);
    expect(skipped).toEqual([]);
  });

  it("patches once, and puts the originals back", () => {
    const original = Node.prototype.removeChild;
    restore = guardDomAgainstTranslators(Node.prototype);
    const patched = Node.prototype.removeChild;
    expect(patched).not.toBe(original);
    guardDomAgainstTranslators(Node.prototype)();
    expect(Node.prototype.removeChild).toBe(patched);
    restore();
    restore = () => {};
    expect(Node.prototype.removeChild).toBe(original);
  });
});
