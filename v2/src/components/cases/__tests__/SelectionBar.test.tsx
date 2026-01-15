/**
 * SelectionBar Component Tests
 * Tests for the bulk action selection bar component.
 *
 * TDD: Tests written FIRST to define expected behavior.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectionBar } from "../SelectionBar";

describe("SelectionBar", () => {
  const defaultProps = {
    selectedCount: 3,
    totalCount: 10,
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onExportCSV: vi.fn(),
    onExportJSON: vi.fn(),
    onBulkDelete: vi.fn(),
    onBulkArchive: vi.fn(),
    onCancel: vi.fn(),
  };

  it("should not render when selectedCount is 0", () => {
    const { container } = render(<SelectionBar {...defaultProps} selectedCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render when selectedCount is greater than 0", () => {
    render(<SelectionBar {...defaultProps} />);
    // Both desktop and mobile layouts render, so we expect 2 instances
    const countElements = screen.getAllByText("3 cases selected");
    expect(countElements).toHaveLength(2);
  });

  it("should show correct count with singular case", () => {
    render(<SelectionBar {...defaultProps} selectedCount={1} />);
    // Both desktop and mobile layouts render, so we expect 2 instances
    const countElements = screen.getAllByText("1 case selected");
    expect(countElements).toHaveLength(2);
  });

  it("should show correct count with plural cases", () => {
    render(<SelectionBar {...defaultProps} selectedCount={5} />);
    // Both desktop and mobile layouts render, so we expect 2 instances
    const countElements = screen.getAllByText("5 cases selected");
    expect(countElements).toHaveLength(2);
  });

  it("should trigger onSelectAll when Select All button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const selectAllButtons = screen.getAllByRole("button", { name: /select all/i });
    await user.click(selectAllButtons[0]);

    expect(defaultProps.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("should trigger onDeselectAll when Deselect All button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const deselectAllButtons = screen.getAllByRole("button", { name: /deselect all/i });
    await user.click(deselectAllButtons[0]);

    expect(defaultProps.onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it("should trigger onExportCSV when Export CSV button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const exportCSVButtons = screen.getAllByRole("button", { name: /export csv/i });
    await user.click(exportCSVButtons[0]);

    expect(defaultProps.onExportCSV).toHaveBeenCalledTimes(1);
  });

  it("should trigger onExportJSON when Export JSON button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const exportJSONButtons = screen.getAllByRole("button", { name: /export json/i });
    await user.click(exportJSONButtons[0]);

    expect(defaultProps.onExportJSON).toHaveBeenCalledTimes(1);
  });

  it("should trigger onBulkDelete when Delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(defaultProps.onBulkDelete).toHaveBeenCalledTimes(1);
  });

  it("should trigger onBulkArchive when Archive button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const archiveButtons = screen.getAllByRole("button", { name: /archive/i });
    await user.click(archiveButtons[0]);

    expect(defaultProps.onBulkArchive).toHaveBeenCalledTimes(1);
  });

  it("should trigger onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we get the first one
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    await user.click(cancelButtons[0]);

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("should have accessible labels on all buttons", () => {
    render(<SelectionBar {...defaultProps} />);

    // Both desktop and mobile layouts render, so we expect 2 instances of each
    // Use exact match to avoid matching "Deselect All" when searching for "Select All"
    expect(screen.getAllByRole("button", { name: "Select All" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Deselect All" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Export CSV" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Export JSON" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Archive" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
  });

  it("should show all selected when selectedCount equals totalCount", () => {
    render(<SelectionBar {...defaultProps} selectedCount={10} totalCount={10} />);
    // Both desktop and mobile layouts render, so we expect 2 instances
    const countElements = screen.getAllByText("10 cases selected");
    expect(countElements).toHaveLength(2);
  });

  it("should apply correct styling classes for neobrutalist design", () => {
    const { container } = render(<SelectionBar {...defaultProps} />);
    const selectionBar = container.firstChild as HTMLElement;

    expect(selectionBar).toHaveClass("fixed");
    expect(selectionBar).toHaveClass("bottom-0");
    expect(selectionBar).toHaveClass("z-[60]");
    expect(selectionBar).toHaveClass("border-t-4");
    expect(selectionBar).toHaveClass("border-black");
  });
});
