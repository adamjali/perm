/**
 * SelectionBar Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectionBar } from "../SelectionBar";

const defaultProps = {
  selectedCount: 3,
  totalCount: 10,
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  onExportCSV: vi.fn(),
  onExportJSON: vi.fn(),
  onBulkDelete: vi.fn(),
  onBulkArchive: vi.fn(),
  onBulkReopen: vi.fn(),
  onCancel: vi.fn(),
};

describe("SelectionBar", () => {
  it("renders nothing when selectedCount is 0", () => {
    const { container } = render(<SelectionBar {...defaultProps} selectedCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    [1, "1 case selected"],
    [3, "3 cases selected"],
    [10, "10 cases selected"],
  ])("shows correct count text for %i selected", (count, expected) => {
    render(<SelectionBar {...defaultProps} selectedCount={count} />);
    expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ["Select All", "onSelectAll"],
    ["Deselect All", "onDeselectAll"],
    ["Export CSV", "onExportCSV"],
    ["Export JSON", "onExportJSON"],
    ["Delete", "onBulkDelete"],
    ["Archive", "onBulkArchive"],
    ["Cancel", "onCancel"],
  ] as const)("triggers %s callback when clicked", async (label, propName) => {
    const props = { ...defaultProps, [propName]: vi.fn() };
    const user = userEvent.setup();
    render(<SelectionBar {...props} />);

    const buttons = screen.getAllByRole("button", { name: label });
    await user.click(buttons[0]);
    expect(props[propName]).toHaveBeenCalledTimes(1);
  });
});
