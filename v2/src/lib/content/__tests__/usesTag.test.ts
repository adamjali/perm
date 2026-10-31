import { describe, expect, it } from "vitest";
import { usesTag } from "../index";

// Which articles show a figure is read from the MDX itself; a component whose
// name starts another's (QueueFigure, QueueFigureNote) must not count as it.
describe("usesTag", () => {
  it("finds the component opened in MDX", () => {
    expect(usesTag("Intro\n\n<QueueFigure />\n", "QueueFigure")).toBe(true);
    expect(usesTag('<QueueFigure month="2026-01">', "QueueFigure")).toBe(true);
    expect(usesTag("ends with <QueueFigure", "QueueFigure")).toBe(true);
  });

  it("not a longer name that starts with it, nor the bare word", () => {
    expect(usesTag("<QueueFigureNote />", "QueueFigure")).toBe(false);
    expect(usesTag("the QueueFigure shows", "QueueFigure")).toBe(false);
  });

  it("a later real use after a longer name still counts", () => {
    expect(usesTag("<QueueFigureNote /> then <QueueFigure />", "QueueFigure")).toBe(true);
  });
});
