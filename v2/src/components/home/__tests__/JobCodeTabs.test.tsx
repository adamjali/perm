import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { JobCodeTabs, type JobCodeStep } from "../JobCodeTabs";

const shot = { src: "/a.webp", width: 10, height: 5 };
const STEPS: JobCodeStep[] = ["One", "Two", "Three"].map((title) => ({
  title,
  text: `${title} text`,
  url: `permtracker.app/${title.toLowerCase()}`,
  shots: { light: shot, dark: shot },
  alt: `${title} picture`,
}));

describe("JobCodeTabs", () => {
  it("shows the first step's picture, and another step's on a click", async () => {
    render(<JobCodeTabs steps={STEPS} label="Steps" />);
    expect(screen.getByRole("tab", { name: /One/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: /Three/ }));
    expect(screen.getByRole("tab", { name: /Three/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "job-code-panel-2");
  });

  it("moves between steps by keyboard, wrapping at the ends", async () => {
    render(<JobCodeTabs steps={STEPS} label="Steps" />);
    screen.getByRole("tab", { name: /One/ }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("tab", { name: /Three/ })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /One/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: /Two/ })).toHaveAttribute("aria-selected", "true");
  });
});
