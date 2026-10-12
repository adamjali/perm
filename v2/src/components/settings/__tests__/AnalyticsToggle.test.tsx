// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AnalyticsToggle from "../AnalyticsToggle";

const calls: string[] = [];
const mockSetOff = vi.fn();
let profile: { analyticsOff?: boolean } | undefined = {};
let gpc = false;

vi.mock("convex/react", () => ({
  useQuery: () => profile,
  useMutation: () => mockSetOff,
}));

vi.mock("@/lib/analytics", () => ({
  isGpcEnabled: () => gpc,
  analytics: {
    optOut: () => calls.push("optOut"),
    optIn: () => calls.push("optIn"),
    consentForAccount: () => calls.push("consent"),
    capture: () => calls.push("capture"),
  },
}));

const mockHandleError = vi.fn();
vi.mock("@/lib/errors", () => ({ handleOperationError: (...a: unknown[]) => mockHandleError(...a) }));

describe("AnalyticsToggle", () => {
  beforeEach(() => {
    calls.length = 0;
    mockSetOff.mockReset();
    mockSetOff.mockImplementation(async () => {
      calls.push("save");
      return null;
    });
    mockHandleError.mockReset();
    profile = {};
    gpc = false;
  });

  it("is on for an account that never switched it off", () => {
    renderWithProviders(<AnalyticsToggle />);
    expect(screen.getByRole("switch", { name: /share how i use the app/i })).toBeChecked();
  });

  it("reads the saved setting", () => {
    profile = { analyticsOff: true };
    renderWithProviders(<AnalyticsToggle />);
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("switching off silences this browser before the save, and sends no event about it", async () => {
    renderWithProviders(<AnalyticsToggle />);
    await userEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(mockSetOff).toHaveBeenCalledWith({ off: true }));
    expect(calls).toEqual(["optOut", "save"]);
  });

  it("switching on saves, then lets this browser send again", async () => {
    profile = { analyticsOff: true };
    renderWithProviders(<AnalyticsToggle />);
    await userEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(calls).toEqual(["save", "optIn", "consent"]));
    expect(mockSetOff).toHaveBeenCalledWith({ off: false });
  });

  it("a failed save switches this browser back and says so", async () => {
    mockSetOff.mockImplementation(async () => {
      calls.push("save");
      throw new Error("offline");
    });
    renderWithProviders(<AnalyticsToggle />);
    await userEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(mockHandleError).toHaveBeenCalled());
    expect(calls).toEqual(["optOut", "save", "optIn"]);
  });

  it("with the Global Privacy Control signal the switch is off and can't be turned on", () => {
    gpc = true;
    renderWithProviders(<AnalyticsToggle />);
    const sw = screen.getByRole("switch");
    expect(sw).not.toBeChecked();
    expect(sw).toBeDisabled();
    expect(screen.getByText(/Global Privacy Control/)).toBeInTheDocument();
  });
});
