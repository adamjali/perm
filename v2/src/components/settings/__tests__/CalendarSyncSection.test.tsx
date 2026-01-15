// @vitest-environment jsdom
/**
 * @fileoverview Tests for CalendarSyncSection component
 * @see v2/src/components/settings/CalendarSyncSection.tsx
 *
 * Tests cover:
 * - Basic rendering (section header)
 * - Connection status display
 * - Connect/Disconnect button behavior
 * - Master toggle behavior
 * - Per-deadline-type toggles
 * - Disabled states
 * - Accessibility
 * - OAuth callback handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import CalendarSyncSection from "../CalendarSyncSection";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Convex hooks
const mockUpdateProfile = vi.fn();
const mockSyncAllCases = vi.fn();
const mockClearAllEvents = vi.fn();
const mockUseQuery = vi.fn();

// Track which action is being requested
let useActionCallCount = 0;
vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateProfile,
  useAction: (_actionRef: unknown) => {
    // Return the appropriate mock based on the action reference
    // The component calls useAction twice: once for syncAllCases, once for clearAllEvents
    const callIndex = useActionCallCount++;
    return callIndex % 2 === 0 ? mockSyncAllCases : mockClearAllEvents;
  },
  useQuery: () => mockUseQuery(),
}));

// Mock Next.js navigation
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

// Mock auth-aware toast wrapper (not sonner directly)
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
const mockToastWarning = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
    info: (msg: string) => mockToastInfo(msg),
    warning: (msg: string) => mockToastWarning(msg),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

// Mock fetch for disconnect API
const mockFetch = vi.fn();

// ============================================================================
// TEST DATA
// ============================================================================

const defaultProfile = {
  calendarSyncEnabled: false,
  calendarSyncPwd: true,
  calendarSyncEta9089: true,
  calendarSyncI140: true,
  calendarSyncRfe: true,
  calendarSyncRfi: true,
  calendarSyncRecruitment: true,
  calendarSyncFilingWindow: true,
  googleCalendarConnected: false,
  googleEmail: undefined,
};

const connectedProfile = {
  ...defaultProfile,
  googleCalendarConnected: true,
  googleEmail: "test@gmail.com",
};

const enabledProfile = {
  ...connectedProfile,
  calendarSyncEnabled: true,
};

// Enabled but not connected - for testing "connect" warning
const enabledNotConnectedProfile = {
  ...defaultProfile,
  calendarSyncEnabled: true,
  googleCalendarConnected: false,
};

// ============================================================================
// SETUP
// ============================================================================

describe("CalendarSyncSection", () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useActionCallCount = 0; // Reset action call counter
    mockUpdateProfile.mockResolvedValue(undefined);
    mockSyncAllCases.mockResolvedValue({
      success: true,
      total: 5,
      synced: 5,
      failed: 0,
    });
    mockClearAllEvents.mockResolvedValue({
      success: true,
      eventsDeleted: 10,
      casesCleaned: 3,
      errors: 0,
    });
    // Mock useQuery to return sync-eligible count (used by component)
    mockUseQuery.mockReturnValue(5);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;
    // Clear search params
    mockSearchParams.delete("connected");
    mockSearchParams.delete("error");
  });

  afterEach(() => {
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  // ============================================================================
  // BASIC RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders Google Calendar Sync section header and description", () => {
      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      expect(screen.getByText("Google Calendar Sync")).toBeInTheDocument();
      expect(screen.getByText(/Automatically sync case deadlines to your Google Calendar/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CONNECTION STATUS TESTS
  // ============================================================================

  describe("Connection Status", () => {
    it.each([
      { profile: defaultProfile, expectedText: /Not Connected/i, description: "not connected" },
      { profile: connectedProfile, expectedText: "Connected", description: "connected" },
    ])("shows correct status when $description", ({ profile, expectedText }) => {
      renderWithProviders(<CalendarSyncSection profile={profile} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it("displays connected Google email when available", () => {
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      expect(screen.getByText("test@gmail.com")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CONNECT/DISCONNECT BUTTON TESTS
  // ============================================================================

  describe("Connect/Disconnect Buttons", () => {
    it.each([
      { profile: defaultProfile, buttonName: /Connect Calendar/i, description: "not connected" },
      { profile: connectedProfile, buttonName: /Disconnect/i, description: "connected" },
    ])("shows correct button when $description", ({ profile, buttonName }) => {
      renderWithProviders(<CalendarSyncSection profile={profile} />);
      expect(screen.getByRole("button", { name: buttonName })).toBeInTheDocument();
    });

    it("redirects to OAuth when Connect button clicked", async () => {
      const user = userEvent.setup();
      // Mock window.location.href
      const originalLocation = window.location;
      const mockLocation = { ...originalLocation, href: "" };
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      const connectButton = screen.getByRole("button", { name: /Connect Calendar/i });
      await user.click(connectButton);

      expect(window.location.href).toBe("/api/google/connect");

      // Restore original
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
      });
    });

    it("calls disconnect API when Disconnect button clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const disconnectButton = screen.getByRole("button", { name: /Disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/google/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      });
    });

    it("shows success toast after successful disconnect", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const disconnectButton = screen.getByRole("button", { name: /Disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Google Calendar disconnected");
      });
    });

    it("shows error toast when disconnect fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Disconnect failed" }),
      });

      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const disconnectButton = screen.getByRole("button", { name: /Disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // MASTER TOGGLE TESTS
  // ============================================================================

  describe("Master Toggle", () => {
    it("renders master calendar sync toggle", () => {
      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      // Master toggle label is "Calendar Sync"
      expect(screen.getByText("Calendar Sync")).toBeInTheDocument();
    });

    it.each([
      { profile: defaultProfile, shouldBeChecked: false, description: "disabled" },
      { profile: enabledProfile, shouldBeChecked: true, description: "enabled" },
    ])("shows toggle $description state correctly", ({ profile, shouldBeChecked }) => {
      renderWithProviders(<CalendarSyncSection profile={profile} />);
      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];
      if (shouldBeChecked) {
        expect(masterToggle).toBeChecked();
      } else {
        expect(masterToggle).not.toBeChecked();
      }
    });

    it("calls updateProfile when toggle changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];
      await user.click(masterToggle);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ calendarSyncEnabled: true });
      });
    });

    it("shows success toast when sync enabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];
      await user.click(masterToggle);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Calendar sync enabled");
      });
    });

    it("shows success toast when sync disabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];
      await user.click(masterToggle);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Calendar sync disabled");
      });
    });
  });

  // ============================================================================
  // DEADLINE TYPE TOGGLES TESTS
  // ============================================================================

  describe("Deadline Type Toggles", () => {
    it("renders all 7 deadline type toggles when enabled", async () => {
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText("PWD Deadlines")).toBeInTheDocument();
        expect(screen.getByText("ETA 9089 Filing Window")).toBeInTheDocument();
        expect(screen.getByText("I-140 Deadlines")).toBeInTheDocument();
        expect(screen.getByText("RFE Due Dates")).toBeInTheDocument();
        expect(screen.getByText("RFI Due Dates")).toBeInTheDocument();
        expect(screen.getByText("Recruitment Deadlines")).toBeInTheDocument();
        expect(screen.getByText("Filing Window")).toBeInTheDocument();
      });
    });

    it("disables sub-toggles when master toggle is off", async () => {
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      await waitFor(() => {
        const toggles = screen.getAllByRole("switch");
        // First toggle is master, rest are sub-toggles
        for (let i = 1; i < toggles.length; i++) {
          expect(toggles[i]).toBeDisabled();
        }
      });
    });

    it("enables sub-toggles when master toggle is on", async () => {
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const toggles = screen.getAllByRole("switch");
        // First toggle is master, rest are sub-toggles
        for (let i = 1; i < toggles.length; i++) {
          expect(toggles[i]).not.toBeDisabled();
        }
      });
    });

    it("calls updateProfile when sub-toggle changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText("PWD Deadlines")).toBeInTheDocument();
      });

      // Find and click the PWD toggle
      const toggles = screen.getAllByRole("switch");
      const pwdToggle = toggles[1]; // First sub-toggle
      await user.click(pwdToggle);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // DISABLED STATE TESTS
  // ============================================================================

  describe("Disabled States", () => {
    it("master toggle is always enabled (can configure even before connecting)", () => {
      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];
      // Master toggle is enabled so users can configure preferences before connecting
      expect(masterToggle).not.toBeDisabled();
    });

    it("sub-toggles disabled when master is off even if connected", () => {
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      // Skip first toggle (master), check that sub-toggles are disabled
      for (let i = 1; i < toggles.length; i++) {
        expect(toggles[i]).toBeDisabled();
      }
    });

    it("shows warning when sync enabled but not connected", async () => {
      renderWithProviders(
        <CalendarSyncSection profile={enabledNotConnectedProfile} />
      );

      // Warning about connecting appears when masterEnabled is true but not connected
      await waitFor(() => {
        expect(screen.getByText(/Connect your Google Calendar to start syncing deadlines/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("all toggles have accessible names", () => {
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      toggles.forEach(toggle => {
        expect(toggle).toHaveAccessibleName();
      });
    });

    it("master toggle has correct id", () => {
      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      const masterToggle = screen.getByRole("switch", { name: /calendar sync/i });
      expect(masterToggle).toHaveAttribute("id", "calendar-sync-enabled");
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe("Error Handling", () => {
    it("shows error toast when update fails", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Update failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];
      await user.click(masterToggle);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    it("reverts toggle state on error", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Update failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const toggles = screen.getAllByRole("switch");
      const masterToggle = toggles[0];

      // Toggle should be unchecked initially
      expect(masterToggle).not.toBeChecked();

      await user.click(masterToggle);

      // After error, should revert to unchecked
      await waitFor(() => {
        expect(masterToggle).not.toBeChecked();
      });
    });
  });

  // ============================================================================
  // SYNC ALL BUTTON TESTS
  // ============================================================================

  describe("Sync All Button", () => {
    it("shows Sync All button when connected and enabled", async () => {
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Sync All/i })).toBeInTheDocument();
      });
    });

    it("hides Sync All button when not connected", () => {
      renderWithProviders(
        <CalendarSyncSection profile={enabledNotConnectedProfile} />
      );

      expect(screen.queryByRole("button", { name: /Sync All/i })).not.toBeInTheDocument();
    });

    it("hides Sync All button when master toggle is off", () => {
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      expect(screen.queryByRole("button", { name: /Sync All/i })).not.toBeInTheDocument();
    });

    it("calls syncAllCases when Sync All button clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockSyncAllCases).toHaveBeenCalled();
      });
    });

    it("shows success toast after successful sync", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Synced 5 cases to calendar");
      });
    });

    it("shows info toast when no cases to sync", async () => {
      mockSyncAllCases.mockResolvedValueOnce({
        success: true,
        total: 0,
        synced: 0,
        failed: 0,
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastInfo).toHaveBeenCalledWith("No cases to sync");
      });
    });

    it("shows warning toast when some cases fail", async () => {
      mockSyncAllCases.mockResolvedValueOnce({
        success: true,
        total: 5,
        synced: 3,
        failed: 2,
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastWarning).toHaveBeenCalled();
      });
    });

    it("shows error toast when sync fails completely", async () => {
      mockSyncAllCases.mockResolvedValueOnce({
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        error: "Not connected",
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    it("displays sync progress after successful sync", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(screen.getByText(/Last sync: 5\/5 cases synced/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // TOKEN REFRESH FAILURES
  // ============================================================================

  describe("Token Refresh Failures", () => {
    it("shows error when token refresh fails", async () => {
      mockSyncAllCases.mockRejectedValueOnce(new Error("Token expired"));
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Token expired");
      }, { timeout: 3000 });
    });

    it("shows reconnect prompt when credentials are invalid", async () => {
      mockSyncAllCases.mockResolvedValueOnce({
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        error: "invalid_grant: Token has been expired or revoked",
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    it("handles network timeout during sync gracefully", async () => {
      mockSyncAllCases.mockRejectedValueOnce(new Error("Network timeout"));
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // SYNC CONFLICT HANDLING
  // ============================================================================

  describe("Sync Conflict Handling", () => {
    it("shows warning when partial sync occurs", async () => {
      mockSyncAllCases.mockResolvedValueOnce({
        success: true,
        total: 10,
        synced: 7,
        failed: 3,
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastWarning).toHaveBeenCalled();
      });
    });

    it("shows success when all cases sync despite previous failures", async () => {
      mockSyncAllCases.mockResolvedValueOnce({
        success: true,
        total: 5,
        synced: 5,
        failed: 0,
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // OAUTH EDGE CASES
  // ============================================================================

  describe("OAuth Edge Cases", () => {
    it("handles permission denial from OAuth popup", async () => {
      // Simulate OAuth error in URL params
      mockSearchParams.set("error", "access_denied");
      mockSearchParams.set("error_description", "User denied access");

      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      // Clean up
      mockSearchParams.delete("error");
      mockSearchParams.delete("error_description");
    });

    it("handles OAuth state mismatch (CSRF protection)", async () => {
      // Simulate state mismatch error
      mockSearchParams.set("error", "state_mismatch");

      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      // Clean up
      mockSearchParams.delete("error");
    });

    it("clears error params from URL after handling", async () => {
      mockSearchParams.set("error", "access_denied");
      mockSearchParams.set("error_description", "User denied access");

      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      });

      // Clean up
      mockSearchParams.delete("error");
      mockSearchParams.delete("error_description");
    });

    // NOTE: The OAuth code exchange happens SERVER-SIDE in /api/google/callback,
    // NOTE: OAuth code exchange and popup scenarios are not applicable to this component.
    // Code exchange is server-side. Component uses redirect, not popup.
    // These tests were intentionally removed as N/A (not skipped).
  });

  // ============================================================================
  // CLEAR ALL CALENDAR EVENTS
  // ============================================================================

  describe("Clear All Calendar Events", () => {
    it("shows 'Clear All' button when connected", async () => {
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const clearButton = await screen.findByRole("button", { name: /Clear All/i });
      expect(clearButton).toBeInTheDocument();
    });

    it("hides 'Clear All' button when not connected", () => {
      renderWithProviders(
        <CalendarSyncSection profile={defaultProfile} />
      );

      expect(screen.queryByRole("button", { name: /Clear All/i })).not.toBeInTheDocument();
    });

    it("calls clearAllEvents action when 'Clear All' button clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const clearButton = await screen.findByRole("button", { name: /Clear All/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockClearAllEvents).toHaveBeenCalled();
      });
    });

    it("shows success toast with event count after clearing", async () => {
      mockClearAllEvents.mockResolvedValueOnce({
        success: true,
        eventsDeleted: 15,
        casesCleaned: 5,
        errors: 0,
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const clearButton = await screen.findByRole("button", { name: /Clear All/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });

    it("shows info toast when no events to clear", async () => {
      mockClearAllEvents.mockResolvedValueOnce({
        success: true,
        eventsDeleted: 0,
        casesCleaned: 0,
        errors: 0,
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const clearButton = await screen.findByRole("button", { name: /Clear All/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockToastInfo).toHaveBeenCalled();
      });
    });

    it("shows error toast when clearing fails", async () => {
      mockClearAllEvents.mockResolvedValueOnce({
        success: false,
        eventsDeleted: 0,
        casesCleaned: 0,
        errors: 1,
        error: "Failed to clear events",
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const clearButton = await screen.findByRole("button", { name: /Clear All/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    it("disables 'Clear All' button while sync is in progress", async () => {
      // Make sync take a long time
      mockSyncAllCases.mockImplementation(() => new Promise(() => {})); // Never resolves
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={enabledProfile} />
      );

      // Click sync button first
      const syncButton = await screen.findByRole("button", { name: /Sync All/i });
      await user.click(syncButton);

      // Clear button should be disabled while syncing
      const clearButton = await screen.findByRole("button", { name: /Clear/i });
      expect(clearButton).toBeDisabled();
    });
  });

  // ============================================================================
  // DISCONNECT FLOW WITH EVENT CLEARING
  // ============================================================================

  describe("Disconnect Flow with Event Clearing", () => {
    it("calls disconnect API which clears events", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const disconnectButton = await screen.findByRole("button", { name: /Disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/google/disconnect",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("shows detailed success message with event count when disconnecting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          revoked: true,
          eventsCleared: {
            eventsDeleted: 8,
            casesCleaned: 3,
            errors: 0,
          },
          message: "Google Calendar disconnected: 8 events removed from calendar",
        }),
      });
      const user = userEvent.setup();
      renderWithProviders(
        <CalendarSyncSection profile={connectedProfile} />
      );

      const disconnectButton = await screen.findByRole("button", { name: /Disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });
  });
});
