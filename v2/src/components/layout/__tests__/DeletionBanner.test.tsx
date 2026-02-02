import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import DeletionBanner from "../DeletionBanner";

// ============================================================================
// MOCKS
// ============================================================================

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
}));

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const mockGetItem = vi.fn((key: string) => mockSessionStorage[key] ?? null);
const mockSetItem = vi.fn((key: string, value: string) => {
  mockSessionStorage[key] = value;
});

// ============================================================================
// HELPERS
// ============================================================================

const futureDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now

const scheduledProfile = {
  deletedAt: futureDate,
};

const noDeleteProfile = {
  deletedAt: undefined,
};

// ============================================================================
// TESTS
// ============================================================================

describe("DeletionBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sessionStorage mock
    Object.keys(mockSessionStorage).forEach(
      (key) => delete mockSessionStorage[key]
    );
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });
  });

  describe("Rendering", () => {
    it("renders banner when deletion is scheduled", () => {
      mockUseQuery.mockReturnValue(scheduledProfile);
      renderWithProviders(<DeletionBanner />);

      const banner = screen.getByRole("alert");
      expect(banner).toBeInTheDocument();
      expect(
        screen.getByText(/scheduled for deletion/i)
      ).toBeInTheDocument();
    });

    it("does not render when no deletion scheduled", () => {
      mockUseQuery.mockReturnValue(noDeleteProfile);
      renderWithProviders(<DeletionBanner />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not render when profile is loading", () => {
      mockUseQuery.mockReturnValue(undefined);
      renderWithProviders(<DeletionBanner />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("displays correct deletion date", () => {
      mockUseQuery.mockReturnValue(scheduledProfile);
      renderWithProviders(<DeletionBanner />);

      const formattedDate = new Date(futureDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const matches = screen.getAllByText(formattedDate);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("links to /settings", () => {
      mockUseQuery.mockReturnValue(scheduledProfile);
      renderWithProviders(<DeletionBanner />);

      const link = screen.getByRole("link", { name: /Go to Settings/i });
      expect(link).toHaveAttribute("href", "/settings");
    });

    it("has accessible role and label", () => {
      mockUseQuery.mockReturnValue(scheduledProfile);
      renderWithProviders(<DeletionBanner />);

      const banner = screen.getByRole("alert");
      expect(banner).toHaveAttribute("aria-label", "Account deletion warning");
    });
  });

  describe("Dismissal", () => {
    it("dismisses banner on X click and sets sessionStorage", async () => {
      mockUseQuery.mockReturnValue(scheduledProfile);
      const user = userEvent.setup();
      renderWithProviders(<DeletionBanner />);

      const dismissButton = screen.getByRole("button", {
        name: /Dismiss deletion warning/i,
      });
      await user.click(dismissButton);

      expect(mockSetItem).toHaveBeenCalledWith(
        `dismissedDeletionBanner_${futureDate}`,
        "true"
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("stays dismissed within same session", () => {
      mockSessionStorage[`dismissedDeletionBanner_${futureDate}`] = "true";
      mockGetItem.mockImplementation(
        (key: string) => mockSessionStorage[key] ?? null
      );
      mockUseQuery.mockReturnValue(scheduledProfile);
      renderWithProviders(<DeletionBanner />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
