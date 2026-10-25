// @vitest-environment jsdom
/**
 * DateInput Component Tests
 *
 * Tests essential behavior:
 * - Renders date input and displays value
 * - onChange called when value changes
 * - Clear button shows/hides appropriately
 * - Error and disabled states work correctly
 * - Auto-calculated state indicator
 * - Accessibility attributes
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling verified via Storybook and manual QA.
 */

import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { DateInput } from "../DateInput";

// Helper to get date input consistently
const getDateInput = () =>
  document.querySelector('input[type="date"]') as HTMLInputElement;

describe("DateInput", () => {
  describe("rendering", () => {
    it("renders date input with provided value", () => {
      renderWithProviders(
        <DateInput name="pwdFilingDate" value="2024-01-15" />
      );

      const input = getDateInput();
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("2024-01-15");
    });

    it("calls onChange when value changes", async () => {
      const handleChange = vi.fn();
      const { user } = renderWithProviders(
        <DateInput name="pwdFilingDate" onChange={handleChange} />
      );

      const input = getDateInput();
      await user.type(input, "2024-01-15");

      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe("clear button", () => {
    it("shows clear button when value is present", () => {
      renderWithProviders(
        <DateInput name="pwdFilingDate" value="2024-01-15" onClear={() => {}} />
      );

      const clearButton = screen.getByRole("button", { name: /clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it("hides clear button when no value", () => {
      renderWithProviders(
        <DateInput name="pwdFilingDate" value="" onClear={() => {}} />
      );

      const clearButton = screen.queryByRole("button", { name: /clear/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it("calls onClear when clear button clicked", async () => {
      const handleClear = vi.fn();
      const { user } = renderWithProviders(
        <DateInput
          name="pwdFilingDate"
          value="2024-01-15"
          onClear={handleClear}
        />
      );

      const clearButton = screen.getByRole("button", { name: /clear/i });
      await user.click(clearButton);

      expect(handleClear).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("has aria-invalid when error", () => {
      renderWithProviders(<DateInput name="pwdFilingDate" error />);

      const input = getDateInput();
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("auto-calculated state", () => {
    it("has auto-calculated data attribute when autoCalculated", () => {
      renderWithProviders(
        <DateInput name="pwdExpirationDate" autoCalculated />
      );

      const wrapper = document.querySelector('[data-auto-calculated="true"]');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("calendar button", () => {
    it("opens the browser's picker", () => {
      renderWithProviders(<DateInput name="pwdFilingDate" value="" />);
      const input = getDateInput();
      const showPicker = vi.fn();
      Object.defineProperty(input, "showPicker", { value: showPicker, configurable: true });
      fireEvent.click(screen.getByRole("button", { name: "Open date picker" }));
      expect(showPicker).toHaveBeenCalledTimes(1);
    });

    it("puts the cursor in the box when the browser refuses the picker", () => {
      renderWithProviders(<DateInput name="pwdFilingDate" value="" />);
      const input = getDateInput();
      Object.defineProperty(input, "showPicker", {
        value: () => {
          throw new DOMException("Input showPicker() requires a user gesture.", "NotAllowedError");
        },
        configurable: true,
      });
      expect(() => fireEvent.click(screen.getByRole("button", { name: "Open date picker" }))).not.toThrow();
      expect(document.activeElement).toBe(input);
    });
  });

  describe("disabled state", () => {
    it("can be disabled", () => {
      renderWithProviders(<DateInput name="pwdFilingDate" disabled />);

      const input = getDateInput();
      expect(input).toBeDisabled();
    });

    it("does not show clear button when disabled", () => {
      renderWithProviders(
        <DateInput
          name="pwdFilingDate"
          value="2024-01-15"
          disabled
          onClear={() => {}}
        />
      );

      const clearButton = screen.queryByRole("button", { name: /clear/i });
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe("value handling", () => {
    it("preserves valid date value on blur", () => {
      const handleChange = vi.fn();
      renderWithProviders(
        <DateInput name="testDate" onChange={handleChange} />
      );

      const input = getDateInput();
      fireEvent.change(input, { target: { value: "2024-06-15" } });
      fireEvent.blur(input);

      expect(input.value).toBe("2024-06-15");
      expect(handleChange).toHaveBeenCalled();
    });

    it("syncs with external value changes", () => {
      const { rerender } = renderWithProviders(
        <DateInput name="testDate" value="2024-01-01" />
      );

      expect(getDateInput().value).toBe("2024-01-01");

      rerender(<DateInput name="testDate" value="2024-06-30" />);

      expect(getDateInput().value).toBe("2024-06-30");
    });

    it("handles empty string from clearing", () => {
      const handleChange = vi.fn();
      renderWithProviders(
        <DateInput name="testDate" value="2024-01-01" onChange={handleChange} />
      );

      const input = getDateInput();
      fireEvent.change(input, { target: { value: "" } });

      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has name attribute", () => {
      renderWithProviders(<DateInput name="pwdFilingDate" />);

      const input = getDateInput();
      expect(input).toHaveAttribute("name", "pwdFilingDate");
    });

    it("can have aria-describedby for hints", () => {
      renderWithProviders(
        <DateInput name="pwdFilingDate" aria-describedby="hint-text" />
      );

      const input = getDateInput();
      expect(input).toHaveAttribute("aria-describedby", "hint-text");
    });
  });
});

describe("DateInput before its script starts", () => {
  // A visitor on a slow load types a date into the server-rendered box; React then hydrates over it. The box
  // must pass that date on, or it shows a date nothing answers (found Oct 25 2026 on the timeline calculator).
  async function hydrateWithTyped(typed: string, value = "") {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(<DateInput id="d" value={value} onChange={onChange} />);
    (container.querySelector("input") as HTMLInputElement).value = typed;
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <DateInput id="d" value={value} onChange={onChange} />);
    });
    await act(async () => root?.unmount());
    container.remove();
    return onChange;
  }

  it("passes on a complete date typed before hydration", async () => {
    const onChange = await hydrateWithTyped("2026-08-26");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].target.value).toBe("2026-08-26");
  });

  it("does nothing when the box holds what the page already has, or nothing", async () => {
    expect(await hydrateWithTyped("2026-08-26", "2026-08-26")).not.toHaveBeenCalled();
    expect(await hydrateWithTyped("")).not.toHaveBeenCalled();
  });
});
