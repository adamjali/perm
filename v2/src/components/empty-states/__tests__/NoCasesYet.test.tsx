// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { NoCasesYet } from "../NoCasesYet";

describe("NoCasesYet", () => {
  it("renders heading, description, and CTA link to /cases/new", () => {
    renderWithProviders(<NoCasesYet />);

    expect(screen.getByRole("heading", { name: /no cases yet/i })).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /add your first case|create.*case|get started/i });
    expect(cta).toHaveAttribute("href", "/cases/new");
  });

  it("renders button instead of link when onAddCase callback is provided", async () => {
    const user = userEvent.setup();
    const onAddCase = vi.fn();
    renderWithProviders(<NoCasesYet onAddCase={onAddCase} />);

    const button = screen.getByRole("button", { name: /add your first case|create.*case|get started/i });
    await user.click(button);
    expect(onAddCase).toHaveBeenCalledTimes(1);
  });
});
