// @vitest-environment jsdom
/**
 * NotificationList Component Tests
 *
 * Tests for the full notification list component with grouping and pagination.
 *
 * Requirements:
 * - Renders notifications grouped by date (Today, Yesterday, This Week, etc.)
 * - Shows empty state when no notifications
 * - Pagination with "Load More" button works
 * - Filtering by type works
 * - Filtering by read status works
 * - Group headers display correctly
 * - Empty groups are hidden
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import NotificationList from "../NotificationList";
import type { Id } from "../../../../../convex/_generated/dataModel";

// Mock Convex React hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

// Import the mocked module
import { useQuery, useMutation } from "convex/react";

// ============================================================================
// TEST FIXTURES
// ============================================================================

type NotificationType =
  | "deadline_reminder"
  | "status_change"
  | "rfe_alert"
  | "rfi_alert"
  | "system"
  | "auto_closure";

type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface MockNotification {
  _id: Id<"notifications">;
  _creationTime: number;
  userId: Id<"users">;
  caseId?: Id<"cases">;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  emailSent: boolean;
  createdAt: number;
  updatedAt: number;
  caseInfo?: {
    employerName?: string;
    beneficiaryIdentifier?: string;
    caseStatus?: string;
  } | null;
}

/**
 * Factory for creating test notifications with sensible defaults.
 */
function createMockNotification(
  overrides?: Partial<MockNotification>
): MockNotification {
  const now = Date.now();
  return {
    _id: `notification-${Math.random().toString(36).substring(7)}` as Id<"notifications">,
    _creationTime: now,
    userId: "user-123" as Id<"users">,
    type: "deadline_reminder",
    title: "Test Notification",
    message: "This is a test notification message",
    priority: "normal",
    isRead: false,
    emailSent: false,
    createdAt: now,
    updatedAt: now,
    caseInfo: null,
    ...overrides,
  };
}

/**
 * Create notifications for specific date groups for testing.
 */
function createNotificationsForDateGroups(): MockNotification[] {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const yesterday = now - 24 * 60 * 60 * 1000;
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
  const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000;

  return [
    createMockNotification({
      _id: "notif-today" as Id<"notifications">,
      title: "Today Notification",
      createdAt: oneHourAgo,
    }),
    createMockNotification({
      _id: "notif-yesterday" as Id<"notifications">,
      title: "Yesterday Notification",
      createdAt: yesterday,
    }),
    createMockNotification({
      _id: "notif-this-week" as Id<"notifications">,
      title: "This Week Notification",
      createdAt: threeDaysAgo,
    }),
    createMockNotification({
      _id: "notif-this-month" as Id<"notifications">,
      title: "This Month Notification",
      createdAt: twoWeeksAgo,
    }),
    createMockNotification({
      _id: "notif-older" as Id<"notifications">,
      title: "Older Notification",
      createdAt: twoMonthsAgo,
    }),
  ];
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock implementation for useMutation
  (useMutation as Mock).mockReturnValue(vi.fn().mockResolvedValue({ success: true }));
});

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe("NotificationList - Rendering", () => {
  it("renders loading skeleton when data is undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);

    const { container } = renderWithProviders(
      <NotificationList activeTab="all" />
    );

    // Skeleton loader should be present when loading - no content text
    expect(container.textContent).toBe('');
  });

  it("renders empty state when no notifications", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    // The phrase "No notifications" appears in the title
    // "all caught up" appears in the description
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("renders notification list when data is available", () => {
    const mockNotifications = [
      createMockNotification({
        _id: "notif-1" as Id<"notifications">,
        title: "Deadline Approaching",
        message: "PWD expires in 30 days",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications: mockNotifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    expect(screen.getByText("Deadline Approaching")).toBeInTheDocument();
    expect(screen.getByText("PWD expires in 30 days")).toBeInTheDocument();
  });

  it("applies custom className when provided", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [createMockNotification()],
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(
      <NotificationList activeTab="all" className="custom-class" />
    );

    const listContainer = container.querySelector(".custom-class");
    expect(listContainer).toBeInTheDocument();
  });
});

// ============================================================================
// DATE GROUPING TESTS
// ============================================================================

describe("NotificationList - Date Grouping", () => {
  it("groups notifications by date with correct headers", () => {
    const notifications = createNotificationsForDateGroups();

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    // Check for group headers
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
  });

  it("renders notifications within correct groups", () => {
    const notifications = createNotificationsForDateGroups();

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    // Each notification title should be in the document
    expect(screen.getByText("Today Notification")).toBeInTheDocument();
    expect(screen.getByText("Yesterday Notification")).toBeInTheDocument();
    expect(screen.getByText("This Week Notification")).toBeInTheDocument();
    expect(screen.getByText("This Month Notification")).toBeInTheDocument();
    expect(screen.getByText("Older Notification")).toBeInTheDocument();
  });

  it("does not render empty groups", () => {
    // Only provide today's notifications
    const notifications = [
      createMockNotification({
        _id: "notif-today" as Id<"notifications">,
        title: "Today Only",
        createdAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    // Only Today header should exist
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
    expect(screen.queryByText("This Week")).not.toBeInTheDocument();
    expect(screen.queryByText("This Month")).not.toBeInTheDocument();
    expect(screen.queryByText("Older")).not.toBeInTheDocument();
  });
});

// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe("NotificationList - Empty States", () => {
  it("shows 'All' empty state message", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    // Use exact match to avoid multiple element issue
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("shows 'Unread' empty state message", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="unread" />);

    expect(screen.getByText(/no unread notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/read all your notifications/i)).toBeInTheDocument();
  });

  it("shows 'Deadlines' empty state message", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="deadlines" />);

    expect(screen.getByText(/no deadline notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/no deadline reminders/i)).toBeInTheDocument();
  });

  it("shows 'Status' empty state message", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="status" />);

    expect(screen.getByText(/no status updates/i)).toBeInTheDocument();
    expect(screen.getByText(/no case status changes/i)).toBeInTheDocument();
  });

  it("shows 'RFE/RFI' empty state message", () => {
    (useQuery as Mock).mockReturnValue({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="rfe_rfi" />);

    expect(screen.getByText(/no rfe\/rfi alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/no rfe or rfi alerts/i)).toBeInTheDocument();
  });
});

// ============================================================================
// PAGINATION TESTS
// ============================================================================

describe("NotificationList - Pagination", () => {
  it("shows Load More button when hasMore is true", () => {
    const notifications = [createMockNotification()];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: true,
      nextCursor: "123456",
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("hides Load More button when hasMore is false", () => {
    const notifications = [createMockNotification()];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });
});

// ============================================================================
// NOTIFICATION ITEM TESTS
// ============================================================================

describe("NotificationList - Notification Items", () => {
  it("displays notification title", () => {
    const notifications = [
      createMockNotification({
        title: "PWD Expiration Warning",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    expect(screen.getByText("PWD Expiration Warning")).toBeInTheDocument();
  });

  it("displays notification message", () => {
    const notifications = [
      createMockNotification({
        message: "Your PWD will expire in 30 days",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    expect(screen.getByText("Your PWD will expire in 30 days")).toBeInTheDocument();
  });

  it("displays case info when available", () => {
    const notifications = [
      createMockNotification({
        caseInfo: {
          employerName: "Acme Corp",
          beneficiaryIdentifier: "John Doe",
        },
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    expect(screen.getByText(/acme corp/i)).toBeInTheDocument();
    expect(screen.getByText(/john doe/i)).toBeInTheDocument();
  });

  it("shows unread notification with highlight styling", () => {
    const notifications = [
      createMockNotification({
        isRead: false,
        title: "Unread Notification",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    // Unread notifications should have highlight background
    const notificationItem = container.querySelector('[class*="bg-primary/5"]');
    expect(notificationItem).toBeInTheDocument();
  });

  it("shows read notification without highlight styling", () => {
    const notifications = [
      createMockNotification({
        isRead: true,
        title: "Read Notification",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    // Title should have different font weight for read notifications
    const title = screen.getByText("Read Notification");
    expect(title).not.toHaveClass("font-bold");
  });
});

// ============================================================================
// NOTIFICATION TYPE ICON TESTS
// ============================================================================

describe("NotificationList - Notification Type Icons", () => {
  it("renders notification item with icon container", () => {
    const notifications = [
      createMockNotification({
        type: "deadline_reminder",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    // Check for icon container with border styling
    const iconContainer = container.querySelector(".border-2.border-black");
    expect(iconContainer).toBeInTheDocument();
  });
});

// ============================================================================
// PRIORITY COLOR BAR TESTS
// ============================================================================

describe("NotificationList - Priority Color Bars", () => {
  it("shows urgent priority color bar (red)", () => {
    const notifications = [
      createMockNotification({
        priority: "urgent",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    const colorBar = container.querySelector('.bg-\\[\\#DC2626\\]');
    expect(colorBar).toBeInTheDocument();
  });

  it("shows high priority color bar (orange)", () => {
    const notifications = [
      createMockNotification({
        priority: "high",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    const colorBar = container.querySelector('.bg-\\[\\#EA580C\\]');
    expect(colorBar).toBeInTheDocument();
  });

  it("shows normal priority color bar (green)", () => {
    const notifications = [
      createMockNotification({
        priority: "normal",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    const colorBar = container.querySelector('.bg-\\[\\#059669\\]');
    expect(colorBar).toBeInTheDocument();
  });

  it("shows low priority color bar (gray)", () => {
    const notifications = [
      createMockNotification({
        priority: "low",
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    const colorBar = container.querySelector(".bg-gray-400");
    expect(colorBar).toBeInTheDocument();
  });
});

// ============================================================================
// ACTION BUTTON TESTS
// ============================================================================

describe("NotificationList - Action Buttons", () => {
  it("shows mark as read button for unread notifications", () => {
    const notifications = [
      createMockNotification({
        isRead: false,
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    const markReadButton = screen.getByRole("button", { name: /mark as read/i });
    expect(markReadButton).toBeInTheDocument();
  });

  it("hides mark as read button for read notifications", () => {
    const notifications = [
      createMockNotification({
        isRead: true,
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    const markReadButton = screen.queryByRole("button", { name: /mark as read/i });
    expect(markReadButton).not.toBeInTheDocument();
  });

  it("shows delete button for all notifications", () => {
    const notifications = [
      createMockNotification({
        isRead: true,
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it("calls markAsRead mutation when mark as read button clicked", async () => {
    const mockMarkAsRead = vi.fn().mockResolvedValue({ success: true });
    (useMutation as Mock).mockReturnValue(mockMarkAsRead);

    const notifications = [
      createMockNotification({
        _id: "notif-123" as Id<"notifications">,
        isRead: false,
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { user } = renderWithProviders(<NotificationList activeTab="all" />);

    const markReadButton = screen.getByRole("button", { name: /mark as read/i });
    await user.click(markReadButton);

    expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationId: "notif-123" });
  });

  it("calls deleteNotification mutation when delete button clicked", async () => {
    const mockDeleteNotification = vi.fn().mockResolvedValue({ success: true });
    (useMutation as Mock).mockReturnValue(mockDeleteNotification);

    const notifications = [
      createMockNotification({
        _id: "notif-456" as Id<"notifications">,
        isRead: true,
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { user } = renderWithProviders(<NotificationList activeTab="all" />);

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    expect(mockDeleteNotification).toHaveBeenCalledWith({ notificationId: "notif-456" });
  });
});

// ============================================================================
// NAVIGATION TESTS
// ============================================================================

describe("NotificationList - Navigation", () => {
  it("notification item is clickable", () => {
    const notifications = [createMockNotification()];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    const notificationItem = screen.getByRole("button", { name: /test notification/i });
    expect(notificationItem).toBeInTheDocument();
  });
});

// ============================================================================
// STYLING TESTS
// ============================================================================

describe("NotificationList - Styling", () => {
  it("group container has neobrutalist border styling", () => {
    const notifications = [createMockNotification()];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    const { container } = renderWithProviders(<NotificationList activeTab="all" />);

    const groupContainer = container.querySelector(".border-2.shadow-hard");
    expect(groupContainer).toBeInTheDocument();
  });

  it("group header has uppercase styling", () => {
    const notifications = [
      createMockNotification({
        createdAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
      }),
    ];

    (useQuery as Mock).mockReturnValue({
      notifications,
      hasMore: false,
      nextCursor: null,
    });

    renderWithProviders(<NotificationList activeTab="all" />);

    const header = screen.getByText("Today");
    expect(header).toHaveClass("uppercase");
    expect(header).toHaveClass("font-heading");
  });
});
