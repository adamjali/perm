// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AddCaseButton from "../AddCaseButton";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  usePathname: () => "/dashboard",
}));

describe("AddCaseButton", () => {
  beforeEach(() => mockPush.mockClear());

  it("renders as an accessible button with text and icon", () => {
    const { container } = renderWithProviders(<AddCaseButton />);

    expect(screen.getByRole("button", { name: /add new case/i })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("navigates to /cases/new when clicked", async () => {
    const { user } = renderWithProviders(<AddCaseButton />);
    await user.click(screen.getByRole("button", { name: /add new case/i }));
    expect(mockPush).toHaveBeenCalledWith("/cases/new");
  });
});
