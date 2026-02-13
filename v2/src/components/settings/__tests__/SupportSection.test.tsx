// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import SupportSection from "../SupportSection";

const SUPPORT_EMAIL = "support@permtracker.app";
const GITHUB_BUG_REPORT_URL = "https://github.com";
const GITHUB_FEATURE_REQUEST_URL = "https://github.com";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn() }),
}));

const mockSignOut = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: mockSignOut }) }));

const mockRequestDeletion = vi.fn();
const mockCancelDeletion = vi.fn();
const mockImmediateDelete = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (typeof ref === "object" && ref !== null && JSON.stringify(ref).includes("cancel")) return mockCancelDeletion;
    return mockRequestDeletion;
  },
  useAction: () => mockImmediateDelete,
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { success: (msg: string) => mockToastSuccess(msg), error: (msg: string) => mockToastError(msg) },
  updateToastAuthState: vi.fn(),
}));

vi.mock("@/components/onboarding/OnboardingProvider", () => ({
  useOnboarding: () => ({ restartTour: vi.fn() }),
}));

const defaultProfile = { deletedAt: undefined };
const scheduledDeletionProfile = { deletedAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };

describe("SupportSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_VERSION = undefined;
    mockRequestDeletion.mockResolvedValue(undefined);
    mockCancelDeletion.mockResolvedValue(undefined);
    mockImmediateDelete.mockResolvedValue({ success: true });
  });

  it("renders header, description, and all three support links", () => {
    renderWithProviders(<SupportSection profile={defaultProfile} />);
    expect(screen.getByText("Help & Support")).toBeInTheDocument();
    expect(screen.getByText("Get help, report issues, or suggest new features")).toBeInTheDocument();
    expect(screen.getAllByRole("link").length).toBe(3);
  });

  describe("links", () => {
    it("email link has correct mailto href and displays address", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      expect(screen.getByRole("link", { name: /contact support/i })).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
      expect(screen.getByText(SUPPORT_EMAIL)).toBeInTheDocument();
    });

    it("GitHub links have correct hrefs with labels", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      const bugLink = screen.getByRole("link", { name: /report a bug/i });
      expect(bugLink).toHaveAttribute("href", GITHUB_BUG_REPORT_URL);
      const featureLink = screen.getByRole("link", { name: /request feature/i });
      expect(featureLink).toHaveAttribute("href", GITHUB_FEATURE_REQUEST_URL);
    });

    it("external links open in new tab with noopener noreferrer", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      for (const name of [/report a bug/i, /request feature/i]) {
        const link = screen.getByRole("link", { name });
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
      expect(screen.getByRole("link", { name: /contact support/i })).toHaveAttribute("target", "_blank");
    });
  });

  describe("app info", () => {
    it("displays version and copyright with current year", () => {
      const { container } = renderWithProviders(<SupportSection profile={defaultProfile} />);
      const versionSpan = container.querySelector(".font-mono");
      expect(versionSpan?.textContent).toContain("PERM Tracker v");
      const infoBar = container.querySelector(".bg-muted\\/30");
      expect(infoBar?.textContent).toContain(`${new Date().getFullYear()}`);
      expect(infoBar?.textContent).toContain("PERM Tracker");
    });
  });

  describe("delete account", () => {
    it("renders delete account section with button when not scheduled", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      expect(screen.getByRole("heading", { name: /Delete Account/i })).toBeInTheDocument();
      expect(screen.getByText(/Permanently delete your account/)).toBeInTheDocument();
      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      expect(deleteButton).not.toBeDisabled();
    });

    it("shows scheduled deletion state with cancel and delete now buttons", () => {
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);
      expect(screen.getByText("Deletion Scheduled")).toBeInTheDocument();
      expect(screen.getByText("Deletion Pending")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel Deletion/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Deletion Pending/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Delete Now/i })).toBeInTheDocument();
    });

    it("does not show Delete Now when no deletion scheduled", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      expect(screen.queryByRole("button", { name: /Delete Now/i })).not.toBeInTheDocument();
    });

    it("opens confirmation dialog requiring DELETE text", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const triggerBtn = screen.getByRole("button", { name: /Delete Account/i });
      await user.click(triggerBtn);
      expect(screen.getByText("Delete Your Account")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type DELETE to confirm/i)).toBeInTheDocument();

      // Confirm button starts disabled
      const allButtons = screen.getAllByRole("button");
      const confirmBtn = allButtons.find((btn) => btn.textContent?.includes("Delete Account") && btn !== triggerBtn);
      expect(confirmBtn).toBeDisabled();

      // Type confirmation enables it
      await user.type(screen.getByPlaceholderText(/Type DELETE to confirm/i), "DELETE");
      await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    });

    it("closes dialog on Cancel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      await user.click(screen.getByRole("button", { name: /Delete Account/i }));
      expect(screen.getByText("Delete Your Account")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
      await waitFor(() => expect(screen.queryByText("Delete Your Account")).not.toBeInTheDocument());
    });

    it("shows deletion warning items in dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);
      await user.click(screen.getByRole("button", { name: /Delete Account/i }));
      expect(screen.getByText(/All your PERM cases and related data/)).toBeInTheDocument();
      expect(screen.getByText(/Notification preferences and history/)).toBeInTheDocument();
      expect(screen.getByText(/Calendar sync settings/)).toBeInTheDocument();
      expect(screen.getByText(/Your user profile/)).toBeInTheDocument();
    });

    it("opens DeleteNowDialog when Delete Now clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);
      await user.click(screen.getByRole("button", { name: /Delete Now/i }));
      expect(screen.getByText("Delete Account Now")).toBeInTheDocument();
    });
  });

  it("all links have accessible names", () => {
    renderWithProviders(<SupportSection profile={defaultProfile} />);
    for (const name of [/contact support/i, /report a bug/i, /request feature/i]) {
      expect(screen.getByRole("link", { name })).toHaveAccessibleName();
    }
    expect(screen.getByRole("button", { name: /Delete Account/i })).toHaveAccessibleName();
  });
});
