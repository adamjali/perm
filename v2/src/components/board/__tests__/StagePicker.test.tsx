import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StagePicker, type StageCard } from "../StagePicker";

const stage = (key: string, name: string): StageCard => ({
  key,
  name,
  who: `${name} filer`,
  form: `${name} form`,
  howLong: `${name} wait`,
  what: `${name} happens`,
  watch: `${name} risk`,
  href: `/${key}`,
  linkLabel: `${name} page`,
});
const STAGES = [stage("pwd", "Wage request"), stage("perm", "PERM"), stage("i140", "I-140")];

describe("StagePicker", () => {
  it("puts every step's panel in the page and shows only the chosen one", () => {
    const { container } = render(<StagePicker stages={STAGES} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(3);
    expect([...panels].filter((p) => !p.hasAttribute("hidden"))).toHaveLength(1);
    // Hidden panels still carry their words, for search and the site's own palette.
    expect(container.textContent).toContain("I-140 risk");
  });

  it("opens a step on click and marks it selected", () => {
    render(<StagePicker stages={STAGES} />);
    fireEvent.click(screen.getByRole("tab", { name: /PERM/ }));
    expect(screen.getByRole("tab", { name: /PERM/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("PERM wait");
  });

  it("moves between steps with the arrow keys, wrapping at the ends", () => {
    render(<StagePicker stages={STAGES} />);
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /I-140/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Wage request/ }).getAttribute("aria-selected")).toBe("true");
  });
});
