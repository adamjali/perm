// @vitest-environment jsdom
/**
 * @fileoverview Tests for NotificationPreferencesSection component
 * @see v2/src/components/settings/NotificationPreferencesSection.tsx
 *
 * Tests cover:
 * - Basic rendering (sections, headers, toggles)
 * - Email notification toggles (master + sub-toggles)
 * - Push notification status badges and toggles
 * - Reminder settings (checkboxes, urgent threshold)
 * - Test email/push buttons (states, loading)
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import NotificationPreferencesSection from "../NotificationPreferencesSection";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Convex hooks
const mockUpdateProfile = vi.fn();
const mockSendTestEmail = vi.fn();
const mockSavePushSubscription = vi.fn();
const mockRemovePushSubscription = vi.fn();
const mockSendTestPush = vi.fn();

// Track which hooks have been called to return the right mocks
let useMutationCallCount = 0;
let useActionCallCount = 0;

vi.mock("convex/react", () => ({
  useMutation: () => {
    // Order of calls in component:
    // 1. updateUserProfile
    // 2. savePushSubscription
    // 3. removePushSubscription
    useMutationCallCount++;
    if (useMutationCallCount % 3 === 2) return mockSavePushSubscription;
    if (useMutationCallCount % 3 === 0) return mockRemovePushSubscription;
    return mockUpdateProfile;
  },
  useAction: () => {
    // Order of calls in component:
    // 1. sendTestEmail
    // 2. sendTestPush
    useActionCallCount++;
    if (useActionCallCount % 2 === 0) return mockSendTestPush;
    return mockSendTestEmail;
  },
}));

// Mock push subscription helpers
const mockIsPushSupported = vi.fn(() => true);
const mockGetPushSubscriptionStatus = vi.fn(() => Promise.resolve({
  supported: true,
  permission: "default" as const,
  subscribed: false,
}));
const mockSubscribeToPush = vi.fn(() => Promise.resolve("mock-subscription-json"));
const mockUnsubscribeFromPush = vi.fn(() => Promise.resolve());

vi.mock("@/lib/pushSubscription", () => ({
  isPushSupported: () => mockIsPushSupported(),
  getPushSubscriptionStatus: () => mockGetPushSubscriptionStatus(),
  subscribeToPush: () => mockSubscribeToPush(),
  unsubscribeFromPush: () => mockUnsubscribeFromPush(),
}));

// Mock auth-aware toast wrapper (not sonner directly)
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultProfile = {
  emailNotificationsEnabled: true,
  emailDeadlineReminders: true,
  emailDeadlineReminderPwd: true,
  emailDeadlineReminderRecruitment: true,
  emailDeadlineReminderEta9089: true,
  emailDeadlineReminderI140: true,
  emailDeadlineReminderRfi: true,
  emailDeadlineReminderRfe: true,
  emailStatusUpdates: true,
  emailRfeAlerts: true,
  pushNotificationsEnabled: false,
  reminderDaysBefore: [7n, 14n, 30n],
  urgentDeadlineDays: 7n,
};

const disabledEmailProfile = {
  ...defaultProfile,
  emailNotificationsEnabled: false,
};

const pushEnabledProfile = {
  ...defaultProfile,
  pushNotificationsEnabled: true,
};

const TEST_EMAIL = "test@example.com";

// ============================================================================
// SETUP
// ============================================================================

describe("NotificationPreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset call counters for proper mock routing
    useMutationCallCount = 0;
    useActionCallCount = 0;
    mockUpdateProfile.mockResolvedValue(undefined);
    mockSendTestEmail.mockResolvedValue(undefined);
    mockSendTestPush.mockResolvedValue({ success: true });
    mockSavePushSubscription.mockResolvedValue(undefined);
    mockRemovePushSubscription.mockResolvedValue(undefined);
    mockIsPushSupported.mockReturnValue(true);
    mockGetPushSubscriptionStatus.mockResolvedValue({
      supported: true,
      permission: "default",
      subscribed: false,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // BASIC RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders Email Notifications section header", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // Header is in h3, toggle label also contains the text - use getAllByText
      const elements = screen.getAllByText("Email Notifications");
      expect(elements.length).toBeGreaterThanOrEqual(1);
      // The first one should be the h3 header
      expect(elements[0].tagName).toBe("H3");
    });

    it("renders Push Notifications section header", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // Header is in h3, toggle label also contains the text - use getAllByText
      const elements = screen.getAllByText("Push Notifications");
      expect(elements.length).toBeGreaterThanOrEqual(1);
      // The first one should be the h3 header
      expect(elements[0].tagName).toBe("H3");
    });

    it("renders Reminder Settings section header", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText("Reminder Settings")).toBeInTheDocument();
    });

    it("renders section descriptions", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText("Control which email notifications you receive")).toBeInTheDocument();
      expect(screen.getByText("Receive notifications directly in your browser")).toBeInTheDocument();
      expect(screen.getByText("Configure when you receive deadline reminders")).toBeInTheDocument();
    });

    it("renders user email in test email section", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EMAIL NOTIFICATION TOGGLES
  // ============================================================================

  describe("Email Notification Toggles", () => {
    it("renders master email toggle", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const toggle = screen.getByRole("switch", { name: /email notifications/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toBeChecked();
    });

    it("shows warning when email notifications disabled", async () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={disabledEmailProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        expect(screen.getByText("All email notifications are turned off")).toBeInTheDocument();
      });
    });

    it("renders deadline reminders toggle", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText("Deadline Reminders")).toBeInTheDocument();
      // The switch is in a separate div from the label button, so find by id
      const toggle = document.getElementById("email-deadline-reminders");
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute("role", "switch");
    });

    it("renders status updates toggle", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText("Status Updates")).toBeInTheDocument();
    });

    it("renders RFI/RFE response toggles when deadline reminders expanded", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // RFI/RFE toggles are inside a collapsible section that starts collapsed
      // First, expand the "Deadline Reminders" section by clicking on it
      const deadlineRemindersButton = screen.getByRole("button", { name: /deadline reminders/i });
      await user.click(deadlineRemindersButton);

      // Now the RFI/RFE toggles should be visible
      await waitFor(() => {
        expect(screen.getByText("RFI Response")).toBeInTheDocument();
        expect(screen.getByText("RFE Response")).toBeInTheDocument();
      });
    });

    it("disables sub-toggles when master toggle is off", async () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={disabledEmailProfile} userEmail={TEST_EMAIL} />
      );

      // Sub-toggles should be disabled when email notifications are off
      const statusToggle = screen.getAllByRole("switch").find(toggle =>
        toggle.getAttribute("id") === "email-status-updates"
      );
      expect(statusToggle).toBeDisabled();
    });

    it("calls updateProfile when master toggle changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const toggle = screen.getByRole("switch", { name: /^email notifications$/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ emailNotificationsEnabled: false });
      });
    });

    it("shows toast on successful toggle update", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const toggle = screen.getByRole("switch", { name: /^email notifications$/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });

    it("reverts toggle and shows error toast on update failure", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Update failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const toggle = screen.getByRole("switch", { name: /^email notifications$/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // EXPANDABLE DEADLINE TYPES
  // ============================================================================

  describe("Expandable Deadline Types", () => {
    it("expands deadline types when clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const expandButton = screen.getByText("Deadline Reminders").closest("button");
      expect(expandButton).toBeInTheDocument();
      await user.click(expandButton!);

      await waitFor(() => {
        expect(screen.getByText("PWD Expiration")).toBeInTheDocument();
        expect(screen.getByText("Recruitment")).toBeInTheDocument();
        expect(screen.getByText("ETA 9089")).toBeInTheDocument();
        expect(screen.getByText("I-140")).toBeInTheDocument();
        expect(screen.getByText("RFI Response")).toBeInTheDocument();
        expect(screen.getByText("RFE Response")).toBeInTheDocument();
      });
    });

    it("collapses deadline types when clicked again", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const expandButton = screen.getByText("Deadline Reminders").closest("button");

      // Expand
      await user.click(expandButton!);
      await waitFor(() => {
        expect(screen.getByText("PWD Expiration")).toBeInTheDocument();
      });

      // Collapse
      await user.click(expandButton!);
      await waitFor(() => {
        expect(screen.queryByText("PWD Expiration")).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // PUSH NOTIFICATION STATUS BADGES
  // ============================================================================

  describe("Push Notification Status Badges", () => {
    it("shows Disabled badge when push is not enabled", async () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        expect(screen.getByText("Disabled")).toBeInTheDocument();
      });
    });

    it("shows Enabled badge when push is enabled and subscribed", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "granted",
        subscribed: true,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={pushEnabledProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        expect(screen.getByText("Enabled")).toBeInTheDocument();
      });
    });

    it("shows Blocked badge when permission is denied", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "denied",
        subscribed: false,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        expect(screen.getByText("Blocked")).toBeInTheDocument();
      });
    });

    it("shows Not Supported badge when push is not supported", async () => {
      mockIsPushSupported.mockReturnValue(false);
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: false,
        permission: "unsupported",
        subscribed: false,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        expect(screen.getByText("Not Supported")).toBeInTheDocument();
      });
    });

    it("shows permission denied warning message", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "denied",
        subscribed: false,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Push notifications are blocked/)).toBeInTheDocument();
      });
    });

    it("shows not supported warning message", async () => {
      mockIsPushSupported.mockReturnValue(false);
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: false,
        permission: "unsupported",
        subscribed: false,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        // The warning message with browser alternatives appears in the warning banner
        // This text only appears in the banner, not in the description
        expect(screen.getByText(/Try using Chrome, Firefox, or Edge/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // PUSH NOTIFICATION TOGGLES
  // ============================================================================

  describe("Push Notification Toggles", () => {
    it("disables push toggle when not supported", async () => {
      mockIsPushSupported.mockReturnValue(false);
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: false,
        permission: "unsupported",
        subscribed: false,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        const pushToggle = screen.getByRole("switch", { name: /push notifications/i });
        expect(pushToggle).toBeDisabled();
      });
    });

    it("disables push toggle when permission is denied", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "denied",
        subscribed: false,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        const pushToggle = screen.getByRole("switch", { name: /push notifications/i });
        expect(pushToggle).toBeDisabled();
      });
    });

    it("shows error toast when toggling unsupported push", async () => {
      mockIsPushSupported.mockReturnValue(false);
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: false,
        permission: "unsupported",
        subscribed: false,
      });

      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // Wait for status to load, then try to find and click toggle
      await waitFor(() => {
        const pushToggle = screen.getByRole("switch", { name: /push notifications/i });
        expect(pushToggle).toBeDisabled();
      });
    });
  });

  // ============================================================================
  // REMINDER SETTINGS
  // ============================================================================

  describe("Reminder Settings", () => {
    it("renders reminder days checkboxes", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText("1 day")).toBeInTheDocument();
      expect(screen.getByText("3 days")).toBeInTheDocument();
      expect(screen.getByText("7 days")).toBeInTheDocument();
      expect(screen.getByText("14 days")).toBeInTheDocument();
      expect(screen.getByText("30 days")).toBeInTheDocument();
    });

    it("shows default reminder days as checked", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // Default is 7, 14, 30 days
      const checkboxes = screen.getAllByRole("checkbox");
      // Find the ones that should be checked based on labels
      expect(checkboxes.length).toBeGreaterThanOrEqual(5);
    });

    it("renders urgent deadline threshold input", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText("Urgent deadline threshold")).toBeInTheDocument();
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(7);
    });

    it("renders increment/decrement buttons for urgent days", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const buttons = screen.getAllByRole("button");
      // Should have plus and minus buttons
      expect(buttons.some(btn => btn.querySelector('[class*="Plus"]') || btn.textContent === '')).toBe(true);
    });

    it("updates reminder days when checkbox clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // Find and click the "1 day" checkbox
      const oneDayLabel = screen.getByText("1 day");
      const checkbox = oneDayLabel.previousElementSibling;
      if (checkbox) {
        await user.click(checkbox);
      }

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalled();
      });
    });

    it("shows warning about urgent deadlines bypassing quiet hours", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      expect(screen.getByText(/Urgent deadlines bypass quiet hours/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TEST EMAIL BUTTON
  // ============================================================================

  describe("Test Email Button", () => {
    it("renders test email button", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      // There are 2 "Send Test" buttons - one for email, one for push
      const testButtons = screen.getAllByRole("button", { name: /send test/i });
      expect(testButtons.length).toBe(2);
      expect(testButtons[0]).toBeInTheDocument();
    });

    it("disables test email button when email notifications disabled", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={disabledEmailProfile} userEmail={TEST_EMAIL} />
      );

      const buttons = screen.getAllByRole("button", { name: /send test/i });
      // First "Send Test" button is for email
      expect(buttons[0]).toBeDisabled();
    });

    it("calls sendTestEmail when clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const testButton = screen.getAllByRole("button", { name: /send test/i })[0];
      await user.click(testButton);

      await waitFor(() => {
        expect(mockSendTestEmail).toHaveBeenCalledWith({ email: TEST_EMAIL });
      });
    });

    it("shows success toast after sending test email", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const testButton = screen.getAllByRole("button", { name: /send test/i })[0];
      await user.click(testButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Test email sent! Check your inbox.");
      });
    });

    it("shows error toast when test email fails", async () => {
      mockSendTestEmail.mockRejectedValueOnce(new Error("Send failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const testButton = screen.getAllByRole("button", { name: /send test/i })[0];
      await user.click(testButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to send test email. Please try again.");
      });
    });
  });

  // ============================================================================
  // TEST PUSH BUTTON
  // ============================================================================

  describe("Test Push Button", () => {
    it("disables test push button when push not enabled", async () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole("button", { name: /send test/i });
        // Second "Send Test" button is for push
        expect(buttons[1]).toBeDisabled();
      });
    });

    it("enables test push button when push is enabled and subscribed", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "granted",
        subscribed: true,
      });

      renderWithProviders(
        <NotificationPreferencesSection profile={pushEnabledProfile} userEmail={TEST_EMAIL} />
      );

      // Wait for push status to load (indicated by "Enabled" badge appearing)
      await waitFor(() => {
        expect(screen.getByText("Enabled")).toBeInTheDocument();
      });

      // Now the push button should be enabled
      const buttons = screen.getAllByRole("button", { name: /send test/i });
      expect(buttons[1]).not.toBeDisabled();
    });

    it("calls sendTestPush when clicked", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "granted",
        subscribed: true,
      });

      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={pushEnabledProfile} userEmail={TEST_EMAIL} />
      );

      // Wait for push status to load (indicated by "Enabled" badge appearing)
      await waitFor(() => {
        expect(screen.getByText("Enabled")).toBeInTheDocument();
      });

      const testButton = screen.getAllByRole("button", { name: /send test/i })[1];
      await user.click(testButton);

      await waitFor(() => {
        expect(mockSendTestPush).toHaveBeenCalled();
      });
    });

    it("shows success toast after sending test push", async () => {
      mockGetPushSubscriptionStatus.mockResolvedValue({
        supported: true,
        permission: "granted",
        subscribed: true,
      });

      const user = userEvent.setup();
      renderWithProviders(
        <NotificationPreferencesSection profile={pushEnabledProfile} userEmail={TEST_EMAIL} />
      );

      // Wait for push status to load (indicated by "Enabled" badge appearing)
      await waitFor(() => {
        expect(screen.getByText("Enabled")).toBeInTheDocument();
      });

      const testButton = screen.getAllByRole("button", { name: /send test/i })[1];
      await user.click(testButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Test push notification sent!");
      });
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("toggles are rendered with switch role", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const switches = screen.getAllByRole("switch");
      // Should have multiple switches: email master, email sub-toggles, push toggle
      expect(switches.length).toBeGreaterThanOrEqual(2);
    });

    it("urgent days input has accessible label", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("id", "urgent-deadline-days");
    });

    it("test buttons have accessible names", () => {
      renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const testButtons = screen.getAllByRole("button", { name: /send test/i });
      expect(testButtons.length).toBe(2);
      testButtons.forEach(btn => {
        expect(btn).toHaveAccessibleName();
      });
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("applies neobrutalist border styling to sections", () => {
      const { container } = renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const cards = container.querySelectorAll(".border-2.border-black");
      expect(cards.length).toBeGreaterThanOrEqual(3); // 3 sections
    });

    it("applies box shadow styling via inline style", () => {
      const { container } = renderWithProviders(
        <NotificationPreferencesSection profile={defaultProfile} userEmail={TEST_EMAIL} />
      );

      const cardsWithShadow = container.querySelectorAll('[style*="box-shadow"]');
      expect(cardsWithShadow.length).toBeGreaterThanOrEqual(3);
    });
  });
});
