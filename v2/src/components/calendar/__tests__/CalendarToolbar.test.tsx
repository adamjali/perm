import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navigate, type ToolbarProps } from "react-big-calendar";

import type { CalendarEvent } from "@/lib/calendar/types";
import { CalendarToolbar } from "../CalendarToolbar";

function toolbar(onNavigate = vi.fn()) {
  const props = {
    label: "November 2026",
    date: new Date(2026, 10, 4),
    view: "month",
    views: ["month", "agenda"],
    onNavigate,
    onView: vi.fn(),
  } as unknown as ToolbarProps<CalendarEvent, object>;
  render(<CalendarToolbar {...props} />);
  return onNavigate;
}

describe("CalendarToolbar's month picker", () => {
  it("keeps the month a heading, with the button that opens the picker inside it", () => {
    // Arrange, Act
    toolbar();
    // Assert
    const heading = screen.getByRole("heading", { level: 2, name: "November 2026" });
    const button = screen.getByRole("button", { name: "November 2026" });
    expect(heading.contains(button)).toBe(true);
    expect(button.querySelector("h2")).toBeNull();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the month on screen as the lime pick and names the year arrows", async () => {
    // Arrange
    const user = userEvent.setup();
    toolbar();
    // Act
    await user.click(screen.getByRole("button", { name: "November 2026" }));
    // Assert
    const picker = within(screen.getByRole("dialog", { name: "Pick a month" }));
    const nov = picker.getByRole("button", { name: "November 2026" });
    expect(nov).toHaveAttribute("aria-pressed", "true");
    expect(nov.className).toContain("bg-primary");
    expect(picker.getByRole("button", { name: "March 2026" })).toHaveAttribute("aria-pressed", "false");
    expect(picker.getByRole("button", { name: "Previous year" })).toBeInTheDocument();
    expect(picker.getByRole("button", { name: "Next year" })).toBeInTheDocument();
  });

  it("moves to a month in another year and closes", async () => {
    // Arrange
    const user = userEvent.setup();
    const onNavigate = toolbar();
    await user.click(screen.getByRole("button", { name: "November 2026" }));
    // Act
    await user.click(screen.getByRole("button", { name: "Next year" }));
    await user.click(screen.getByRole("button", { name: "February 2027" }));
    // Assert
    expect(onNavigate).toHaveBeenCalledWith(Navigate.DATE, new Date(2027, 1, 1));
    expect(screen.queryByRole("dialog", { name: "Pick a month" })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    // Arrange
    const user = userEvent.setup();
    toolbar();
    await user.click(screen.getByRole("button", { name: "November 2026" }));
    // Act
    await user.keyboard("{Escape}");
    // Assert
    expect(screen.queryByRole("dialog", { name: "Pick a month" })).not.toBeInTheDocument();
  });
});
